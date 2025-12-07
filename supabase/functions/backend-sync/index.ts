import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, backendUrl, data } = await req.json();
    
    console.log(`[Backend Sync] Action: ${action}, URL: ${backendUrl}`);
    
    if (!backendUrl) {
      return new Response(
        JSON.stringify({ error: 'Backend URL required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let endpoint = '';
    let method = 'POST';
    let body: string | undefined;

    switch (action) {
      case 'sync-streams':
        endpoint = '/api/streams/sync';
        body = JSON.stringify({ streams: data });
        break;
      case 'sync-stream':
        endpoint = '/api/streams/sync-one';
        body = JSON.stringify(data);
        break;
      case 'delete-stream':
        endpoint = `/api/streams/sync/${data.id}`;
        method = 'DELETE';
        break;
      case 'cleanup-streams':
        // Remove orphan streams from Docker backend
        endpoint = '/api/streams/cleanup';
        body = JSON.stringify({ validIds: data.validIds });
        break;
      case 'sync-users':
        endpoint = '/api/streaming-users/sync';
        body = JSON.stringify({ users: data });
        break;
      case 'health':
        endpoint = '/api/health';
        method = 'GET';
        break;
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const url = `${backendUrl}${endpoint}`;
    console.log(`[Backend Sync] Calling: ${method} ${url}`);

    const fetchOptions: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    
    if (body && method !== 'GET' && method !== 'DELETE') {
      fetchOptions.body = body;
    }

    const response = await fetch(url, fetchOptions);
    const responseData = await response.json().catch(() => ({}));

    console.log(`[Backend Sync] Response: ${response.status}`, responseData);

    return new Response(
      JSON.stringify(responseData),
      { 
        status: response.status, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Backend Sync] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
