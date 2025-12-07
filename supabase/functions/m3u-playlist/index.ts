import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const params = url.searchParams;
  
  const username = params.get("username");
  const password = params.get("password");
  const type = params.get("type") || "m3u_plus"; // m3u_plus, m3u, ts
  const output = params.get("output") || "m3u8"; // m3u8, ts
  
  console.log(`[M3U Playlist] Generating for ${username}, type: ${type}, output: ${output}`);

  // Authenticate user
  if (!username || !password) {
    return new Response("Invalid credentials", { status: 401, headers: corsHeaders });
  }
  
  const { data: user, error: userError } = await supabase
    .from("streaming_users")
    .select("*")
    .eq("username", username)
    .eq("password", password)
    .single();
  
  if (userError || !user) {
    console.log(`[M3U Playlist] Auth failed for ${username}`);
    return new Response("Invalid credentials", { status: 401, headers: corsHeaders });
  }
  
  // Check expiry
  if (new Date(user.expiry_date) < new Date()) {
    return new Response("Account expired", { status: 403, headers: corsHeaders });
  }

  // Get server settings - check both server_domain and server_ip for compatibility
  const { data: serverDomainSetting } = await supabase
    .from("panel_settings")
    .select("value")
    .eq("key", "server_domain")
    .single();
  
  const { data: serverIpSetting } = await supabase
    .from("panel_settings")
    .select("value")
    .eq("key", "server_ip")
    .single();
  
  const { data: httpPortSetting } = await supabase
    .from("panel_settings")
    .select("value")
    .eq("key", "http_port")
    .single();

  // Priority: server_domain > server_ip > request hostname
  const serverUrl = serverDomainSetting?.value || serverIpSetting?.value || url.hostname;
  const httpPort = httpPortSetting?.value || "80";
  
  // Get all live streams
  const { data: streams } = await supabase
    .from("streams")
    .select("*")
    .eq("status", "live")
    .order("category")
    .order("channel_number");
  
  // Get VOD content
  const { data: vods } = await supabase
    .from("vod_content")
    .select("*, vod_categories(name)")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  // Get Series
  const { data: seriesList } = await supabase
    .from("series")
    .select("*, series_categories(name), series_episodes(*)")
    .eq("status", "active");

  // Build M3U playlist
  let m3u = "#EXTM3U\n";
  
  // Add live streams
  const groupedStreams: Record<string, any[]> = {};
  (streams || []).forEach(stream => {
    const group = stream.category || "Uncategorized";
    if (!groupedStreams[group]) groupedStreams[group] = [];
    groupedStreams[group].push(stream);
  });
  
  Object.entries(groupedStreams).forEach(([group, groupStreams]) => {
    groupStreams.forEach(stream => {
      const tvgId = stream.epg_channel_id || stream.name.toLowerCase().replace(/\s+/g, "");
      const icon = stream.stream_icon || "";
      
      if (type === "m3u_plus") {
        m3u += `#EXTINF:-1 tvg-id="${tvgId}" tvg-name="${stream.name}" tvg-logo="${icon}" group-title="${group}",${stream.name}\n`;
      } else {
        m3u += `#EXTINF:-1,${stream.name}\n`;
      }
      
      // For HLS streams, use proxy URL format with auth
      if (stream.input_type === "hls") {
        const encodedName = encodeURIComponent(stream.name);
        m3u += `http://${serverUrl}:${httpPort}/proxy/${username}/${password}/${encodedName}/index.m3u8\n`;
      } else {
        // For RTMP/other streams, use traditional format
        const ext = output === "ts" ? ".ts" : ".m3u8";
        m3u += `http://${serverUrl}:${httpPort}/live/${username}/${password}/${stream.id}${ext}\n`;
      }
    });
  });
  
  // Add VOD
  if (vods && vods.length > 0) {
    (vods || []).forEach(vod => {
      const group = (vod as any).vod_categories?.name || "Movies";
      const icon = vod.cover_url || "";
      
      if (type === "m3u_plus") {
        m3u += `#EXTINF:-1 tvg-name="${vod.name}" tvg-logo="${icon}" group-title="${group}",${vod.name}\n`;
      } else {
        m3u += `#EXTINF:-1,${vod.name}\n`;
      }
      
      m3u += `http://${serverUrl}:${httpPort}/movie/${username}/${password}/${vod.id}.${vod.container_extension || "mp4"}\n`;
    });
  }
  
  // Add Series
  if (seriesList && seriesList.length > 0) {
    (seriesList || []).forEach(series => {
      const group = (series as any).series_categories?.name || "Series";
      const episodes = (series as any).series_episodes || [];
      
      episodes.forEach((ep: any) => {
        const epName = `${series.name} S${ep.season_number.toString().padStart(2, "0")}E${ep.episode_number.toString().padStart(2, "0")}`;
        const icon = ep.cover_url || series.cover_url || "";
        
        if (type === "m3u_plus") {
          m3u += `#EXTINF:-1 tvg-name="${epName}" tvg-logo="${icon}" group-title="${group}",${epName}\n`;
        } else {
          m3u += `#EXTINF:-1,${epName}\n`;
        }
        
        m3u += `http://${serverUrl}:${httpPort}/series/${username}/${password}/${ep.id}.${ep.container_extension || "mp4"}\n`;
      });
    });
  }

  console.log(`[M3U Playlist] Generated ${streams?.length || 0} live, ${vods?.length || 0} VOD, ${seriesList?.length || 0} series`);

  return new Response(m3u, {
    headers: {
      ...corsHeaders,
      "Content-Type": "audio/x-mpegurl",
      "Content-Disposition": `attachment; filename="${username}_playlist.m3u"`,
    },
  });
});
