import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { table, action, data, dockerUrl } = await req.json();
    
    if (!dockerUrl) {
      return new Response(
        JSON.stringify({ error: 'Docker URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Sync] ${action} on ${table}:`, data);

    // Map table names to Docker API endpoints
    const endpointMap: Record<string, string> = {
      'streaming_users': '/api/streaming-users',
      'streams': '/api/streams',
      'live_categories': '/api/categories',
      'vod_content': '/api/vod',
      'series': '/api/series',
    };

    const endpoint = endpointMap[table];
    if (!endpoint) {
      console.log(`[Sync] No endpoint mapping for table: ${table}`);
      return new Response(
        JSON.stringify({ message: 'Table not synced', table }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiUrl = `${dockerUrl}${endpoint}`;
    let response;

    switch (action) {
      case 'INSERT':
      case 'insert':
        console.log(`[Sync] POST to ${apiUrl}`);
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        break;

      case 'UPDATE':
      case 'update':
        console.log(`[Sync] PUT to ${apiUrl}/${data.id}`);
        response = await fetch(`${apiUrl}/${data.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        break;

      case 'DELETE':
      case 'delete':
        console.log(`[Sync] DELETE to ${apiUrl}/${data.id}`);
        response = await fetch(`${apiUrl}/${data.id}`, {
          method: 'DELETE',
        });
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action', action }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const result = await response.text();
    console.log(`[Sync] Response: ${response.status} - ${result}`);

    return new Response(
      JSON.stringify({ 
        success: response.ok, 
        status: response.status,
        message: response.ok ? 'Synced to Docker' : 'Sync failed',
        details: result 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Sync] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});