import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface M3UEntry {
  name: string;
  url: string;
  tvg_id?: string;
  tvg_name?: string;
  tvg_logo?: string;
  group_title?: string;
  channel_number?: number;
}

function parseM3U(content: string): M3UEntry[] {
  const entries: M3UEntry[] = [];
  const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
  
  let currentEntry: Partial<M3UEntry> = {};
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('#EXTM3U')) {
      continue;
    }
    
    if (line.startsWith('#EXTINF:')) {
      // Parse EXTINF line
      // Format: #EXTINF:-1 tvg-id="id" tvg-name="name" tvg-logo="logo" group-title="group",Channel Name
      const extinf = line.substring(8); // Remove #EXTINF:
      
      // Extract attributes
      const tvgIdMatch = extinf.match(/tvg-id="([^"]*)"/i);
      const tvgNameMatch = extinf.match(/tvg-name="([^"]*)"/i);
      const tvgLogoMatch = extinf.match(/tvg-logo="([^"]*)"/i);
      const groupTitleMatch = extinf.match(/group-title="([^"]*)"/i);
      const channelNumberMatch = extinf.match(/tvg-chno="([^"]*)"/i);
      
      // Extract channel name (after the last comma)
      const commaIndex = extinf.lastIndexOf(',');
      const channelName = commaIndex !== -1 ? extinf.substring(commaIndex + 1).trim() : '';
      
      currentEntry = {
        name: channelName || tvgNameMatch?.[1] || 'Unknown',
        tvg_id: tvgIdMatch?.[1] || undefined,
        tvg_name: tvgNameMatch?.[1] || undefined,
        tvg_logo: tvgLogoMatch?.[1] || undefined,
        group_title: groupTitleMatch?.[1] || undefined,
        channel_number: channelNumberMatch?.[1] ? parseInt(channelNumberMatch[1]) : undefined,
      };
    } else if (!line.startsWith('#') && currentEntry.name) {
      // This is the URL line
      currentEntry.url = line;
      entries.push(currentEntry as M3UEntry);
      currentEntry = {};
    }
  }
  
  return entries;
}

function detectInputType(url: string): string {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('rtmp://')) return 'rtmp';
  if (lowerUrl.includes('rtsp://')) return 'rtsp';
  if (lowerUrl.includes('srt://')) return 'srt';
  if (lowerUrl.includes('udp://') || lowerUrl.includes('@')) return 'udp';
  if (lowerUrl.includes('.mpd') || lowerUrl.includes('/dash')) return 'mpd';
  if (lowerUrl.includes('.m3u8') || lowerUrl.includes('/hls/')) return 'hls';
  return 'hls'; // Default to HLS for HTTP streams
}

// Convert A1 streams to HLS-TS format for better compatibility
function convertA1ToHlsTs(url: string): string {
  // Check if this is an A1 stream (A1_SI, A1_CZ, A1_HR, A1_BG, etc.)
  if (url.includes('/__c/A1_') || url.includes('/__c/a1_')) {
    // Convert dash-default to hls-ts-avc for better player compatibility
    if (url.includes('/dash-default/') || url.includes('/dash/')) {
      const converted = url
        .replace('/dash-default/', '/hls-ts-avc/')
        .replace('/dash/', '/hls-ts-avc/')
        .replace('.mpd', '.m3u8')
        .replace('/manifest.m3u8', '/master.m3u8');
      console.log(`[A1 Convert] ${url} -> ${converted}`);
      return converted;
    }
    // Also ensure manifest uses correct extension
    if (url.endsWith('.mpd')) {
      return url.replace('.mpd', '.m3u8');
    }
  }
  return url;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { m3u_content, m3u_url, default_category, overwrite_existing } = await req.json();

    let content = m3u_content;

    // If URL provided, fetch the M3U content
    if (m3u_url && !m3u_content) {
      console.log(`Fetching M3U from URL: ${m3u_url}`);
      const response = await fetch(m3u_url);
      if (!response.ok) {
        throw new Error(`Failed to fetch M3U: ${response.statusText}`);
      }
      content = await response.text();
    }

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'No M3U content provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Parsing M3U content (${content.length} bytes)`);
    const entries = parseM3U(content);
    console.log(`Found ${entries.length} entries in M3U`);

    if (entries.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid entries found in M3U file' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let imported = 0;
    let skipped = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const entry of entries) {
      try {
        // Check if stream already exists by name or URL
        const { data: existing } = await supabase
          .from('streams')
          .select('id, name')
          .or(`name.eq.${entry.name},input_url.eq.${entry.url}`)
          .maybeSingle();

        // Convert A1 streams to HLS-TS format automatically
        const processedUrl = convertA1ToHlsTs(entry.url);
        const inputType = detectInputType(processedUrl);
        
        const streamData = {
          name: entry.name,
          input_type: inputType,
          input_url: processedUrl,
          category: entry.group_title || default_category || null,
          stream_icon: entry.tvg_logo || null,
          epg_channel_id: entry.tvg_id || null,
          channel_number: entry.channel_number || null,
          status: 'inactive',
          output_formats: ['hls'],
        };

        if (existing) {
          if (overwrite_existing) {
            const { error } = await supabase
              .from('streams')
              .update(streamData)
              .eq('id', existing.id);
            
            if (error) {
              errors.push(`Failed to update ${entry.name}: ${error.message}`);
            } else {
              updated++;
            }
          } else {
            skipped++;
          }
        } else {
          const { error } = await supabase
            .from('streams')
            .insert(streamData);
          
          if (error) {
            errors.push(`Failed to import ${entry.name}: ${error.message}`);
          } else {
            imported++;
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        errors.push(`Error processing ${entry.name}: ${errorMessage}`);
      }
    }
    console.log(`Import complete: ${imported} imported, ${updated} updated, ${skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        total: entries.length,
        imported,
        updated,
        skipped,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('M3U import error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
