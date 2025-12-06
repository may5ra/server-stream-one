import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EPGChannel {
  id: string;
  name: string;
  icon?: string;
}

interface EPGProgram {
  channel: string;
  title: string;
  description?: string;
  start: Date;
  stop: Date;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { url: epgUrl, sourceId } = await req.json();
    
    if (!epgUrl) {
      return new Response(JSON.stringify({ error: "EPG URL is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[EPG Import] Starting import from: ${epgUrl}`);

    // Fetch EPG XML
    const response = await fetch(epgUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch EPG: ${response.status}`);
    }

    let xmlText = await response.text();
    
    // Handle gzipped content
    if (epgUrl.endsWith(".gz") || response.headers.get("content-type")?.includes("gzip")) {
      // Already decompressed by fetch
      console.log("[EPG Import] Handling gzipped content");
    }

    // Parse XML (simple parsing for XMLTV format)
    const channels: EPGChannel[] = [];
    const programs: EPGProgram[] = [];

    // Parse channels
    const channelMatches = xmlText.matchAll(/<channel\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/channel>/g);
    for (const match of channelMatches) {
      const channelId = match[1];
      const channelContent = match[2];
      
      const nameMatch = channelContent.match(/<display-name[^>]*>([^<]+)<\/display-name>/);
      const iconMatch = channelContent.match(/<icon\s+src="([^"]+)"/);
      
      channels.push({
        id: channelId,
        name: nameMatch?.[1] || channelId,
        icon: iconMatch?.[1],
      });
    }

    console.log(`[EPG Import] Found ${channels.length} channels`);

    // Parse programs
    const programMatches = xmlText.matchAll(/<programme\s+start="([^"]+)"\s+stop="([^"]+)"\s+channel="([^"]+)"[^>]*>([\s\S]*?)<\/programme>/g);
    for (const match of programMatches) {
      const startStr = match[1];
      const stopStr = match[2];
      const channelId = match[3];
      const programContent = match[4];
      
      const titleMatch = programContent.match(/<title[^>]*>([^<]+)<\/title>/);
      const descMatch = programContent.match(/<desc[^>]*>([^<]+)<\/desc>/);
      
      // Parse XMLTV date format: 20231215120000 +0100
      const parseXmltvDate = (dateStr: string): Date => {
        const match = dateStr.match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/);
        if (!match) return new Date();
        
        const [, year, month, day, hour, min, sec, tz] = match;
        const isoStr = `${year}-${month}-${day}T${hour}:${min}:${sec}${tz ? tz.slice(0, 3) + ":" + tz.slice(3) : "Z"}`;
        return new Date(isoStr);
      };
      
      programs.push({
        channel: channelId,
        title: titleMatch?.[1] || "Unknown",
        description: descMatch?.[1],
        start: parseXmltvDate(startStr),
        stop: parseXmltvDate(stopStr),
      });
    }

    console.log(`[EPG Import] Found ${programs.length} programs`);

    // Get existing streams to match EPG channels
    const { data: streams } = await supabase
      .from("streams")
      .select("id, name, epg_channel_id");

    // Create/update EPG channels
    let channelsMapped = 0;
    const channelIdMap: Record<string, string> = {};
    
    for (const channel of channels) {
      // Find matching stream
      const matchingStream = (streams || []).find(s => 
        s.epg_channel_id === channel.id || 
        s.name.toLowerCase() === channel.name.toLowerCase()
      );
      
      if (matchingStream) {
        // Upsert EPG channel
        const { data: epgChannel, error } = await supabase
          .from("epg_channels")
          .upsert({
            stream_id: matchingStream.id,
            epg_channel_id: channel.id,
            name: channel.name,
            icon_url: channel.icon,
          }, { onConflict: "stream_id" })
          .select()
          .single();
        
        if (epgChannel) {
          channelIdMap[channel.id] = epgChannel.id;
          channelsMapped++;
        }
        
        // Update stream epg_channel_id if not set
        if (!matchingStream.epg_channel_id) {
          await supabase
            .from("streams")
            .update({ epg_channel_id: channel.id })
            .eq("id", matchingStream.id);
        }
      }
    }

    console.log(`[EPG Import] Mapped ${channelsMapped} channels to streams`);

    // Import programs (only for mapped channels, last 24h and next 7 days)
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    let programsImported = 0;
    const programBatch: any[] = [];
    
    for (const program of programs) {
      const channelUuid = channelIdMap[program.channel];
      if (!channelUuid) continue;
      
      // Only import relevant time range
      if (program.start < yesterday || program.start > nextWeek) continue;
      
      programBatch.push({
        channel_id: channelUuid,
        title: program.title,
        description: program.description,
        start_time: program.start.toISOString(),
        end_time: program.stop.toISOString(),
      });
      
      // Insert in batches of 100
      if (programBatch.length >= 100) {
        await supabase.from("epg_programs").upsert(programBatch, { 
          onConflict: "channel_id,start_time",
          ignoreDuplicates: true 
        });
        programsImported += programBatch.length;
        programBatch.length = 0;
      }
    }
    
    // Insert remaining programs
    if (programBatch.length > 0) {
      await supabase.from("epg_programs").upsert(programBatch, { 
        onConflict: "channel_id,start_time",
        ignoreDuplicates: true 
      });
      programsImported += programBatch.length;
    }

    console.log(`[EPG Import] Imported ${programsImported} programs`);

    // Update source last import time
    if (sourceId) {
      await supabase
        .from("epg_sources")
        .update({ last_import: new Date().toISOString() })
        .eq("id", sourceId);
    }

    return new Response(JSON.stringify({
      success: true,
      channels_found: channels.length,
      channels_mapped: channelsMapped,
      programs_imported: programsImported,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[EPG Import] Error:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
