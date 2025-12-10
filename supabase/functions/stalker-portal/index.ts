import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

interface StreamingUser {
  id: string;
  username: string;
  password: string;
  status: string;
  expiry_date: string;
  mac_address: string | null;
  max_connections: number;
  bouquets: string[] | null;
}

interface Stream {
  id: string;
  name: string;
  input_url: string;
  category: string | null;
  stream_icon: string | null;
  channel_number: number | null;
  status: string;
  bouquet: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const url = new URL(req.url);
    const params = url.searchParams;
    
    // Get MAC address from various sources
    let mac = params.get("mac") || params.get("stb_mac") || "";
    mac = mac.replace(/[:-]/g, "").toUpperCase();
    
    const action = params.get("action") || params.get("type") || "";
    const sn = params.get("sn") || "";
    
    console.log(`Stalker Portal request: action=${action}, mac=${mac}`);

    // Handshake - return token
    if (action === "handshake" || action === "") {
      return new Response(JSON.stringify({
        js: {
          token: generateToken(),
          random: Math.random().toString(36).substring(7),
        }
      }), { headers: corsHeaders });
    }

    // STB actions
    if (action === "stb" || url.pathname.includes("/stb")) {
      const subAction = params.get("action") || "get_profile";
      
      if (subAction === "handshake") {
        return new Response(JSON.stringify({
          js: {
            token: generateToken(),
            random: Math.random().toString(36).substring(7),
          }
        }), { headers: corsHeaders });
      }

      // Authenticate by MAC
      const { data: user, error: userError } = await supabase
        .from("streaming_users")
        .select("*")
        .eq("mac_address", mac)
        .maybeSingle();

      if (!user) {
        console.log(`MAC not found: ${mac}`);
        return new Response(JSON.stringify({
          js: { error: "MAC address not registered" }
        }), { headers: corsHeaders, status: 401 });
      }

      // Check expiry
      const expiryDate = new Date(user.expiry_date);
      if (expiryDate < new Date()) {
        return new Response(JSON.stringify({
          js: { error: "Subscription expired" }
        }), { headers: corsHeaders, status: 403 });
      }

      // Update last active
      await supabase
        .from("streaming_users")
        .update({ last_active: new Date().toISOString() })
        .eq("id", user.id);

      if (subAction === "get_profile" || subAction === "do_auth") {
        return new Response(JSON.stringify({
          js: {
            id: user.id,
            name: user.username,
            mac: mac,
            status: 1,
            exp_date: Math.floor(expiryDate.getTime() / 1000),
            phone: "",
            max_connections: user.max_connections || 1,
            tariff_plan: "Premium",
          }
        }), { headers: corsHeaders });
      }
    }

    // ITV (Live TV) actions
    if (action === "itv" || url.pathname.includes("/itv")) {
      const subAction = params.get("action") || "get_all_channels";

      // Auth check
      const { data: user } = await supabase
        .from("streaming_users")
        .select("*")
        .eq("mac_address", mac)
        .maybeSingle();

      if (!user) {
        return new Response(JSON.stringify({
          js: { error: "Unauthorized" }
        }), { headers: corsHeaders, status: 401 });
      }

      if (subAction === "get_genres" || subAction === "get_categories") {
        const { data: categories } = await supabase
          .from("live_categories")
          .select("*")
          .order("sort_order");

        const genres = (categories || []).map((cat, idx) => ({
          id: cat.id,
          title: cat.name,
          alias: cat.name.toLowerCase().replace(/\s+/g, "_"),
          number: idx + 1,
        }));

        // Add "All" category
        genres.unshift({
          id: "*",
          title: "All",
          alias: "all",
          number: 0,
        });

        return new Response(JSON.stringify({
          js: genres
        }), { headers: corsHeaders });
      }

      if (subAction === "get_all_channels" || subAction === "get_ordered_list") {
        const genre = params.get("genre") || "*";
        const page = parseInt(params.get("p") || "1");
        const perPage = parseInt(params.get("cnt") || "50");
        
        let query = supabase
          .from("streams")
          .select("*")
          .eq("status", "active");

        if (genre && genre !== "*") {
          query = query.eq("category", genre);
        }

        // Filter by user bouquets
        if (user.bouquets && user.bouquets.length > 0) {
          query = query.in("bouquet", user.bouquets);
        }

        const { data: streams } = await query
          .order("channel_number")
          .range((page - 1) * perPage, page * perPage - 1);

        const { count } = await supabase
          .from("streams")
          .select("*", { count: "exact", head: true })
          .eq("status", "active");

        const channels = (streams || []).map((stream, idx) => ({
          id: stream.id,
          name: stream.name,
          number: stream.channel_number || idx + 1,
          logo: stream.stream_icon || "",
          cmd: `${supabaseUrl}/functions/v1/stalker-portal/play?id=${stream.id}&mac=${mac}`,
          tv_genre_id: stream.category || "*",
          xmltv_id: stream.epg_channel_id || "",
          use_http_tmp_link: 1,
          censored: 0,
        }));

        return new Response(JSON.stringify({
          js: {
            data: channels,
            total_items: count || channels.length,
            max_page_items: perPage,
            cur_page: page,
          }
        }), { headers: corsHeaders });
      }

      if (subAction === "create_link" || subAction === "get_url") {
        const channelId = params.get("cmd") || params.get("id") || "";
        const streamId = channelId.split("/").pop()?.split("?")[0] || channelId;

        const { data: stream } = await supabase
          .from("streams")
          .select("*")
          .eq("id", streamId)
          .maybeSingle();

        if (!stream) {
          return new Response(JSON.stringify({
            js: { error: "Channel not found" }
          }), { headers: corsHeaders, status: 404 });
        }

        return new Response(JSON.stringify({
          js: {
            cmd: stream.input_url,
          }
        }), { headers: corsHeaders });
      }
    }

    // EPG actions
    if (action === "epg" || url.pathname.includes("/epg")) {
      const channelId = params.get("ch_id") || params.get("id") || "";
      const period = parseInt(params.get("period") || "24");

      const now = new Date();
      const endTime = new Date(now.getTime() + period * 60 * 60 * 1000);

      const { data: programs } = await supabase
        .from("epg_programs")
        .select("*, epg_channels!inner(stream_id)")
        .eq("epg_channels.stream_id", channelId)
        .gte("end_time", now.toISOString())
        .lte("start_time", endTime.toISOString())
        .order("start_time");

      const epgData = (programs || []).map(prog => ({
        id: prog.id,
        ch_id: channelId,
        name: prog.title,
        descr: prog.description || "",
        time: Math.floor(new Date(prog.start_time).getTime() / 1000),
        time_to: Math.floor(new Date(prog.end_time).getTime() / 1000),
        start_timestamp: Math.floor(new Date(prog.start_time).getTime() / 1000),
        stop_timestamp: Math.floor(new Date(prog.end_time).getTime() / 1000),
      }));

      return new Response(JSON.stringify({
        js: epgData
      }), { headers: corsHeaders });
    }

    // VOD actions
    if (action === "vod" || url.pathname.includes("/vod")) {
      const subAction = params.get("action") || "get_categories";

      const { data: user } = await supabase
        .from("streaming_users")
        .select("*")
        .eq("mac_address", mac)
        .maybeSingle();

      if (!user) {
        return new Response(JSON.stringify({
          js: { error: "Unauthorized" }
        }), { headers: corsHeaders, status: 401 });
      }

      if (subAction === "get_categories") {
        const { data: categories } = await supabase
          .from("vod_categories")
          .select("*")
          .order("sort_order");

        const cats = (categories || []).map((cat, idx) => ({
          id: cat.id,
          title: cat.name,
          alias: cat.name.toLowerCase().replace(/\s+/g, "_"),
          number: idx + 1,
        }));

        return new Response(JSON.stringify({
          js: cats
        }), { headers: corsHeaders });
      }

      if (subAction === "get_ordered_list") {
        const category = params.get("category") || "*";
        const page = parseInt(params.get("p") || "1");
        const perPage = parseInt(params.get("cnt") || "50");

        let query = supabase
          .from("vod_content")
          .select("*")
          .eq("status", "active");

        if (category && category !== "*") {
          query = query.eq("category_id", category);
        }

        const { data: movies } = await query
          .order("created_at", { ascending: false })
          .range((page - 1) * perPage, page * perPage - 1);

        const { count } = await supabase
          .from("vod_content")
          .select("*", { count: "exact", head: true })
          .eq("status", "active");

        const vodList = (movies || []).map(movie => ({
          id: movie.id,
          name: movie.name,
          o_name: movie.name,
          description: movie.plot || "",
          director: movie.director || "",
          actors: movie.cast_names || "",
          year: movie.release_date?.split("-")[0] || "",
          rating: movie.rating || 0,
          genre_str: movie.genre || "",
          cover: movie.cover_url || "",
          cmd: `${supabaseUrl}/functions/v1/stalker-portal/vod-play?id=${movie.id}&mac=${mac}`,
          time: movie.duration || 0,
        }));

        return new Response(JSON.stringify({
          js: {
            data: vodList,
            total_items: count || vodList.length,
            max_page_items: perPage,
            cur_page: page,
          }
        }), { headers: corsHeaders });
      }

      if (subAction === "create_link" || subAction === "get_url") {
        const vodId = params.get("cmd") || params.get("id") || "";
        const movieId = vodId.split("/").pop()?.split("?")[0] || vodId;

        const { data: movie } = await supabase
          .from("vod_content")
          .select("*")
          .eq("id", movieId)
          .maybeSingle();

        if (!movie) {
          return new Response(JSON.stringify({
            js: { error: "Movie not found" }
          }), { headers: corsHeaders, status: 404 });
        }

        return new Response(JSON.stringify({
          js: {
            cmd: movie.stream_url,
          }
        }), { headers: corsHeaders });
      }
    }

    // Series actions
    if (action === "series" || url.pathname.includes("/series")) {
      const subAction = params.get("action") || "get_categories";

      const { data: user } = await supabase
        .from("streaming_users")
        .select("*")
        .eq("mac_address", mac)
        .maybeSingle();

      if (!user) {
        return new Response(JSON.stringify({
          js: { error: "Unauthorized" }
        }), { headers: corsHeaders, status: 401 });
      }

      if (subAction === "get_categories") {
        const { data: categories } = await supabase
          .from("series_categories")
          .select("*")
          .order("sort_order");

        const cats = (categories || []).map((cat, idx) => ({
          id: cat.id,
          title: cat.name,
          alias: cat.name.toLowerCase().replace(/\s+/g, "_"),
          number: idx + 1,
        }));

        return new Response(JSON.stringify({
          js: cats
        }), { headers: corsHeaders });
      }

      if (subAction === "get_ordered_list") {
        const category = params.get("category") || "*";
        const page = parseInt(params.get("p") || "1");
        const perPage = parseInt(params.get("cnt") || "50");

        let query = supabase
          .from("series")
          .select("*")
          .eq("status", "active");

        if (category && category !== "*") {
          query = query.eq("category_id", category);
        }

        const { data: seriesList } = await query
          .order("created_at", { ascending: false })
          .range((page - 1) * perPage, page * perPage - 1);

        const { count } = await supabase
          .from("series")
          .select("*", { count: "exact", head: true })
          .eq("status", "active");

        const seriesData = (seriesList || []).map(series => ({
          id: series.id,
          name: series.name,
          o_name: series.name,
          description: series.plot || "",
          director: series.director || "",
          actors: series.cast_names || "",
          year: series.release_date?.split("-")[0] || "",
          rating: series.rating || 0,
          genre_str: series.genre || "",
          cover: series.cover_url || "",
        }));

        return new Response(JSON.stringify({
          js: {
            data: seriesData,
            total_items: count || seriesData.length,
            max_page_items: perPage,
            cur_page: page,
          }
        }), { headers: corsHeaders });
      }
    }

    // Default: return portal info
    return new Response(JSON.stringify({
      js: {
        portal_version: "5.6.0",
        portal_name: "StreamPanel Portal",
        stb_types: ["MAG", "STB", "AURA"],
        auth_enabled: true,
      }
    }), { headers: corsHeaders });

  } catch (error) {
    console.error("Stalker Portal error:", error);
    return new Response(JSON.stringify({
      js: { error: "Internal server error" }
    }), { headers: corsHeaders, status: 500 });
  }
});

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
