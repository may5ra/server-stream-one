import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StreamingUser {
  id: string;
  username: string;
  password: string;
  status: string;
  max_connections: number;
  expiry_date: string;
  created_at?: string;
}

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
  
  // Get action and credentials
  const username = params.get("username");
  const password = params.get("password");
  const action = params.get("action");
  
  // Get server info from settings
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

  const serverUrl = serverIpSetting?.value || url.hostname;
  const httpPort = httpPortSetting?.value || "80";
  const baseUrl = `http://${serverUrl}:${httpPort}`;

  console.log(`[Xtream API] Action: ${action}, Username: ${username}`);

  // Authenticate user
  async function authenticateUser(): Promise<StreamingUser | null> {
    if (!username || !password) return null;
    
    const { data: user, error } = await supabase
      .from("streaming_users")
      .select("*")
      .eq("username", username)
      .eq("password", password)
      .single();
    
    if (error || !user) {
      console.log(`[Xtream API] Auth failed for ${username}`);
      return null;
    }
    
    // Check expiry
    if (new Date(user.expiry_date) < new Date()) {
      console.log(`[Xtream API] User ${username} expired`);
      return null;
    }
    
    return user;
  }

  // User info response (authentication check)
  async function getUserInfo(user: StreamingUser) {
    const now = new Date();
    const expiry = new Date(user.expiry_date);
    
    return {
      user_info: {
        username: user.username,
        password: user.password,
        message: "Welcome to StreamPanel",
        auth: 1,
        status: user.status === "online" ? "Active" : "Disabled",
        exp_date: Math.floor(expiry.getTime() / 1000).toString(),
        is_trial: "0",
        active_cons: "0",
        created_at: Math.floor(new Date(user.created_at || now).getTime() / 1000).toString(),
        max_connections: user.max_connections.toString(),
        allowed_output_formats: ["m3u8", "ts", "rtmp"],
      },
      server_info: {
        url: serverUrl,
        port: httpPort,
        https_port: "443",
        server_protocol: "http",
        rtmp_port: "1935",
        timezone: "Europe/Zagreb",
        timestamp_now: Math.floor(now.getTime() / 1000),
        time_now: now.toISOString(),
      },
    };
  }

  // Get live categories
  async function getLiveCategories() {
    const { data: categories } = await supabase
      .from("live_categories")
      .select("*")
      .order("sort_order");
    
    // Also get unique categories from streams
    const { data: streamCategories } = await supabase
      .from("streams")
      .select("category")
      .not("category", "is", null);
    
    const uniqueCategories = [...new Set(streamCategories?.map(s => s.category) || [])];
    
    const result = (categories || []).map((cat, idx) => ({
      category_id: cat.id,
      category_name: cat.name,
      parent_id: 0,
    }));
    
    // Add stream categories that are not in live_categories
    uniqueCategories.forEach((cat, idx) => {
      if (cat && !result.find(r => r.category_name === cat)) {
        result.push({
          category_id: `cat_${idx}`,
          category_name: cat,
          parent_id: 0,
        });
      }
    });
    
    return result;
  }

  // Get live streams
  async function getLiveStreams(categoryId?: string) {
    let query = supabase
      .from("streams")
      .select("*")
      .eq("status", "live")
      .order("channel_number");
    
    if (categoryId) {
      query = query.eq("category", categoryId);
    }
    
    const { data: streams } = await query;
    
    return (streams || []).map((stream, idx) => ({
      num: stream.channel_number || idx + 1,
      name: stream.name,
      stream_type: "live",
      stream_id: stream.id,
      stream_icon: stream.stream_icon || "",
      epg_channel_id: stream.epg_channel_id || stream.name.toLowerCase().replace(/\s+/g, ""),
      added: Math.floor(new Date(stream.created_at).getTime() / 1000).toString(),
      category_id: stream.category || "1",
      custom_sid: "",
      tv_archive: stream.dvr_enabled ? 1 : 0,
      direct_source: "",
      tv_archive_duration: stream.dvr_duration || 0,
    }));
  }

  // Get VOD categories
  async function getVodCategories() {
    const { data: categories } = await supabase
      .from("vod_categories")
      .select("*")
      .order("sort_order");
    
    return (categories || []).map(cat => ({
      category_id: cat.id,
      category_name: cat.name,
      parent_id: 0,
    }));
  }

  // Get VOD streams
  async function getVodStreams(categoryId?: string) {
    let query = supabase
      .from("vod_content")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });
    
    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }
    
    const { data: vods } = await query;
    
    return (vods || []).map((vod, idx) => ({
      num: idx + 1,
      name: vod.name,
      stream_type: "movie",
      stream_id: vod.id,
      stream_icon: vod.cover_url || "",
      rating: vod.rating?.toString() || "0",
      rating_5based: vod.rating ? (vod.rating / 2).toFixed(1) : "0",
      added: Math.floor(new Date(vod.created_at).getTime() / 1000).toString(),
      category_id: vod.category_id || "",
      container_extension: vod.container_extension || "mp4",
      custom_sid: "",
      direct_source: "",
    }));
  }

  // Get VOD info
  async function getVodInfo(vodId: string) {
    const { data: vod } = await supabase
      .from("vod_content")
      .select("*")
      .eq("id", vodId)
      .single();
    
    if (!vod) return { info: {}, movie_data: {} };
    
    return {
      info: {
        movie_image: vod.cover_url || "",
        tmdb_id: vod.tmdb_id?.toString() || "",
        name: vod.name,
        o_name: vod.name,
        plot: vod.plot || "",
        cast: vod.cast_names || "",
        director: vod.director || "",
        genre: vod.genre || "",
        releasedate: vod.release_date || "",
        duration_secs: (vod.duration || 0) * 60,
        duration: vod.duration ? `${Math.floor(vod.duration / 60)}:${vod.duration % 60}` : "",
        video: {},
        audio: {},
        bitrate: 0,
        rating: vod.rating?.toString() || "",
      },
      movie_data: {
        stream_id: vod.id,
        name: vod.name,
        added: Math.floor(new Date(vod.created_at).getTime() / 1000).toString(),
        category_id: vod.category_id || "",
        container_extension: vod.container_extension || "mp4",
        custom_sid: "",
        direct_source: "",
      },
    };
  }

  // Get series categories
  async function getSeriesCategories() {
    const { data: categories } = await supabase
      .from("series_categories")
      .select("*")
      .order("sort_order");
    
    return (categories || []).map(cat => ({
      category_id: cat.id,
      category_name: cat.name,
      parent_id: 0,
    }));
  }

  // Get series list
  async function getSeriesList(categoryId?: string) {
    let query = supabase
      .from("series")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });
    
    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }
    
    const { data: seriesList } = await query;
    
    return (seriesList || []).map((series, idx) => ({
      num: idx + 1,
      name: series.name,
      series_id: series.id,
      cover: series.cover_url || "",
      plot: series.plot || "",
      cast: series.cast_names || "",
      director: series.director || "",
      genre: series.genre || "",
      releaseDate: series.release_date || "",
      rating: series.rating?.toString() || "0",
      rating_5based: series.rating ? (series.rating / 2).toFixed(1) : "0",
      category_id: series.category_id || "",
      tmdb: series.tmdb_id?.toString() || "",
    }));
  }

  // Get series info with episodes
  async function getSeriesInfo(seriesId: string) {
    const { data: series } = await supabase
      .from("series")
      .select("*")
      .eq("id", seriesId)
      .single();
    
    if (!series) return { info: {}, episodes: {} };
    
    const { data: episodes } = await supabase
      .from("series_episodes")
      .select("*")
      .eq("series_id", seriesId)
      .order("season_number")
      .order("episode_number");
    
    // Group episodes by season
    const episodesBySeason: Record<string, any[]> = {};
    (episodes || []).forEach(ep => {
      const seasonKey = ep.season_number.toString();
      if (!episodesBySeason[seasonKey]) {
        episodesBySeason[seasonKey] = [];
      }
      episodesBySeason[seasonKey].push({
        id: ep.id,
        episode_num: ep.episode_number,
        title: ep.title || `Episode ${ep.episode_number}`,
        container_extension: ep.container_extension || "mp4",
        info: {
          movie_image: ep.cover_url || series.cover_url || "",
          plot: ep.plot || "",
          duration_secs: (ep.duration || 0) * 60,
        },
        custom_sid: "",
        added: Math.floor(new Date(ep.created_at).getTime() / 1000).toString(),
        season: ep.season_number,
        direct_source: "",
      });
    });
    
    return {
      info: {
        name: series.name,
        cover: series.cover_url || "",
        plot: series.plot || "",
        cast: series.cast_names || "",
        director: series.director || "",
        genre: series.genre || "",
        releaseDate: series.release_date || "",
        rating: series.rating?.toString() || "",
        tmdb_id: series.tmdb_id?.toString() || "",
        category_id: series.category_id || "",
      },
      episodes: episodesBySeason,
    };
  }

  // Get short EPG (current and next)
  async function getShortEpg(streamId: string, limit: number = 2) {
    const { data: channel } = await supabase
      .from("epg_channels")
      .select("*")
      .eq("stream_id", streamId)
      .single();
    
    if (!channel) return { epg_listings: [] };
    
    const now = new Date();
    const { data: programs } = await supabase
      .from("epg_programs")
      .select("*")
      .eq("channel_id", channel.id)
      .gte("end_time", now.toISOString())
      .order("start_time")
      .limit(limit);
    
    return {
      epg_listings: (programs || []).map(prog => ({
        id: prog.id,
        epg_id: channel.epg_channel_id,
        title: prog.title,
        lang: "hr",
        start: new Date(prog.start_time).toISOString().replace("T", " ").slice(0, 19),
        end: new Date(prog.end_time).toISOString().replace("T", " ").slice(0, 19),
        description: prog.description || "",
        channel_id: channel.epg_channel_id,
        start_timestamp: Math.floor(new Date(prog.start_time).getTime() / 1000).toString(),
        stop_timestamp: Math.floor(new Date(prog.end_time).getTime() / 1000).toString(),
      })),
    };
  }

  // Get full EPG for a stream
  async function getSimpleDataTable(streamId: string) {
    const { data: channel } = await supabase
      .from("epg_channels")
      .select("*")
      .eq("stream_id", streamId)
      .single();
    
    if (!channel) return { epg_listings: [] };
    
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    const { data: programs } = await supabase
      .from("epg_programs")
      .select("*")
      .eq("channel_id", channel.id)
      .gte("start_time", now.toISOString())
      .lte("start_time", tomorrow.toISOString())
      .order("start_time");
    
    return {
      epg_listings: (programs || []).map(prog => ({
        id: prog.id,
        epg_id: channel.epg_channel_id,
        title: prog.title,
        lang: "hr",
        start: new Date(prog.start_time).toISOString().replace("T", " ").slice(0, 19),
        end: new Date(prog.end_time).toISOString().replace("T", " ").slice(0, 19),
        description: prog.description || "",
        channel_id: channel.epg_channel_id,
        start_timestamp: Math.floor(new Date(prog.start_time).getTime() / 1000).toString(),
        stop_timestamp: Math.floor(new Date(prog.end_time).getTime() / 1000).toString(),
      })),
    };
  }

  try {
    // Handle player_api.php style requests
    if (!action) {
      // Basic auth check - return user info
      const user = await authenticateUser();
      if (!user) {
        return new Response(JSON.stringify({ user_info: { auth: 0 } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(await getUserInfo(user)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All other actions require authentication
    const user = await authenticateUser();
    if (!user) {
      return new Response(JSON.stringify({ user_info: { auth: 0 } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any;
    
    switch (action) {
      case "get_live_categories":
        result = await getLiveCategories();
        break;
      
      case "get_live_streams":
        result = await getLiveStreams(params.get("category_id") || undefined);
        break;
      
      case "get_vod_categories":
        result = await getVodCategories();
        break;
      
      case "get_vod_streams":
        result = await getVodStreams(params.get("category_id") || undefined);
        break;
      
      case "get_vod_info":
        result = await getVodInfo(params.get("vod_id") || "");
        break;
      
      case "get_series_categories":
        result = await getSeriesCategories();
        break;
      
      case "get_series":
        result = await getSeriesList(params.get("category_id") || undefined);
        break;
      
      case "get_series_info":
        result = await getSeriesInfo(params.get("series_id") || "");
        break;
      
      case "get_short_epg":
        result = await getShortEpg(params.get("stream_id") || "", parseInt(params.get("limit") || "2"));
        break;
      
      case "get_simple_data_table":
        result = await getSimpleDataTable(params.get("stream_id") || "");
        break;
      
      default:
        result = await getUserInfo(user);
    }

    console.log(`[Xtream API] Action ${action} completed successfully`);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Xtream API] Error:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
