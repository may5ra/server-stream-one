import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// In-memory active connections tracking (per edge function instance)
const activeConnections = new Map<string, Map<string, { ip: string; stream: string; lastActivity: number }>>();

// Helper to detect stream type from URL or path
function getStreamType(url: string, path: string): 'hls' | 'dash' | 'unknown' {
  const lowerUrl = url.toLowerCase();
  const lowerPath = path.toLowerCase();
  
  if (lowerUrl.endsWith('.mpd') || lowerPath.endsWith('.mpd')) {
    return 'dash';
  }
  if (lowerUrl.endsWith('.m3u8') || lowerPath.endsWith('.m3u8')) {
    return 'hls';
  }
  if (lowerPath.endsWith('.m4s') || lowerPath.endsWith('.mp4') || lowerPath.includes('dash')) {
    return 'dash';
  }
  if (lowerPath.endsWith('.ts')) {
    return 'hls';
  }
  return 'unknown';
}

// Get content type based on file extension
function getContentType(filePath: string, streamType: 'hls' | 'dash' | 'unknown'): string {
  const lowerPath = filePath.toLowerCase();
  
  // DASH types
  if (lowerPath.endsWith('.mpd')) {
    return 'application/dash+xml';
  }
  if (lowerPath.endsWith('.m4s')) {
    return 'video/iso.segment';
  }
  if (lowerPath.endsWith('.m4a')) {
    return 'audio/mp4';
  }
  if (lowerPath.endsWith('.m4v') || lowerPath.endsWith('.mp4')) {
    return 'video/mp4';
  }
  
  // HLS types
  if (lowerPath.endsWith('.m3u8')) {
    return 'application/vnd.apple.mpegurl';
  }
  if (lowerPath.endsWith('.ts')) {
    return 'video/mp2t';
  }
  
  // Audio types
  if (lowerPath.endsWith('.aac')) {
    return 'audio/aac';
  }
  if (lowerPath.endsWith('.mp3')) {
    return 'audio/mpeg';
  }
  
  // Subtitles
  if (lowerPath.endsWith('.vtt')) {
    return 'text/vtt';
  }
  if (lowerPath.endsWith('.srt')) {
    return 'text/plain';
  }
  
  return 'application/octet-stream';
}

// Check if input URL is already a manifest file
function isManifestUrl(inputUrl: string): boolean {
  const lowerUrl = inputUrl.toLowerCase();
  return lowerUrl.endsWith('.mpd') || lowerUrl.endsWith('.m3u8');
}

// Get default file for stream type
function getDefaultFile(inputUrl: string): string {
  const lowerUrl = inputUrl.toLowerCase();
  // If input_url already points to a manifest, we don't need a default file
  if (lowerUrl.endsWith('.mpd') || lowerUrl.endsWith('.m3u8')) {
    return '';
  }
  if (lowerUrl.includes('.mpd') || lowerUrl.includes('dash')) {
    return 'manifest.mpd';
  }
  return 'index.m3u8';
}

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
        filePath = pathParts.slice(3).join('/') || '';
        
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
        filePath = pathParts.slice(1).join('/') || '';
        console.log(`[Proxy] Legacy request (no auth): ${streamName}/${filePath}`);
      }
    } else {
      // Legacy format: streamName/filePath
      streamName = decodeURIComponent(pathParts[0]);
      filePath = pathParts.slice(1).join('/') || '';
      console.log(`[Proxy] Legacy request: ${streamName}/${filePath}`);
    }

    // Look up stream from database
    const { data: stream, error: dbError } = await supabase
      .from('streams')
      .select('input_url, name, status, input_type')
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

    // NOTE: Stream status check removed from proxy
    // Status is now controlled via Xtream API - if stream is not 'live', 
    // it won't appear in player's channel list, so users won't try to play it
    // But if someone has the direct URL, they can still access the stream
    console.log(`[Proxy] Stream found: ${streamName}, status: ${stream.status}`);

    if (!stream.input_url) {
      console.error('[Proxy] Stream has no input URL:', streamName)
      return new Response(JSON.stringify({ error: 'Stream has no source URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const inputUrl = stream.input_url.trim();
    const streamType = getStreamType(inputUrl, filePath);
    
    // If no file path specified, use default based on input URL
    if (!filePath) {
      filePath = getDefaultFile(inputUrl);
    }
    
    console.log(`[Proxy] Stream type: ${streamType}, input_type: ${stream.input_type}`);

    // Construct the target URL
    let targetUrl: string;
    
    if (inputUrl.endsWith('.mpd') || inputUrl.endsWith('.m3u8')) {
      // Input URL is the manifest itself
      if (!filePath || filePath === getDefaultFile(inputUrl)) {
        targetUrl = inputUrl;
      } else {
        const baseUrl = inputUrl.substring(0, inputUrl.lastIndexOf('/') + 1);
        targetUrl = `${baseUrl}${filePath}`;
      }
    } else if (inputUrl.endsWith('/')) {
      targetUrl = `${inputUrl}${filePath}`;
    } else if (inputUrl.endsWith('.ts') || inputUrl.endsWith('.m4s')) {
      const baseUrl = inputUrl.substring(0, inputUrl.lastIndexOf('/') + 1);
      targetUrl = `${baseUrl}${filePath}`;
    } else {
      targetUrl = filePath ? `${inputUrl}/${filePath}` : inputUrl;
    }

    console.log(`[Proxy] Fetching: ${targetUrl}`);

    // Helper function to extract redirect URL from HTML
    const extractRedirectUrl = (html: string): string | null => {
      // Look for href="..." pattern in HTML redirect pages
      const hrefMatch = html.match(/href=["']?([^"'\s>]+\.m3u8[^"'\s>]*)["']?/i);
      if (hrefMatch) return hrefMatch[1];
      
      // Also try meta refresh pattern
      const metaMatch = html.match(/content=["'][^"']*url=([^"'\s>]+)["']/i);
      if (metaMatch) return metaMatch[1];
      
      return null;
    };

    // Fetch from the original source - follow redirects
    let response = await fetch(targetUrl, {
      redirect: 'follow', // IMPORTANT: Follow HTTP redirects (302, 301, etc.)
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
      }
    });

    // Check if response is HTML (might be a redirect page)
    const responseContentType = response.headers.get('content-type') || '';
    if (response.ok && responseContentType.includes('text/html')) {
      const html = await response.text();
      const redirectUrl = extractRedirectUrl(html);
      
      if (redirectUrl) {
        console.log(`[Proxy] Found HTML redirect, following to: ${redirectUrl}`);
        // Follow the redirect URL
        response = await fetch(redirectUrl, {
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*',
            'Accept-Encoding': 'identity',
          }
        });
      } else {
        console.error(`[Proxy] Got HTML response but no redirect URL found`);
        return new Response(JSON.stringify({ error: 'Invalid upstream response' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (!response.ok) {
      console.error(`[Proxy] Upstream error: ${response.status} ${response.statusText}`);
      return new Response(JSON.stringify({ error: `Upstream error: ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get content type
    const contentType = getContentType(filePath || targetUrl, streamType);
    console.log(`[Proxy] Content-Type: ${contentType}`);

    // Get the response body
    const body = await response.arrayBuffer();

    // Determine cache policy based on file type
    let cacheControl = 'no-cache';
    const lowerPath = (filePath || targetUrl).toLowerCase();
    
    if (lowerPath.endsWith('.ts') || lowerPath.endsWith('.m4s') || lowerPath.endsWith('.mp4')) {
      // Segments can be cached longer
      cacheControl = 'max-age=86400';
    } else if (lowerPath.endsWith('.mpd') || lowerPath.endsWith('.m3u8')) {
      // Manifests should not be cached
      cacheControl = 'no-cache, no-store, must-revalidate';
    }

    // Return the proxied content
    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
      }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Proxy] Error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
