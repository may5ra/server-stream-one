import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    // Expected path: /stream-proxy/{stream_name}/{file_path}
    // e.g., /stream-proxy/hbo/index.m3u8
    const pathParts = url.pathname.replace('/stream-proxy/', '').split('/')
    
    if (pathParts.length < 1 || !pathParts[0]) {
      console.error('Invalid path:', url.pathname)
      return new Response(JSON.stringify({ error: 'Invalid stream path' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const streamName = pathParts[0]
    const filePath = pathParts.slice(1).join('/') || 'index.m3u8'
    
    console.log(`Proxy request for stream: ${streamName}, file: ${filePath}`)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Look up stream from database
    const { data: stream, error: dbError } = await supabase
      .from('streams')
      .select('input_url, name, status')
      .eq('name', streamName)
      .maybeSingle()

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!stream) {
      console.error('Stream not found:', streamName)
      return new Response(JSON.stringify({ error: 'Stream not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!stream.input_url) {
      console.error('Stream has no input URL:', streamName)
      return new Response(JSON.stringify({ error: 'Stream has no source URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Construct the target URL
    // If input_url ends with /, append the file path
    // If input_url is a full URL to a specific file, use it as base
    let targetUrl: string
    const inputUrl = stream.input_url.trim()
    
    if (inputUrl.endsWith('/')) {
      targetUrl = `${inputUrl}${filePath}`
    } else if (inputUrl.endsWith('.m3u8') || inputUrl.endsWith('.ts')) {
      // If it's a direct file URL, replace the filename with requested file
      const baseUrl = inputUrl.substring(0, inputUrl.lastIndexOf('/') + 1)
      targetUrl = `${baseUrl}${filePath}`
    } else {
      // Assume it's a directory URL without trailing slash
      targetUrl = `${inputUrl}/${filePath}`
    }

    console.log(`Proxying to: ${targetUrl}`)

    // Fetch from the original source
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
      }
    })

    if (!response.ok) {
      console.error(`Upstream error: ${response.status} ${response.statusText}`)
      return new Response(JSON.stringify({ error: `Upstream error: ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get content type
    let contentType = response.headers.get('content-type') || 'application/octet-stream'
    
    // Set correct content type for HLS files
    if (filePath.endsWith('.m3u8')) {
      contentType = 'application/vnd.apple.mpegurl'
    } else if (filePath.endsWith('.ts')) {
      contentType = 'video/mp2t'
    }

    // Get the response body
    const body = await response.arrayBuffer()

    // For m3u8 files, we need to rewrite URLs to go through our proxy
    if (filePath.endsWith('.m3u8')) {
      const text = new TextDecoder().decode(body)
      const baseProxyUrl = `${url.origin}/stream-proxy/${streamName}/`
      
      // Rewrite relative URLs in the playlist
      const rewrittenText = text.split('\n').map(line => {
        const trimmedLine = line.trim()
        // Skip comments and empty lines
        if (trimmedLine.startsWith('#') || trimmedLine === '') {
          return line
        }
        // If it's a relative URL (not starting with http), keep it as is
        // The browser will resolve it relative to our proxy URL
        if (!trimmedLine.startsWith('http')) {
          return line
        }
        // For absolute URLs, we can't easily proxy them
        // Just return as-is for now
        return line
      }).join('\n')

      return new Response(rewrittenText, {
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
    console.error('Proxy error:', errorMessage)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

