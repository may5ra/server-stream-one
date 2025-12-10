import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, Cookie, X-User-Agent",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
    
    // Get MAC address from various sources (header, cookie, query param)
    let mac = params.get("mac") || params.get("stb_mac") || "";
    
    // Also check cookies for MAC
    const cookies = req.headers.get("Cookie") || "";
    const macCookie = cookies.match(/mac=([^;]+)/);
    if (!mac && macCookie) {
      mac = decodeURIComponent(macCookie[1]);
    }
    
    // Also check Authorization header
    const authHeader = req.headers.get("Authorization") || "";
    if (!mac && authHeader.startsWith("MAC ")) {
      mac = authHeader.substring(4);
    }
    
    // Normalize MAC - remove colons/dashes and uppercase
    mac = mac.replace(/[:-]/g, "").toUpperCase();
    
    // Stalker uses "type" parameter for main action, "action" for sub-action
    const type = params.get("type") || "";
    const action = params.get("action") || "";
    const sn = params.get("sn") || "";
    
    console.log(`Stalker Portal request: type=${type}, action=${action}, mac=${mac}, path=${url.pathname}`);

    // Handle /c/ paths - the STB sends requests to /c/ endpoint
    const pathParts = url.pathname.split("/").filter(Boolean);
    let effectiveType = type;
    
    // If path contains type info like /c/type.php
    if (pathParts.length > 0) {
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart.endsWith(".php")) {
        effectiveType = lastPart.replace(".php", "");
      }
    }

    // Handshake - return token (no type specified or handshake action)
    if ((!effectiveType && !action) || action === "handshake") {
      return new Response(JSON.stringify({
        js: {
          token: generateToken(),
          random: Math.random().toString(36).substring(7),
        }
      }), { headers: corsHeaders });
    }

    // STB actions
    if (effectiveType === "stb") {
      if (action === "handshake") {
        return new Response(JSON.stringify({
          js: {
            token: generateToken(),
            random: Math.random().toString(36).substring(7),
          }
        }), { headers: corsHeaders });
      }

      // For get_profile and do_auth, we need MAC
      if (action === "get_profile" || action === "do_auth") {
        if (!mac) {
          console.log("No MAC provided for auth");
          return new Response(JSON.stringify({
            js: {
              id: 0,
              name: "Guest",
              mac: "",
              status: 0,
              exp_date: 0,
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
            js: {
              id: 0,
              name: "Unknown",
              mac: mac,
              status: 0,
              exp_date: 0,
            }
          }), { headers: corsHeaders });
        }

        // Check expiry
        const expiryDate = new Date(user.expiry_date);
        if (expiryDate < new Date()) {
          return new Response(JSON.stringify({
            js: {
              id: user.id,
              name: user.username,
              mac: mac,
              status: 0,
              exp_date: Math.floor(expiryDate.getTime() / 1000),
              msg: "Subscription expired"
            }
          }), { headers: corsHeaders });
        }

        // Update last active
        await supabase
          .from("streaming_users")
          .update({ last_active: new Date().toISOString() })
          .eq("id", user.id);

        return new Response(JSON.stringify({
          js: {
            id: user.id,
            name: user.username,
            mac: mac,
            status: 1,
            exp_date: Math.floor(expiryDate.getTime() / 1000),
            phone: "",
            max_connections: user.max_connections || 1,
            tariff_plan_name: "Premium",
            tariff_expired: 0,
          }
        }), { headers: corsHeaders });
      }
    }

    // ITV (Live TV) actions
    if (effectiveType === "itv") {
      // Auth check for ITV
      let user = null;
      if (mac) {
        const { data } = await supabase
          .from("streaming_users")
          .select("*")
          .eq("mac_address", mac)
          .maybeSingle();
        user = data;
      }

      if (action === "get_genres") {
        const { data: categories } = await supabase
          .from("live_categories")
          .select("*")
          .order("sort_order");

        const genres = (categories || []).map((cat, idx) => ({
          id: cat.id,
          title: cat.name,
          alias: cat.name.toLowerCase().replace(/\s+/g, "_"),
          number: String(idx + 1),
          censored: 0,
        }));

        // Add "All" category
        genres.unshift({
          id: "*",
          title: "All",
          alias: "all",
          number: "0",
          censored: 0,
        });

        return new Response(JSON.stringify({
          js: genres
        }), { headers: corsHeaders });
      }

      if (action === "get_all_channels" || action === "get_ordered_list") {
        const genre = params.get("genre") || "*";
        const page = parseInt(params.get("p") || "1");
        const perPage = parseInt(params.get("cnt") || "14");
        const sortby = params.get("sortby") || "number";
        
        let query = supabase
          .from("streams")
          .select("*")
          .eq("status", "active");

        if (genre && genre !== "*") {
          query = query.eq("category", genre);
        }

        // Filter by user bouquets if user exists and has bouquets
        if (user?.bouquets && user.bouquets.length > 0) {
          query = query.in("bouquet", user.bouquets);
        }

        const { data: streams } = await query
          .order("channel_number")
          .range((page - 1) * perPage, page * perPage - 1);

        const { count } = await supabase
          .from("streams")
          .select("*", { count: "exact", head: true })
          .eq("status", "active");

        // Get server URL for stream links - use the original server
        const serverUrl = req.headers.get("X-Forwarded-Host") || req.headers.get("Host") || "38.180.100.86";
        const protocol = req.headers.get("X-Forwarded-Proto") || "http";
        const baseUrl = `${protocol}://${serverUrl}`;

        const channels = (streams || []).map((stream, idx) => ({
          id: stream.id,
          name: stream.name,
          number: stream.channel_number || idx + 1,
          logo: stream.stream_icon || "",
          // Use the local server URL for streaming
          cmd: `ffrt http://localhost/live/${stream.id}`,
          tv_genre_id: stream.category || "*",
          xmltv_id: stream.epg_channel_id || "",
          use_http_tmp_link: 1,
          censored: 0,
          status: 1,
        }));

        return new Response(JSON.stringify({
          js: {
            data: channels,
            total_items: count || channels.length,
            max_page_items: perPage,
            selected_item: 0,
            cur_page: page,
          }
        }), { headers: corsHeaders });
      }

      if (action === "create_link") {
        const cmd = params.get("cmd") || "";
        // Extract stream ID from cmd
        const match = cmd.match(/live\/([^\/\s]+)/);
        const streamId = match ? match[1] : cmd;

        console.log(`Creating link for stream: ${streamId}`);

        const { data: stream } = await supabase
          .from("streams")
          .select("*")
          .eq("id", streamId)
          .maybeSingle();

        if (!stream) {
          console.log(`Stream not found: ${streamId}`);
          return new Response(JSON.stringify({
            js: { 
              cmd: "",
              error: "Channel not found" 
            }
          }), { headers: corsHeaders });
        }

        console.log(`Returning stream URL: ${stream.input_url}`);

        return new Response(JSON.stringify({
          js: {
            cmd: stream.input_url,
          }
        }), { headers: corsHeaders });
      }
    }

    // EPG actions
    if (effectiveType === "epg") {
      const channelId = params.get("ch_id") || params.get("id") || "";
      const period = parseInt(params.get("period") || "24");

      if (action === "get_simple_data_table") {
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
          t_time: new Date(prog.start_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
          t_time_to: new Date(prog.end_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
          start_timestamp: Math.floor(new Date(prog.start_time).getTime() / 1000),
          stop_timestamp: Math.floor(new Date(prog.end_time).getTime() / 1000),
        }));

        return new Response(JSON.stringify({
          js: {
            data: epgData,
          }
        }), { headers: corsHeaders });
      }
    }

    // VOD actions
    if (effectiveType === "vod") {
      let user = null;
      if (mac) {
        const { data } = await supabase
          .from("streaming_users")
          .select("*")
          .eq("mac_address", mac)
          .maybeSingle();
        user = data;
      }

      if (action === "get_categories") {
        const { data: categories } = await supabase
          .from("vod_categories")
          .select("*")
          .order("sort_order");

        const cats = (categories || []).map((cat, idx) => ({
          id: cat.id,
          title: cat.name,
          alias: cat.name.toLowerCase().replace(/\s+/g, "_"),
          number: String(idx + 1),
          censored: 0,
        }));

        return new Response(JSON.stringify({
          js: cats
        }), { headers: corsHeaders });
      }

      if (action === "get_ordered_list") {
        const category = params.get("category") || "*";
        const page = parseInt(params.get("p") || "1");
        const perPage = parseInt(params.get("cnt") || "14");

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
          rating_imdb: movie.rating || 0,
          genre_str: movie.genre || "",
          screenshot_uri: movie.cover_url || "",
          cmd: `ffrt http://localhost/movie/${movie.id}`,
          time: movie.duration ? String(movie.duration) : "0",
        }));

        return new Response(JSON.stringify({
          js: {
            data: vodList,
            total_items: count || vodList.length,
            max_page_items: perPage,
            selected_item: 0,
            cur_page: page,
          }
        }), { headers: corsHeaders });
      }

      if (action === "create_link") {
        const cmd = params.get("cmd") || "";
        const match = cmd.match(/movie\/([^\/\s]+)/);
        const movieId = match ? match[1] : cmd;

        const { data: movie } = await supabase
          .from("vod_content")
          .select("*")
          .eq("id", movieId)
          .maybeSingle();

        if (!movie) {
          return new Response(JSON.stringify({
            js: { cmd: "", error: "Movie not found" }
          }), { headers: corsHeaders });
        }

        return new Response(JSON.stringify({
          js: {
            cmd: movie.stream_url,
          }
        }), { headers: corsHeaders });
      }
    }

    // Series actions
    if (effectiveType === "series") {
      let user = null;
      if (mac) {
        const { data } = await supabase
          .from("streaming_users")
          .select("*")
          .eq("mac_address", mac)
          .maybeSingle();
        user = data;
      }

      if (action === "get_categories") {
        const { data: categories } = await supabase
          .from("series_categories")
          .select("*")
          .order("sort_order");

        const cats = (categories || []).map((cat, idx) => ({
          id: cat.id,
          title: cat.name,
          alias: cat.name.toLowerCase().replace(/\s+/g, "_"),
          number: String(idx + 1),
          censored: 0,
        }));

        return new Response(JSON.stringify({
          js: cats
        }), { headers: corsHeaders });
      }

      if (action === "get_ordered_list") {
        const category = params.get("category") || "*";
        const page = parseInt(params.get("p") || "1");
        const perPage = parseInt(params.get("cnt") || "14");

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
          rating_imdb: series.rating || 0,
          genre_str: series.genre || "",
          screenshot_uri: series.cover_url || "",
        }));

        return new Response(JSON.stringify({
          js: {
            data: seriesData,
            total_items: count || seriesData.length,
            max_page_items: perPage,
            selected_item: 0,
            cur_page: page,
          }
        }), { headers: corsHeaders });
      }
    }

    // Watchdog/settings actions
    if (effectiveType === "watchdog" || effectiveType === "account_info" || effectiveType === "main_menu") {
      return new Response(JSON.stringify({
        js: {}
      }), { headers: corsHeaders });
    }

    // Default: return portal info
    console.log(`Unknown request: type=${effectiveType}, action=${action}`);
    return new Response(JSON.stringify({
      js: {
        token: generateToken(),
        random: Math.random().toString(36).substring(7),
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
