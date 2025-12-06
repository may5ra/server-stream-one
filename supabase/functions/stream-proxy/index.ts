import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// In-memory active connections tracking (per edge function instance)
const activeConnections = new Map<string, Map<string, { ip: string; stream: string; lastActivity: number }>>();

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    // Expected path formats:
    // New: /stream-proxy/{username}/{password}/{stream_name}/{file_path}
    // Legacy: /stream-proxy/{stream_name}/{file_path}
    const pathParts = url.pathname.replace('/stream-proxy/', '').split('/')
    
    if (pathParts.length < 1 || !pathParts[0]) {
      console.error('[Proxy] Invalid path:', url.pathname)
      return new Response(JSON.stringify({ error: 'Invalid stream path' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    let username: string | null = null;
    let password: string | null = null;
    let streamName: string;
    let filePath: string;
    const clientIp = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || 'unknown';

    // Detect URL format (new with auth or legacy)
    if (pathParts.length >= 3) {
      // Could be new format: username/password/streamName/filePath
      // Or legacy format with nested path: streamName/path/to/file.m3u8
      
      // Try to authenticate with first two parts as username/password
      const possibleUsername = pathParts[0];
      const possiblePassword = pathParts[1];
      
      const { data: user } = await supabase
        .from('streaming_users')
        .select('id, username, max_connections, expiry_date, status')
        .eq('username', possibleUsername)
        .eq('password', possiblePassword)
        .maybeSingle();
      
      if (user) {
        // New format with auth
        username = possibleUsername;
        password = possiblePassword;
        streamName = decodeURIComponent(pathParts[2]);
        filePath = pathParts.slice(3).join('/') || 'index.m3u8';
        
        console.log(`[Proxy] Authenticated request: ${username}/${streamName}/${filePath} from ${clientIp}`);
        
        // Check expiry
        if (new Date(user.expiry_date) < new Date()) {
          console.log(`[Proxy] Account expired for ${username}`);
          return new Response(JSON.stringify({ error: 'Account expired' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Check and track connections
        if (!activeConnections.has(user.id)) {
          activeConnections.set(user.id, new Map());
        }
        
        const userConnections = activeConnections.get(user.id)!;
        
        // Find existing connection for this IP+stream
        let existingConnId: string | null = null;
        for (const [connId, connData] of userConnections.entries()) {
          if (connData.ip === clientIp && connData.stream === streamName) {
            existingConnId = connId;
            break;
          }
        }
        
        const now = Date.now();
        
        // Clean up stale connections (older than 60 seconds)
        for (const [connId, connData] of userConnections.entries()) {
          if (now - connData.lastActivity > 60000) {
            userConnections.delete(connId);
          }
        }
        
        if (existingConnId) {
          // Update existing connection activity
          userConnections.get(existingConnId)!.lastActivity = now;
        } else {
          // Check if we can add new connection
          if (userConnections.size >= (user.max_connections || 1)) {
            console.log(`[Proxy] Connection limit reached for ${username}: ${userConnections.size}/${user.max_connections}`);
            return new Response(JSON.stringify({ 
              error: 'Connection limit reached', 
              active: userConnections.size, 
              max: user.max_connections 
            }), {
              status: 429,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
          
          // Add new connection
          const connectionId = `${clientIp}-${streamName}-${now}`;
          userConnections.set(connectionId, {
            ip: clientIp,
            stream: streamName,
            lastActivity: now
          });
          
          console.log(`[Proxy] New connection for ${username}: ${userConnections.size}/${user.max_connections}`);
          
          // Update database
          await supabase
            .from('streaming_users')
            .update({ connections: userConnections.size, last_active: new Date().toISOString() })
            .eq('id', user.id);
        }
      } else {
        // Legacy format (no auth found)
        streamName = decodeURIComponent(pathParts[0]);
        filePath = pathParts.slice(1).join('/') || 'index.m3u8';
        console.log(`[Proxy] Legacy request (no auth): ${streamName}/${filePath}`);
      }
    } else {
      // Legacy format: streamName/filePath
      streamName = decodeURIComponent(pathParts[0]);
      filePath = pathParts.slice(1).join('/') || 'index.m3u8';
      console.log(`[Proxy] Legacy request: ${streamName}/${filePath}`);
    }

    // Look up stream from database
    const { data: stream, error: dbError } = await supabase
      .from('streams')
      .select('input_url, name, status')
      .eq('name', streamName)
      .maybeSingle()

    if (dbError) {
      console.error('[Proxy] Database error:', dbError)
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!stream) {
      console.error('[Proxy] Stream not found:', streamName)
      return new Response(JSON.stringify({ error: 'Stream not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!stream.input_url) {
      console.error('[Proxy] Stream has no input URL:', streamName)
      return new Response(JSON.stringify({ error: 'Stream has no source URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Construct the target URL
    let targetUrl: string
    const inputUrl = stream.input_url.trim()
    
    if (inputUrl.endsWith('/')) {
      targetUrl = `${inputUrl}${filePath}`
    } else if (inputUrl.endsWith('.m3u8') || inputUrl.endsWith('.ts')) {
      const baseUrl = inputUrl.substring(0, inputUrl.lastIndexOf('/') + 1)
      targetUrl = `${baseUrl}${filePath}`
    } else {
      targetUrl = `${inputUrl}/${filePath}`
    }

    console.log(`[Proxy] Fetching: ${targetUrl}`)

    // Fetch from the original source
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
      }
    })

    if (!response.ok) {
      console.error(`[Proxy] Upstream error: ${response.status} ${response.statusText}`)
      return new Response(JSON.stringify({ error: `Upstream error: ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get content type
    let contentType = response.headers.get('content-type') || 'application/octet-stream'
    
    if (filePath.endsWith('.m3u8')) {
      contentType = 'application/vnd.apple.mpegurl'
    } else if (filePath.endsWith('.ts')) {
      contentType = 'video/mp2t'
    }

    // Get the response body
    const body = await response.arrayBuffer()

    // For m3u8 files, we may need to rewrite URLs
    if (filePath.endsWith('.m3u8')) {
      const text = new TextDecoder().decode(body)
      
      return new Response(text, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Cache-Control': 'no-cache',
        }
      })
    }

    // Return the proxied content
    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': filePath.endsWith('.ts') ? 'max-age=86400' : 'no-cache',
      }
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Proxy] Error:', errorMessage)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
