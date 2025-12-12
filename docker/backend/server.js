const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Database connection with connection pooling optimization
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// ==================== PERFORMANCE CACHE ====================
// In-memory cache for fast stream/user lookups (reduces DB queries from 5 to 0 for cached requests)
const streamCache = new Map(); // name -> {input_url, load_balancer_id, lb_ip, lb_port, cachedAt}
const userCache = new Map(); // username -> {user, cachedAt}
const lbCache = new Map(); // id -> {ip_address, nginx_port}
const CACHE_TTL = 10000; // 10 seconds cache - short TTL for quick status updates

// Helper function for getting default manifest filename
function getDefaultFile(inputUrl) {
  if (inputUrl.includes('.mpd') || inputUrl.toLowerCase().includes('dash')) {
    return 'manifest.mpd';
  }
  return 'index.m3u8';
}

function getCachedStream(name) {
  const cached = streamCache.get(name);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedStream(name, data) {
  streamCache.set(name, { data, cachedAt: Date.now() });
}

function invalidateStreamCache(name) {
  streamCache.delete(name);
  console.log(`[Cache] Invalidated stream cache: ${name}`);
}

function invalidateAllStreamCache() {
  streamCache.clear();
  console.log('[Cache] Invalidated all stream cache');
}

function getCachedUser(username) {
  const cached = userCache.get(username);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedUser(username, data) {
  userCache.set(username, { data, cachedAt: Date.now() });
}

function invalidateUserCache(username) {
  userCache.delete(username);
}

// Clear expired cache entries every 5 minutes
// Clear expired cache entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of streamCache) {
    if (now - value.cachedAt > CACHE_TTL) streamCache.delete(key);
  }
  for (const [key, value] of userCache) {
    if (now - value.cachedAt > CACHE_TTL) userCache.delete(key);
  }
}, 300000);

// ==================== CACHE PRE-WARMING ====================
// Load all streams and users into cache at startup for instant access
async function prewarmCache() {
  try {
    console.log('[Cache] Pre-warming cache...');
    
    // Load all load balancers first
    const lbResult = await pool.query(
      "SELECT id, ip_address, nginx_port FROM load_balancers WHERE status = 'active'"
    );
    for (const lb of lbResult.rows) {
      lbCache.set(lb.id, { ip_address: lb.ip_address, nginx_port: lb.nginx_port || 8080 });
    }
    console.log(`[Cache] Loaded ${lbResult.rows.length} load balancers`);
    
    // Load all active streams with LB info
    const streamsResult = await pool.query(
      "SELECT s.name, s.input_url, s.status, s.load_balancer_id, lb.ip_address as lb_ip, lb.nginx_port as lb_port FROM streams s LEFT JOIN load_balancers lb ON s.load_balancer_id = lb.id WHERE s.status != 'error'"
    );
    for (const stream of streamsResult.rows) {
      setCachedStream(stream.name, stream);
    }
    console.log(`[Cache] Loaded ${streamsResult.rows.length} streams`);
    
    // Load all active streaming users
    const usersResult = await pool.query(
      "SELECT * FROM streaming_users WHERE status != 'disabled'"
    );
    for (const user of usersResult.rows) {
      setCachedUser(user.username, user);
    }
    console.log(`[Cache] Loaded ${usersResult.rows.length} users`);
    
    console.log('[Cache] Pre-warming complete!');
  } catch (error) {
    console.error('[Cache] Pre-warming failed:', error.message);
  }
}

// Refresh cache every 30 seconds to keep it warm
setInterval(async () => {
  try {
    // Refresh load balancers
    const lbResult = await pool.query(
      "SELECT id, ip_address, nginx_port FROM load_balancers WHERE status = 'active'"
    );
    lbCache.clear();
    for (const lb of lbResult.rows) {
      lbCache.set(lb.id, { ip_address: lb.ip_address, nginx_port: lb.nginx_port || 8080 });
    }
    
    // Refresh streams with LB info
    const streamsResult = await pool.query(
      "SELECT s.name, s.input_url, s.status, s.load_balancer_id, lb.ip_address as lb_ip, lb.nginx_port as lb_port FROM streams s LEFT JOIN load_balancers lb ON s.load_balancer_id = lb.id WHERE s.status != 'error'"
    );
    for (const stream of streamsResult.rows) {
      setCachedStream(stream.name, stream);
    }
    
    const usersResult = await pool.query(
      "SELECT * FROM streaming_users WHERE status != 'disabled'"
    );
    for (const user of usersResult.rows) {
      setCachedUser(user.username, user);
    }
  } catch (error) {
    console.error('[Cache] Refresh failed:', error.message);
  }
}, 30000);

// Middleware
app.use(cors());
app.use(express.json());

// Debug middleware - log ALL incoming requests
app.use((req, res, next) => {
  console.log(`[DEBUG] ${req.method} ${req.path} - Query: ${JSON.stringify(req.query)}`);
  next();
});

// Stalker Portal API section starts below - routes defined after handler function

// ==================== STALKER PORTAL API (MUST BE BEFORE CATCH-ALL ROUTES) ====================
// Compatible with MAG devices and Stalker middleware

function generateStalkerToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Main Stalker Portal handler
async function handleStalkerRequest(req, res) {
  try {
    const type = req.query.type || '';
    const action = req.query.action || '';
    
    // Extract MAC address from various sources
    let mac = req.query.mac || 
              req.headers['x-stb-mac'] || 
              req.cookies?.mac ||
              '';
    
    // Clean MAC address
    mac = mac.replace(/%3A/gi, ':').toUpperCase();
    
    console.log(`[Stalker] Request: type=${type}, action=${action}, mac=${mac}`);
    
    // Handle handshake
    if (type === 'stb' && action === 'handshake') {
      return res.json({
        js: { token: generateStalkerToken() }
      });
    }
    
    // Handle auth
    if (type === 'stb' && action === 'do_auth') {
      if (!mac) {
        return res.json({ js: { error: 'No MAC address provided' } });
      }
      
      // Find user by MAC
      const userResult = await pool.query(
        'SELECT * FROM streaming_users WHERE mac_address = $1',
        [mac]
      );
      
      if (userResult.rows.length === 0) {
        return res.json({ js: { error: 'Device not registered' } });
      }
      
      const user = userResult.rows[0];
      
      // Check expiry
      if (new Date(user.expiry_date) < new Date()) {
        return res.json({ js: { error: 'Subscription expired' } });
      }
      
      return res.json({ js: true });
    }
    
    // Get profile
    if (type === 'stb' && action === 'get_profile') {
      if (!mac) {
        return res.json({
          js: {
            id: 1,
            name: 'Guest',
            login: '',
            password: '',
            parent_password: '0000',
            status: 0,
            sname: '',
            stb_type: 'MAG250',
            mac: '',
            fav_channels: [],
            theme: 'default'
          }
        });
      }
      
      const userResult = await pool.query(
        'SELECT * FROM streaming_users WHERE mac_address = $1',
        [mac]
      );
      
      if (userResult.rows.length === 0) {
        return res.json({ js: { error: 'Device not registered' } });
      }
      
      const user = userResult.rows[0];
      
      return res.json({
        js: {
          id: parseInt(user.id.replace(/-/g, '').slice(0, 8), 16) || 1,
          name: user.username,
          login: user.username,
          password: user.password,
          parent_password: '0000',
          status: user.status === 'active' ? 1 : 0,
          sname: user.username,
          stb_type: 'MAG250',
          mac: mac,
          fav_channels: [],
          theme: 'default'
        }
      });
    }
    
    // Get live TV genres/categories
    if (type === 'itv' && action === 'get_genres') {
      const result = await pool.query('SELECT id, name, sort_order FROM live_categories ORDER BY sort_order');
      
      const genres = result.rows.map((cat, idx) => ({
        id: cat.id,
        title: cat.name,
        alias: cat.name.toLowerCase().replace(/\s+/g, '_'),
        number: cat.sort_order || idx + 1,
        censored: '0'
      }));
      
      return res.json({ js: genres });
    }
    
    // Get live TV channels
    if (type === 'itv' && (action === 'get_all_channels' || action === 'get_ordered_list')) {
      const genre = req.query.genre || '';
      const p = parseInt(req.query.p) || 1;
      
      let query = 'SELECT s.*, lc.name as category_name FROM streams s LEFT JOIN live_categories lc ON s.category = lc.id WHERE 1=1';
      const params = [];
      
      if (genre && genre !== '*') {
        params.push(genre);
        query += ` AND s.category = $${params.length}`;
      }
      
      query += ' ORDER BY s.channel_number ASC NULLS LAST, s.name ASC';
      
      const result = await pool.query(query, params);
      
      const serverDomain = process.env.SERVER_DOMAIN || req.hostname;
      const httpPort = process.env.HTTP_PORT || '80';
      const portSuffix = (httpPort !== '80') ? `:${httpPort}` : '';
      
      const channels = result.rows.map((stream, idx) => ({
        id: stream.id,
        name: stream.name,
        number: stream.channel_number || (idx + 1),
        cmd: `http://${serverDomain}${portSuffix}/live/${encodeURIComponent(stream.name)}`,
        tv_genre_id: stream.category || '',
        logo: stream.stream_icon || '',
        epg: stream.epg_channel_id || '',
        added: stream.created_at,
        modified: stream.updated_at,
        status: stream.status === 'live' ? 1 : 0,
        censored: 0,
        use_http_tmp_link: 0,
        allow_pvr: 1,
        allow_local_pvr: 1,
        allow_local_timeshift: 1
      }));
      
      return res.json({
        js: {
          total_items: channels.length,
          max_page_items: 20,
          selected_item: 0,
          cur_page: p,
          data: channels
        }
      });
    }
    
    // Get EPG
    if (type === 'itv' && action === 'get_epg_info') {
      return res.json({ js: { data: [] } });
    }
    
    // Get VOD categories
    if (type === 'vod' && action === 'get_categories') {
      const result = await pool.query('SELECT id, name, sort_order FROM vod_categories ORDER BY sort_order');
      
      const categories = result.rows.map((cat, idx) => ({
        id: cat.id,
        title: cat.name,
        alias: cat.name.toLowerCase().replace(/\s+/g, '_'),
        number: cat.sort_order || idx + 1,
        censored: '0'
      }));
      
      return res.json({ js: categories });
    }
    
    // Get VOD content
    if (type === 'vod' && action === 'get_ordered_list') {
      const category = req.query.category || '';
      const p = parseInt(req.query.p) || 1;
      
      let query = 'SELECT * FROM vod_content WHERE 1=1';
      const params = [];
      
      if (category && category !== '*') {
        params.push(category);
        query += ` AND category_id = $${params.length}`;
      }
      
      query += ' ORDER BY name ASC';
      
      const result = await pool.query(query, params);
      
      const serverDomain = process.env.SERVER_DOMAIN || req.hostname;
      const httpPort = process.env.HTTP_PORT || '80';
      const portSuffix = (httpPort !== '80') ? `:${httpPort}` : '';
      
      const movies = result.rows.map((vod) => ({
        id: vod.id,
        name: vod.name,
        o_name: vod.name,
        description: vod.plot || '',
        director: vod.director || '',
        actors: vod.cast_names || '',
        year: vod.release_date ? new Date(vod.release_date).getFullYear() : '',
        rating_imdb: vod.rating || 0,
        rating_kinopoisk: 0,
        genres_str: vod.genre || '',
        cover: vod.cover_url || '',
        cmd: `http://${serverDomain}${portSuffix}/vod/${vod.id}`,
        added: vod.added || vod.created_at,
        time: vod.duration || 0,
        status: 1,
        category_id: vod.category_id || ''
      }));
      
      return res.json({
        js: {
          total_items: movies.length,
          max_page_items: 14,
          selected_item: 0,
          cur_page: p,
          data: movies
        }
      });
    }
    
    // Get series categories
    if (type === 'series' && action === 'get_categories') {
      const result = await pool.query('SELECT id, name, sort_order FROM series_categories ORDER BY sort_order');
      
      const categories = result.rows.map((cat, idx) => ({
        id: cat.id,
        title: cat.name,
        alias: cat.name.toLowerCase().replace(/\s+/g, '_'),
        number: cat.sort_order || idx + 1,
        censored: '0'
      }));
      
      return res.json({ js: categories });
    }
    
    // Get series list
    if (type === 'series' && action === 'get_ordered_list') {
      const category = req.query.category || '';
      const p = parseInt(req.query.p) || 1;
      
      let query = 'SELECT * FROM series WHERE 1=1';
      const params = [];
      
      if (category && category !== '*') {
        params.push(category);
        query += ` AND category_id = $${params.length}`;
      }
      
      query += ' ORDER BY name ASC';
      
      const result = await pool.query(query, params);
      
      const seriesList = result.rows.map((s) => ({
        id: s.id,
        name: s.name,
        o_name: s.name,
        description: s.plot || '',
        director: s.director || '',
        actors: s.cast_names || '',
        year: s.release_date ? new Date(s.release_date).getFullYear() : '',
        rating_imdb: s.rating || 0,
        genres_str: s.genre || '',
        cover: s.cover_url || '',
        status: 1,
        category_id: s.category_id || ''
      }));
      
      return res.json({
        js: {
          total_items: seriesList.length,
          max_page_items: 14,
          selected_item: 0,
          cur_page: p,
          data: seriesList
        }
      });
    }
    
    // Watchdog
    if (type === 'watchdog' && action === 'get_events') {
      return res.json({ js: { data: [] } });
    }
    
    // Account info
    if (type === 'account_info' && action === 'get_main_info') {
      if (!mac) {
        return res.json({ js: { error: 'No MAC address' } });
      }
      
      const userResult = await pool.query(
        'SELECT * FROM streaming_users WHERE mac_address = $1',
        [mac]
      );
      
      if (userResult.rows.length === 0) {
        return res.json({ js: { error: 'User not found' } });
      }
      
      const user = userResult.rows[0];
      
      return res.json({
        js: {
          mac: mac,
          phone: '',
          login: user.username,
          tariff_plan: 'Standard',
          tariff_expired: new Date(user.expiry_date).toISOString().split('T')[0],
          tariff_end_date: new Date(user.expiry_date).toISOString().split('T')[0],
          account_balance: 0,
          fname: '',
          lname: ''
        }
      });
    }
    
    // Main menu
    if (type === 'main_menu') {
      return res.json({
        js: [
          { id: 'tv', title: 'TV', icon: 'tv' },
          { id: 'vod', title: 'Video Club', icon: 'vod' },
          { id: 'series', title: 'Series', icon: 'series' },
          { id: 'settings', title: 'Settings', icon: 'settings' }
        ]
      });
    }
    
    // Default empty response
    console.log(`[Stalker] Unhandled: type=${type}, action=${action}`);
    return res.json({ js: {} });
    
  } catch (error) {
    console.error('[Stalker] Error:', error);
    return res.status(500).json({ js: { error: error.message } });
  }
}

// Stalker Portal routes - ALL routes MUST be after handleStalkerRequest function!
app.all('/c', handleStalkerRequest);
app.all('/c/', handleStalkerRequest);
app.all('/stalker-portal', handleStalkerRequest);
app.all('/stalker-portal/', handleStalkerRequest);
app.all('/stalker', handleStalkerRequest);
app.all('/stalker/', handleStalkerRequest);

// Live stream for MAG devices (before catch-all)
app.get('/live/:streamName', async (req, res) => {
  try {
    const { streamName } = req.params;
    const decodedName = decodeURIComponent(streamName);
    
    console.log(`[Live] MAG request for: ${decodedName}`);
    
    // Get stream (case-insensitive match on name)
    const result = await pool.query('SELECT input_url FROM streams WHERE LOWER(name) = LOWER($1)', [decodedName]);
    
    if (result.rows.length === 0) {
      return res.status(404).send('Stream not found');
    }
    
    // Redirect to source or proxy
    const inputUrl = result.rows[0].input_url;
    
    // For HLS, redirect directly
    if (inputUrl.includes('.m3u8')) {
      return res.redirect(302, inputUrl);
    }
    
    // For other streams, proxy through existing mechanism
    res.redirect(302, `/proxy/${encodeURIComponent(streamName)}/index.m3u8`);
    
  } catch (error) {
    console.error('[Live] Error:', error);
    res.status(500).send('Stream error');
  }
});

// VOD stream for MAG devices (before catch-all)
app.get('/vod/:vodId', async (req, res) => {
  try {
    const { vodId } = req.params;
    
    console.log(`[VOD] MAG request for: ${vodId}`);
    
    const result = await pool.query('SELECT stream_url FROM vod_content WHERE id = $1', [vodId]);
    
    if (result.rows.length === 0) {
      return res.status(404).send('VOD not found');
    }
    
    // Redirect to source
    res.redirect(302, result.rows[0].stream_url);
    
  } catch (error) {
    console.error('[VOD] Error:', error);
    res.status(500).send('VOD error');
  }
});

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// ==================== AUTH ROUTES ====================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    
    // Log login activity
    await pool.query(
      'INSERT INTO activity_logs (action, details, ip_address) VALUES ($1, $2, $3)',
      ['login', JSON.stringify({ email: user.email }), req.ip || req.connection.remoteAddress]
    ).catch(() => {});
    
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, role',
      [email, hashedPassword]
    );
    
    const token = jwt.sign({ id: result.rows[0].id, email, role: 'user' }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: result.rows[0] });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== STREAMS ROUTES ====================

app.get('/api/streams', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM streams ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/streams', authenticateToken, async (req, res) => {
  try {
    const { name, input_type, input_url, category, bouquet, channel_number, output_formats, bitrate, resolution, webvtt_enabled, webvtt_url, webvtt_language, webvtt_label, dvr_enabled, dvr_duration, abr_enabled, stream_icon, epg_channel_id } = req.body;
    
    const result = await pool.query(
      `INSERT INTO streams (name, input_type, input_url, category, bouquet, channel_number, output_formats, bitrate, resolution, webvtt_enabled, webvtt_url, webvtt_language, webvtt_label, dvr_enabled, dvr_duration, abr_enabled, stream_icon, epg_channel_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`,
      [name, input_type, input_url, category, bouquet, channel_number, output_formats, bitrate, resolution, webvtt_enabled, webvtt_url, webvtt_language, webvtt_label, dvr_enabled, dvr_duration, abr_enabled, stream_icon, epg_channel_id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/streams/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const setClause = Object.keys(updates).map((key, i) => `${key} = $${i + 2}`).join(', ');
    const values = [id, ...Object.values(updates)];
    
    const result = await pool.query(
      `UPDATE streams SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      values
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/streams/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM streams WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== STREAMS SYNC (from Supabase) ====================

app.post('/api/streams/sync', async (req, res) => {
  try {
    const { streams } = req.body;
    
    console.log(`[Sync] Received ${streams?.length || 0} streams to sync`);
    
    if (!Array.isArray(streams)) {
      return res.status(400).json({ error: 'Streams array required' });
    }
    
    let synced = 0, errors = [];
    
    for (const stream of streams) {
      // Log WebVTT data for each stream
      if (stream.webvtt_enabled) {
        console.log(`[Sync] WebVTT stream: ${stream.name}, url=${stream.webvtt_url}, label=${stream.webvtt_label}`);
      }
      try {
        await pool.query(`
          INSERT INTO streams (id, name, input_type, input_url, category, bouquet, channel_number, output_formats, bitrate, resolution, webvtt_enabled, webvtt_url, webvtt_language, webvtt_label, dvr_enabled, dvr_duration, abr_enabled, stream_icon, epg_channel_id, status, viewers, load_balancer_id, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            input_type = EXCLUDED.input_type,
            input_url = EXCLUDED.input_url,
            category = EXCLUDED.category,
            bouquet = EXCLUDED.bouquet,
            channel_number = EXCLUDED.channel_number,
            output_formats = EXCLUDED.output_formats,
            bitrate = EXCLUDED.bitrate,
            resolution = EXCLUDED.resolution,
            webvtt_enabled = EXCLUDED.webvtt_enabled,
            webvtt_url = EXCLUDED.webvtt_url,
            webvtt_language = EXCLUDED.webvtt_language,
            webvtt_label = EXCLUDED.webvtt_label,
            dvr_enabled = EXCLUDED.dvr_enabled,
            dvr_duration = EXCLUDED.dvr_duration,
            abr_enabled = EXCLUDED.abr_enabled,
            stream_icon = EXCLUDED.stream_icon,
            epg_channel_id = EXCLUDED.epg_channel_id,
            status = EXCLUDED.status,
            load_balancer_id = EXCLUDED.load_balancer_id,
            updated_at = NOW()
        `, [
          stream.id,
          stream.name,
          stream.input_type || 'hls',
          stream.input_url,
          stream.category || null,
          stream.bouquet || null,
          stream.channel_number || null,
          stream.output_formats || ['hls'],
          stream.bitrate || 4500,
          stream.resolution || '1920x1080',
          stream.webvtt_enabled || false,
          stream.webvtt_url || null,
          stream.webvtt_language || 'hr',
          stream.webvtt_label || null,
          stream.dvr_enabled || false,
          stream.dvr_duration || 24,
          stream.abr_enabled || false,
          stream.stream_icon || null,
          stream.epg_channel_id || null,
          stream.status || 'inactive',
          stream.viewers || 0,
          stream.load_balancer_id || null,
          stream.created_at || new Date().toISOString()
        ]);
        synced++;
      } catch (err) {
        errors.push({ name: stream.name, error: err.message });
      }
    }
    
    // Refresh cache after sync
    await prewarmCache();
    
    console.log(`[Sync] Synced ${synced} streams`);
    res.json({ success: true, synced, errors });
  } catch (error) {
    console.error('[Sync] Streams error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/streams/sync-one', async (req, res) => {
  try {
    const stream = req.body;
    
    // Enhanced logging for WebVTT and LB debugging
    console.log(`[Sync-One] Received stream: ${stream.name}`);
    console.log(`[Sync-One] WebVTT data: enabled=${stream.webvtt_enabled}, url=${stream.webvtt_url}, label=${stream.webvtt_label}`);
    console.log(`[Sync-One] LB: ${stream.load_balancer_id || 'none'}`);
    
    await pool.query(`
      INSERT INTO streams (id, name, input_type, input_url, category, bouquet, channel_number, output_formats, bitrate, resolution, webvtt_enabled, webvtt_url, webvtt_language, webvtt_label, dvr_enabled, dvr_duration, abr_enabled, stream_icon, epg_channel_id, status, viewers, load_balancer_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        input_type = EXCLUDED.input_type,
        input_url = EXCLUDED.input_url,
        category = EXCLUDED.category,
        bouquet = EXCLUDED.bouquet,
        channel_number = EXCLUDED.channel_number,
        output_formats = EXCLUDED.output_formats,
        bitrate = EXCLUDED.bitrate,
        resolution = EXCLUDED.resolution,
        webvtt_enabled = EXCLUDED.webvtt_enabled,
        webvtt_url = EXCLUDED.webvtt_url,
        webvtt_language = EXCLUDED.webvtt_language,
        webvtt_label = EXCLUDED.webvtt_label,
        dvr_enabled = EXCLUDED.dvr_enabled,
        dvr_duration = EXCLUDED.dvr_duration,
        abr_enabled = EXCLUDED.abr_enabled,
        stream_icon = EXCLUDED.stream_icon,
        epg_channel_id = EXCLUDED.epg_channel_id,
        status = EXCLUDED.status,
        load_balancer_id = EXCLUDED.load_balancer_id,
        updated_at = NOW()
    `, [
      stream.id,
      stream.name,
      stream.input_type || 'hls',
      stream.input_url,
      stream.category || null,
      stream.bouquet || null,
      stream.channel_number || null,
      stream.output_formats || ['hls'],
      stream.bitrate || 4500,
      stream.resolution || '1920x1080',
      stream.webvtt_enabled || false,
      stream.webvtt_url || null,
      stream.webvtt_language || 'hr',
      stream.webvtt_label || null,
      stream.dvr_enabled || false,
      stream.dvr_duration || 24,
      stream.abr_enabled || false,
      stream.stream_icon || null,
      stream.epg_channel_id || null,
      stream.status || 'inactive',
      stream.viewers || 0,
      stream.load_balancer_id || null
    ]);
    
    // Invalidate cache for this stream immediately
    invalidateStreamCache(stream.name);
    
    console.log(`[Sync] Synced stream: ${stream.name}, status: ${stream.status || 'inactive'}, webvtt=${stream.webvtt_enabled || false}, lb=${stream.load_balancer_id || 'none'}`);
    res.json({ success: true, synced: stream.name, webvtt_enabled: stream.webvtt_enabled || false });
  } catch (error) {
    console.error('[Sync] Stream error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/streams/sync/:id', async (req, res) => {
  try {
    // Get stream name before delete for cache invalidation
    const streamResult = await pool.query('SELECT name FROM streams WHERE id = $1', [req.params.id]);
    
    await pool.query('DELETE FROM streams WHERE id = $1', [req.params.id]);
    
    // Invalidate cache
    if (streamResult.rows.length > 0) {
      invalidateStreamCache(streamResult.rows[0].name);
    }
    
    console.log(`[Sync] Deleted stream: ${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete stream by name (fallback for sync issues)
app.delete('/api/streams/sync-by-name/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    await pool.query('DELETE FROM streams WHERE name = $1', [name]);
    invalidateStreamCache(name);
    console.log(`[Sync] Deleted stream by name: ${name}`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clean up streams not in the provided list (full sync)
app.post('/api/streams/cleanup', async (req, res) => {
  try {
    const { validIds } = req.body;
    
    if (!validIds || !Array.isArray(validIds)) {
      return res.status(400).json({ error: 'validIds array required' });
    }
    
    // Delete all streams NOT in the valid list
    let deleted = 0;
    if (validIds.length === 0) {
      // Delete all streams
      const result = await pool.query('DELETE FROM streams');
      deleted = result.rowCount;
    } else {
      const result = await pool.query(
        'DELETE FROM streams WHERE id != ALL($1::uuid[])',
        [validIds]
      );
      deleted = result.rowCount;
    }
    
    // Clear all stream cache
    invalidateAllStreamCache();
    
    console.log(`[Sync] Cleanup deleted ${deleted} orphan streams`);
    res.json({ success: true, deleted });
  } catch (error) {
    console.error('[Sync] Cleanup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== LOAD BALANCERS SYNC ====================

// Sync load balancers from Supabase
app.post('/api/load-balancers/sync', async (req, res) => {
  try {
    const { loadBalancers } = req.body;
    
    console.log(`[Sync] Received ${loadBalancers?.length || 0} load balancers to sync`);
    
    if (!Array.isArray(loadBalancers)) {
      return res.status(400).json({ error: 'loadBalancers array required' });
    }
    
    let synced = 0, errors = [];
    
    for (const lb of loadBalancers) {
      try {
        await pool.query(`
          INSERT INTO load_balancers (id, name, ip_address, port, nginx_port, status, max_streams, ssh_username, ssh_password, last_deploy, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            ip_address = EXCLUDED.ip_address,
            port = EXCLUDED.port,
            nginx_port = EXCLUDED.nginx_port,
            status = EXCLUDED.status,
            max_streams = EXCLUDED.max_streams,
            ssh_username = EXCLUDED.ssh_username,
            ssh_password = EXCLUDED.ssh_password,
            last_deploy = EXCLUDED.last_deploy,
            updated_at = NOW()
        `, [
          lb.id,
          lb.name,
          lb.ip_address,
          lb.port || 80,
          lb.nginx_port || 8080,
          lb.status || 'active',
          lb.max_streams || 100,
          lb.ssh_username || null,
          lb.ssh_password || null,
          lb.last_deploy || null,
          lb.created_at || new Date().toISOString()
        ]);
        synced++;
      } catch (err) {
        errors.push({ name: lb.name, error: err.message });
      }
    }
    
    // Refresh LB cache
    const lbResult = await pool.query(
      "SELECT id, ip_address, nginx_port FROM load_balancers WHERE status = 'active'"
    );
    lbCache.clear();
    for (const lb of lbResult.rows) {
      lbCache.set(lb.id, { ip_address: lb.ip_address, nginx_port: lb.nginx_port || 8080 });
    }
    
    console.log(`[Sync] Synced ${synced} load balancers`);
    res.json({ success: true, synced, errors });
  } catch (error) {
    console.error('[Sync] Load balancers error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== STREAMING USERS ROUTES ====================

app.get('/api/streaming-users', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM streaming_users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/streaming-users', authenticateToken, async (req, res) => {
  try {
    const { username, password, max_connections, expiry_date, reseller_id } = req.body;
    
    const result = await pool.query(
      `INSERT INTO streaming_users (username, password, max_connections, expiry_date, reseller_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [username, password, max_connections, expiry_date, reseller_id]
    );
    
    // Log activity
    await pool.query(
      'INSERT INTO activity_logs (action, details, ip_address) VALUES ($1, $2, $3)',
      ['user_created', JSON.stringify({ username }), req.ip || req.connection.remoteAddress]
    ).catch(() => {});
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/streaming-users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const setClause = Object.keys(updates).map((key, i) => `${key} = $${i + 2}`).join(', ');
    const values = [id, ...Object.values(updates)];
    
    const result = await pool.query(
      `UPDATE streaming_users SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      values
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/streaming-users/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM streaming_users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== STREAMING USERS SYNC (from Supabase) ====================

app.post('/api/streaming-users/sync', async (req, res) => {
  try {
    const { users } = req.body;
    
    if (!Array.isArray(users)) {
      return res.status(400).json({ error: 'Users array required' });
    }
    
    let synced = 0, errors = [];
    
    for (const user of users) {
      try {
        await pool.query(`
          INSERT INTO streaming_users (id, username, password, max_connections, expiry_date, status, connections, reseller_id, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO UPDATE SET
            username = EXCLUDED.username,
            password = EXCLUDED.password,
            max_connections = EXCLUDED.max_connections,
            expiry_date = EXCLUDED.expiry_date,
            status = EXCLUDED.status,
            reseller_id = EXCLUDED.reseller_id,
            updated_at = NOW()
        `, [
          user.id,
          user.username,
          user.password,
          user.max_connections || 1,
          user.expiry_date,
          user.status || 'offline',
          user.connections || 0,
          user.reseller_id || null,
          user.created_at || new Date().toISOString()
        ]);
        synced++;
      } catch (err) {
        errors.push({ username: user.username, error: err.message });
      }
    }
    
    console.log(`[Sync] Synced ${synced} streaming users`);
    res.json({ success: true, synced, errors });
  } catch (error) {
    console.error('[Sync] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/streaming-users/sync-one', async (req, res) => {
  try {
    const user = req.body;
    
    await pool.query(`
      INSERT INTO streaming_users (id, username, password, max_connections, expiry_date, status, connections, reseller_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        password = EXCLUDED.password,
        max_connections = EXCLUDED.max_connections,
        expiry_date = EXCLUDED.expiry_date,
        status = EXCLUDED.status,
        reseller_id = EXCLUDED.reseller_id,
        updated_at = NOW()
    `, [
      user.id,
      user.username,
      user.password,
      user.max_connections || 1,
      user.expiry_date,
      user.status || 'offline',
      user.connections || 0,
      user.reseller_id || null
    ]);
    
    console.log(`[Sync] Synced user: ${user.username}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[Sync] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/streaming-users/sync/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM streaming_users WHERE id = $1', [req.params.id]);
    console.log(`[Sync] Deleted user: ${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/player_api.php', async (req, res) => {
  try {
    const { username, password, action } = req.query;
    
    // Authenticate streaming user
    const userResult = await pool.query(
      'SELECT * FROM streaming_users WHERE username = $1 AND password = $2',
      [username, password]
    );
    
    if (userResult.rows.length === 0) {
      return res.json({ user_info: { auth: 0 } });
    }
    
    const user = userResult.rows[0];
    
    // Check expiry
    if (new Date(user.expiry_date) < new Date()) {
      return res.json({ user_info: { auth: 0, status: 'Expired' } });
    }
    
    const settingsResult = await pool.query('SELECT key, value FROM panel_settings');
    const settings = {};
    settingsResult.rows.forEach(row => { settings[row.key] = row.value; });
    
    // No action = return user info
    if (!action) {
      return res.json({
        user_info: {
          username: user.username,
          password: user.password,
          auth: 1,
          status: 'Active',
          exp_date: Math.floor(new Date(user.expiry_date).getTime() / 1000).toString(),
          is_trial: '0',
          active_cons: user.connections?.toString() || '0',
          created_at: Math.floor(new Date(user.created_at).getTime() / 1000).toString(),
          max_connections: user.max_connections?.toString() || '1',
          allowed_output_formats: ['m3u8', 'ts', 'rtmp'],
        },
        server_info: {
          url: settings.server_domain || 'localhost',
          port: settings.http_port || '80',
          https_port: settings.https_port || '443',
          server_protocol: 'http',
          rtmp_port: settings.rtmp_port || '1935',
          timezone: 'Europe/Zagreb',
          timestamp_now: Math.floor(Date.now() / 1000),
          time_now: new Date().toISOString(),
        }
      });
    }
    
    // Handle different actions
    switch (action) {
      case 'get_live_categories': {
        const result = await pool.query('SELECT DISTINCT category FROM streams WHERE category IS NOT NULL');
        const categories = result.rows.map((row, index) => ({
          category_id: `cat_${index}`,
          category_name: row.category,
          parent_id: 0
        }));
        return res.json(categories);
      }
      
      case 'get_live_streams': {
        const result = await pool.query('SELECT * FROM streams WHERE status != $1', ['error']);
        const streams = result.rows.map((stream, index) => ({
          num: stream.channel_number || index + 1,
          name: stream.name,
          stream_type: 'live',
          stream_id: stream.id,
          stream_icon: stream.stream_icon || '',
          epg_channel_id: stream.epg_channel_id || '',
          added: Math.floor(new Date(stream.created_at).getTime() / 1000).toString(),
          category_id: stream.category || '',
          custom_sid: '',
          tv_archive: stream.dvr_enabled ? 1 : 0,
          direct_source: '',
          tv_archive_duration: stream.dvr_duration || 0
        }));
        return res.json(streams);
      }
      
      case 'get_vod_categories': {
        const result = await pool.query('SELECT * FROM vod_categories ORDER BY sort_order');
        const categories = result.rows.map(row => ({
          category_id: row.id,
          category_name: row.name,
          parent_id: 0
        }));
        return res.json(categories);
      }
      
      case 'get_vod_streams': {
        const result = await pool.query('SELECT * FROM vod_content WHERE status = $1', ['active']);
        const vods = result.rows.map(vod => ({
          num: 1,
          name: vod.name,
          stream_type: 'movie',
          stream_id: vod.id,
          stream_icon: vod.cover_url || '',
          rating: vod.rating?.toString() || '',
          added: Math.floor(new Date(vod.added || vod.created_at).getTime() / 1000).toString(),
          category_id: vod.category_id || '',
          container_extension: vod.container_extension || 'mp4',
          custom_sid: '',
          direct_source: ''
        }));
        return res.json(vods);
      }
      
      case 'get_series_categories': {
        const result = await pool.query('SELECT * FROM series_categories ORDER BY sort_order');
        const categories = result.rows.map(row => ({
          category_id: row.id,
          category_name: row.name,
          parent_id: 0
        }));
        return res.json(categories);
      }
      
      case 'get_series': {
        const result = await pool.query('SELECT * FROM series WHERE status = $1', ['active']);
        const seriesList = result.rows.map(s => ({
          num: 1,
          name: s.name,
          series_id: s.id,
          cover: s.cover_url || '',
          plot: s.plot || '',
          cast: s.cast_names || '',
          director: s.director || '',
          genre: s.genre || '',
          rating: s.rating?.toString() || '',
          releaseDate: s.release_date || '',
          category_id: s.category_id || ''
        }));
        return res.json(seriesList);
      }
      
      default:
        return res.json({ error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Xtream API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== M3U PLAYLIST ====================

app.get('/get.php', async (req, res) => {
  try {
    const { username, password, type, output } = req.query;
    
    // Authenticate
    const userResult = await pool.query(
      'SELECT * FROM streaming_users WHERE username = $1 AND password = $2',
      [username, password]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).send('Invalid credentials');
    }
    
    const user = userResult.rows[0];
    if (new Date(user.expiry_date) < new Date()) {
      return res.status(401).send('Account expired');
    }
    
    // Get settings from DB first, then fall back to env variables
    let serverDomain, httpPort, protocol;
    
    try {
      const settingsResult = await pool.query('SELECT key, value FROM panel_settings');
      const settings = {};
      settingsResult.rows.forEach(row => { settings[row.key] = row.value; });
      
      // Priority: X-Forwarded-Host (from nginx with actual client IP) > settings > env > request host
      // X-Forwarded-Host contains the actual host the client used (e.g., 38.180.100.86)
      const forwardedHost = req.headers['x-forwarded-host']?.split(':')[0];
      const requestHost = req.headers.host?.split(':')[0] || req.hostname;
      
      // IMPORTANT: Prefer X-Forwarded-Host over settings because it reflects the actual server IP
      // Only use settings.server_domain if it's explicitly set and not empty/localhost
      const settingsDomain = settings.server_domain && 
                            settings.server_domain !== '' && 
                            settings.server_domain !== 'localhost' ? settings.server_domain : null;
      
      serverDomain = forwardedHost || settingsDomain || process.env.SERVER_DOMAIN || requestHost;
      httpPort = settings.http_port || process.env.HTTP_PORT || '80';
      protocol = (settings.ssl_enabled === 'true' || req.headers['x-forwarded-proto'] === 'https') ? 'https' : 'http';
    } catch (e) {
      // Fallback if DB query fails
      const forwardedHost = req.headers['x-forwarded-host']?.split(':')[0];
      serverDomain = forwardedHost || process.env.SERVER_DOMAIN || req.headers.host?.split(':')[0] || 'localhost';
      httpPort = process.env.HTTP_PORT || '80';
      protocol = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    }
    
    // Build base URL - only include port if not default
    let baseUrl;
    if ((protocol === 'http' && httpPort === '80') || (protocol === 'https' && httpPort === '443')) {
      baseUrl = `${protocol}://${serverDomain}`;
    } else {
      baseUrl = `${protocol}://${serverDomain}:${httpPort}`;
    }
    
    let playlist = '#EXTM3U\n';
    
    // Live streams - order by bouquet (country), then category, then channel number
    const streams = await pool.query(
      'SELECT * FROM streams WHERE status != $1 ORDER BY bouquet NULLS LAST, category NULLS LAST, channel_number NULLS LAST',
      ['error']
    );
    
    for (const stream of streams.rows) {
      // Use bouquet for group-title (country grouping like "Slovenia", "Croatia")
      // Falls back to category if bouquet is not set
      const groupTitle = stream.bouquet || stream.category || 'Uncategorized';
      
      playlist += `#EXTINF:-1 tvg-id="${stream.epg_channel_id || ''}" tvg-name="${stream.name}" tvg-logo="${stream.stream_icon || ''}" group-title="${groupTitle}",${stream.name}\n`;
      
      const encodedName = encodeURIComponent(stream.name);
      
      // ALWAYS use FFmpeg TS format - this is the working format with no buffering!
      // /live/StreamName.ts?username=X&password=X
      playlist += `${baseUrl}/live/${encodedName}.ts?username=${username}&password=${password}\n`;
    }
    
    res.setHeader('Content-Type', 'audio/x-mpegurl');
    res.setHeader('Content-Disposition', `attachment; filename="${username}_playlist.m3u"`);
    res.send(playlist);
  } catch (error) {
    console.error('Playlist error:', error);
    res.status(500).send('Error generating playlist');
  }
});

// ==================== M3U IMPORT ====================

app.post('/api/m3u-import', authenticateToken, async (req, res) => {
  try {
    const { m3u_content, m3u_url, default_category, overwrite_existing } = req.body;
    
    let content = m3u_content;
    
    if (m3u_url && !m3u_content) {
      const response = await fetch(m3u_url);
      content = await response.text();
    }
    
    if (!content) {
      return res.status(400).json({ error: 'No M3U content provided' });
    }
    
    const entries = parseM3U(content);
    
    let imported = 0, skipped = 0, updated = 0;
    const errors = [];
    
    for (const entry of entries) {
      try {
        const existing = await pool.query(
          'SELECT id FROM streams WHERE name = $1 OR input_url = $2',
          [entry.name, entry.url]
        );
        
        const streamData = {
          name: entry.name,
          input_type: detectInputType(entry.url),
          input_url: entry.url,
          category: entry.group_title || default_category || null,
          stream_icon: entry.tvg_logo || null,
          epg_channel_id: entry.tvg_id || null,
          channel_number: entry.channel_number || null,
        };
        
        if (existing.rows.length > 0) {
          if (overwrite_existing) {
            await pool.query(
              `UPDATE streams SET name=$1, input_type=$2, input_url=$3, category=$4, stream_icon=$5, epg_channel_id=$6, channel_number=$7, updated_at=NOW() WHERE id=$8`,
              [...Object.values(streamData), existing.rows[0].id]
            );
            updated++;
          } else {
            skipped++;
          }
        } else {
          await pool.query(
            `INSERT INTO streams (name, input_type, input_url, category, stream_icon, epg_channel_id, channel_number) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            Object.values(streamData)
          );
          imported++;
        }
      } catch (err) {
        errors.push(`Error processing ${entry.name}: ${err.message}`);
      }
    }
    
    res.json({ success: true, total: entries.length, imported, updated, skipped, errors: errors.slice(0, 10) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function parseM3U(content) {
  const entries = [];
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  let current = {};
  
  for (const line of lines) {
    if (line.startsWith('#EXTINF:')) {
      const tvgId = line.match(/tvg-id="([^"]*)"/i)?.[1];
      const tvgName = line.match(/tvg-name="([^"]*)"/i)?.[1];
      const tvgLogo = line.match(/tvg-logo="([^"]*)"/i)?.[1];
      const groupTitle = line.match(/group-title="([^"]*)"/i)?.[1];
      const channelNumber = line.match(/tvg-chno="([^"]*)"/i)?.[1];
      const name = line.split(',').pop()?.trim();
      
      current = { name: name || tvgName || 'Unknown', tvg_id: tvgId, tvg_logo: tvgLogo, group_title: groupTitle, channel_number: channelNumber ? parseInt(channelNumber) : null };
    } else if (!line.startsWith('#') && current.name) {
      current.url = line;
      entries.push(current);
      current = {};
    }
  }
  
  return entries;
}

function detectInputType(url) {
  const lower = url.toLowerCase();
  if (lower.includes('rtmp://')) return 'rtmp';
  if (lower.includes('rtsp://')) return 'rtsp';
  if (lower.includes('srt://')) return 'srt';
  if (lower.includes('udp://')) return 'udp';
  return 'hls';
}

// ==================== SERVERS, SETTINGS, etc. ====================

app.get('/api/servers', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM servers ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/settings', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM panel_settings');
    const settings = {};
    result.rows.forEach(row => { settings[row.key] = row.value; });
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/settings', authenticateToken, async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      await pool.query(
        'INSERT INTO panel_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()',
        [key, value]
      );
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ACTIVITY LOGGING ====================

async function logActivity(action, details = {}, ipAddress = null) {
  try {
    await pool.query(
      'INSERT INTO activity_logs (action, details, ip_address) VALUES ($1, $2, $3)',
      [action, JSON.stringify(details), ipAddress]
    );
  } catch (err) {
    console.error('[Activity] Log error:', err.message);
  }
}

// ==================== CONNECTION TRACKING ====================
// Track active connections per user with session IDs
const activeConnections = new Map(); // userId -> Map<sessionId, { streamName, lastSeen }>

// Cleanup old sessions every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [userId, sessions] of activeConnections.entries()) {
    for (const [sessionId, data] of sessions.entries()) {
      // Remove sessions inactive for more than 30 seconds
      if (now - data.lastSeen > 30000) {
        sessions.delete(sessionId);
        console.log(`[Connections] Removed stale session ${sessionId} for user ${userId}`);
      }
    }
    // Update database with current connection count
    if (sessions.size >= 0) {
      pool.query(
        'UPDATE streaming_users SET connections = $1, status = $2, updated_at = NOW() WHERE id = $3',
        [sessions.size, sessions.size > 0 ? 'online' : 'offline', userId]
      ).catch(err => console.error('[Connections] DB update error:', err));
    }
    if (sessions.size === 0) {
      activeConnections.delete(userId);
    }
  }
}, 30000);

// Get or create session ID from request
function getSessionId(req) {
  // Use IP + User-Agent as session identifier
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  return `${ip}_${ua.substring(0, 50)}`.replace(/[^a-zA-Z0-9_]/g, '');
}

// ==================== UNIFIED STREAM PROXY (OPTIMIZED) ====================
// Handles both authenticated (/proxy/user/pass/stream/file) and legacy (/proxy/stream/file)
// OPTIMIZATIONS:
// - In-memory cache for streams and users (reduces DB queries from 5 to 0)
// - Async DB updates (don't block response)
// - Connection reuse
// - Minimal logging for .ts segments

app.get('/proxy/*', async (req, res) => {
  try {
    const fullPath = req.params[0];
    const parts = fullPath.split('/');
    
    let username = null;
    let password = null;
    let streamName = null;
    let filePath = 'index.m3u8';
    let isAuthenticated = false;
    let user = null;
    
    // FIRST: Check if this is a legacy format (streamName/path)
    // Legacy format: /proxy/StreamName/index.m3u8 or /proxy/StreamName/b64/xxx
    // Auth format: /proxy/username/password/StreamName/path
    
    // Detect if second part looks like "b64" or a file - that means legacy format
    const secondPart = parts[1] || '';
    const isLegacyFormat = parts.length >= 2 && (
      secondPart === 'b64' || 
      secondPart.startsWith('b64/') ||
      secondPart.endsWith('.m3u8') ||
      secondPart.endsWith('.ts') ||
      secondPart.endsWith('.m4s') ||
      secondPart.endsWith('.mpd') ||
      secondPart === 'index.m3u8'
    );
    
    if (isLegacyFormat) {
      // Legacy format: streamName/filePath
      streamName = parts[0];
      filePath = parts.slice(1).join('/') || 'index.m3u8';
      console.log(`[Proxy] Legacy format detected: stream=${streamName}, file=${filePath.substring(0, 50)}`);
    } else if (parts.length >= 3) {
      // Try authenticated format
      const potentialUsername = parts[0];
      const potentialPassword = parts[1];
      
      // Try cache first for user lookup
      let cachedUser = getCachedUser(potentialUsername);
      
      if (cachedUser) {
        // Fast path: user in cache
        if (cachedUser.password === potentialPassword) {
          isAuthenticated = true;
          username = potentialUsername;
          password = potentialPassword;
          user = cachedUser;
          streamName = parts[2];
          filePath = parts.slice(3).join('/') || 'index.m3u8';
        }
      } else {
        // Slow path: check DB
        const userResult = await pool.query(
          'SELECT * FROM streaming_users WHERE username = $1',
          [potentialUsername]
        );
        
        if (userResult.rows.length > 0) {
          const dbUser = userResult.rows[0];
          setCachedUser(potentialUsername, dbUser);
          
          if (dbUser.password === potentialPassword) {
            isAuthenticated = true;
            username = potentialUsername;
            password = potentialPassword;
            user = dbUser;
            streamName = parts[2];
            filePath = parts.slice(3).join('/') || 'index.m3u8';
          }
        }
      }
      
      // If auth failed, treat as legacy format
      if (!isAuthenticated) {
        streamName = parts[0];
        filePath = parts.slice(1).join('/') || 'index.m3u8';
      }
    } else {
      // Simple format: just streamName
      streamName = parts[0];
      filePath = parts.slice(1).join('/') || 'index.m3u8';
    }
    
    // Detect segment vs manifest - check both filePath AND decoded b64 URL
    let isSegment = filePath.endsWith('.ts') || filePath.endsWith('.m4s') || 
                    filePath.endsWith('.m4a') || filePath.endsWith('.aac') ||
                    filePath.endsWith('.mp4');
    
    // If b64 encoded, check the actual URL extension
    if (filePath.startsWith('b64/')) {
      try {
        const encoded = filePath.substring(4);
        const decodedUrl = Buffer.from(decodeURIComponent(encoded), 'base64').toString('utf-8').toLowerCase();
        isSegment = decodedUrl.endsWith('.ts') || decodedUrl.endsWith('.m4s') ||
                    decodedUrl.endsWith('.m4a') || decodedUrl.endsWith('.aac') ||
                    decodedUrl.endsWith('.mp4');
      } catch (e) {
        // Ignore decode errors, will be handled later
      }
    }
    
    if (!isSegment) {
      console.log(`[Proxy] ${isAuthenticated ? 'Auth' : 'Legacy'}: stream=${streamName}, file=${filePath}`);
    }
    
    // Handle authenticated requests with connection limiting
    if (isAuthenticated && user) {
      // Check expiry
      if (new Date(user.expiry_date) < new Date()) {
        console.log(`[Proxy] Account expired for: ${username}`);
        return res.status(403).json({ error: 'Account expired' });
      }
      
      const maxConnections = user.max_connections || 1;
      const sessionId = getSessionId(req);
      
      // Get or create user's connection map
      if (!activeConnections.has(user.id)) {
        activeConnections.set(user.id, new Map());
      }
      const userSessions = activeConnections.get(user.id);
      
      // Check if this is an existing session or new one
      const isExistingSession = userSessions.has(sessionId);
      
      // Only check connection limit for main playlist requests and new sessions
      if ((filePath === 'index.m3u8' || filePath === 'index.ts') && !isExistingSession) {
        if (userSessions.size >= maxConnections) {
          console.log(`[Proxy] Connection limit reached for ${username}: ${userSessions.size}/${maxConnections}`);
          return res.status(429).json({ 
            error: 'Connection limit reached', 
            current: userSessions.size, 
            max: maxConnections 
          });
        }
      }
      
      // Update session tracking (sync - fast)
      const existingSession = userSessions.get(sessionId);
      userSessions.set(sessionId, {
        streamName,
        lastSeen: Date.now(),
        startTime: existingSession?.startTime || Date.now(),
        ip: req.ip || req.connection.remoteAddress,
        username
      });
      
      // ASYNC: Update database without blocking response
      if (!isSegment) {
        pool.query(
          'UPDATE streaming_users SET connections = $1, last_active = NOW(), status = $2, updated_at = NOW() WHERE id = $3',
          [userSessions.size, 'online', user.id]
        ).catch(err => console.error('[Proxy] DB update error:', err));
        
        // Log stream start activity (async)
        if (!isExistingSession) {
          logActivity('stream_start', { 
            username, 
            streamName: decodeURIComponent(streamName),
            connections: userSessions.size 
          }, req.ip || req.connection.remoteAddress);
        }
      }
    }
    
    // Look up stream - try cache first
    const decodedStreamName = decodeURIComponent(streamName);
    let stream = getCachedStream(decodedStreamName);
    
    if (!stream) {
      const streamResult = await pool.query(
        'SELECT input_url, name, status FROM streams WHERE name = $1',
        [decodedStreamName]
      );
      
      if (streamResult.rows.length === 0) {
        console.log(`[Proxy] Stream not found: ${streamName}`);
        return res.status(404).json({ error: 'Stream not found', streamName });
      }
      
      stream = streamResult.rows[0];
      setCachedStream(decodedStreamName, stream);
    }
    
    // NOTE: Stream status check removed from proxy
    // Status is controlled via Xtream API - if stream is not 'live', 
    // it won't appear in player's channel list (get_live_streams returns only status='live')
    // This allows direct URL access even when stream is "inactive" in panel
    console.log(`[Proxy] Stream found: ${streamName}, status: ${stream.status}`);
    
    if (!stream.input_url) {
      return res.status(400).json({ error: 'Stream has no source URL' });
    }
    
    // ==================== XACCEL-STYLE DIRECT PROXY ====================
    // Use base64 encoded URLs - no path rewriting needed!
    // This is how xaccel-codec and similar panels work
    
    const inputUrl = stream.input_url.trim();
    let targetUrl;
    
    // Check if filePath is a base64 encoded URL (from our rewritten manifest)
    if (filePath.startsWith('b64/')) {
      // Decode base64 URL
      try {
        const encoded = filePath.substring(4);
        targetUrl = Buffer.from(decodeURIComponent(encoded), 'base64').toString('utf-8');
        console.log(`[Proxy] Decoded b64 URL: ${targetUrl.substring(0, 100)}...`);
      } catch (e) {
        console.error('[Proxy] Failed to decode b64 URL:', e.message);
        return res.status(400).send('Invalid encoded URL');
      }
    } else if (filePath === 'index.m3u8' || filePath === '') {
      // Main manifest - use input URL directly
      if (inputUrl.endsWith('.m3u8') || inputUrl.endsWith('.mpd')) {
        targetUrl = inputUrl;
      } else {
        targetUrl = inputUrl.replace(/\/$/, '') + '/index.m3u8';
      }
    } else {
      // Legacy: direct path (for backwards compatibility)
      const baseUrl = inputUrl.endsWith('.m3u8') || inputUrl.endsWith('.mpd')
        ? inputUrl.substring(0, inputUrl.lastIndexOf('/') + 1)
        : inputUrl.replace(/\/$/, '') + '/';
      targetUrl = baseUrl + filePath;
    }
    
    console.log(`[Proxy] ${isSegment ? 'Segment' : 'Manifest'}: ${targetUrl.substring(0, 150)}`);
    
    try {
      // Fetch with redirect following
      const response = await fetch(targetUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20',
          'Accept': '*/*',
        }
      });
      
      if (!response.ok) {
        console.error(`[Proxy] Upstream error ${response.status}: ${targetUrl.substring(0, 100)}`);
        return res.status(response.status).send('');
      }
      
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      // Helper to get content type from URL
      const getContentTypeFromUrl = (url) => {
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.endsWith('.ts')) return 'video/mp2t';
        if (lowerUrl.endsWith('.m4s')) return 'video/iso.segment';
        if (lowerUrl.endsWith('.m4a')) return 'audio/mp4';
        if (lowerUrl.endsWith('.aac')) return 'audio/aac';
        if (lowerUrl.endsWith('.mp4')) return 'video/mp4';
        if (lowerUrl.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
        if (lowerUrl.endsWith('.mpd')) return 'application/dash+xml';
        return 'application/octet-stream';
      };
      
      // For segments - direct pipe, no processing
      if (isSegment) {
        // ALWAYS use targetUrl for content type, not filePath (which might be b64 encoded)
        res.setHeader('Content-Type', getContentTypeFromUrl(targetUrl));
        res.setHeader('Cache-Control', 'max-age=86400');
        
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          res.setHeader('Content-Length', contentLength);
        }
        
        // Direct pipe
        const reader = response.body.getReader();
        const pump = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                res.end();
                break;
              }
              res.write(Buffer.from(value));
            }
          } catch (err) {
            res.end();
          }
        };
        pump();
        return;
      }
      
      // For manifests - rewrite URLs using base64 encoding
      const content = await response.text();
      
      // Build FULL URL base for proxy - PRIORITIZE X-Forwarded-Host from nginx
      const forwardedHost = req.get('x-forwarded-host');
      const hostHeader = req.get('host');
      // CRITICAL: Use forwarded host first, it contains the actual client-facing domain
      const actualHost = forwardedHost || hostHeader || process.env.SERVER_DOMAIN || 'localhost';
      const protocol = req.get('x-forwarded-proto') || 'http';
      
      // Simple: use actualHost as-is (it already includes port if needed)
      const proxyBase = `${protocol}://${actualHost}/proxy/${encodeURIComponent(streamName)}/`;
      console.log(`[Proxy] Host: ${actualHost}, Protocol: ${protocol}, ProxyBase: ${proxyBase}`);
      
      // Get base URL from final URL (after redirects)
      const finalUrl = response.url || targetUrl;
      const finalUrlBase = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);
      const finalUrlOrigin = new URL(finalUrl).origin;
      
      // Helper: check if URL is from a different domain (external CDN)
      const isExternalCdn = (url) => {
        try {
          const urlOrigin = new URL(url).origin;
          return urlOrigin !== finalUrlOrigin;
        } catch {
          return false;
        }
      };
      
      // Helper: check if it's a segment file (not manifest)
      const isSegmentFile = (url) => {
        const lower = url.toLowerCase();
        return lower.endsWith('.ts') || lower.endsWith('.aac') || 
               lower.endsWith('.m4s') || lower.endsWith('.mp4') ||
               lower.includes('/segment') || lower.includes('/chunk');
      };
      
      // Base64 encode URLs - but DON'T rewrite external CDN segment URLs
      // This helps with IP-token protected CDNs
      const lines = content.split('\n');
      const rewritten = lines.map(line => {
        const trimmed = line.trim();
        
        // Handle URI="..." in tags (audio tracks, keys, etc)
        if (trimmed.startsWith('#') && trimmed.includes('URI="')) {
          return line.replace(/URI="([^"]+)"/g, (match, uri) => {
            let fullUrl;
            if (uri.startsWith('http')) {
              fullUrl = uri;
            } else if (uri.startsWith('/')) {
              const urlObj = new URL(finalUrl);
              fullUrl = urlObj.origin + uri;
            } else {
              fullUrl = finalUrlBase + uri;
            }
            
            // DON'T proxy external CDN segments - let client fetch directly
            if (isExternalCdn(fullUrl) && isSegmentFile(fullUrl)) {
              console.log(`[Proxy] Passthrough external segment: ${fullUrl.substring(0, 80)}...`);
              return `URI="${fullUrl}"`;
            }
            
            const encoded = Buffer.from(fullUrl).toString('base64');
            return `URI="${proxyBase}b64/${encodeURIComponent(encoded)}"`;
          });
        }
        
        // Skip comments and empty lines
        if (trimmed.startsWith('#') || !trimmed) return line;
        
        // Build full URL
        let fullUrl;
        if (trimmed.startsWith('http')) {
          fullUrl = trimmed;
        } else if (trimmed.startsWith('/')) {
          const urlObj = new URL(finalUrl);
          fullUrl = urlObj.origin + trimmed;
        } else {
          fullUrl = finalUrlBase + trimmed;
        }
        
        // DON'T proxy external CDN segments - let client fetch directly
        if (isExternalCdn(fullUrl) && isSegmentFile(fullUrl)) {
          console.log(`[Proxy] Passthrough external segment: ${fullUrl.substring(0, 80)}...`);
          return fullUrl;
        }
        
        const encoded = Buffer.from(fullUrl).toString('base64');
        return proxyBase + 'b64/' + encodeURIComponent(encoded);
      });
      
      // Use targetUrl for content type detection
      res.setHeader('Content-Type', getContentTypeFromUrl(targetUrl));
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(rewritten.join('\n'));
      
    } catch (error) {
      console.error('[Proxy] Fetch error:', error.message);
      res.status(502).send('');
    }
    
  } catch (error) {
    console.error('[Proxy] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== FFMPEG RE-STREAM PROXY ====================
// For IP-protected sources like Nova - re-stream via FFmpeg (like XUI does)
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const activeFFmpegProcesses = new Map(); // streamName -> {process, clients[]}
const hlsOutputDir = path.join(os.tmpdir(), 'streampanel-hls');

// Ensure HLS directory exists
try {
  if (!fs.existsSync(hlsOutputDir)) {
    fs.mkdirSync(hlsOutputDir, { recursive: true });
  }
} catch (e) {
  console.log('[FFmpeg] Could not create HLS dir:', e.message);
}

// ==================== FFmpeg HLS Generator ====================
// Generates real HLS output for /proxy/ fallback
const activeHlsStreams = new Map(); // streamName -> {process, startTime, ready}

function startHlsStream(streamName, inputUrl) {
  const streamDir = path.join(hlsOutputDir, streamName.replace(/[^a-zA-Z0-9_-]/g, '_'));
  
  // Create stream directory
  try {
    if (!fs.existsSync(streamDir)) {
      fs.mkdirSync(streamDir, { recursive: true });
    }
  } catch (e) {
    console.error('[HLS] Failed to create dir:', e.message);
    return null;
  }
  
  const playlistPath = path.join(streamDir, 'index.m3u8');
  
  console.log(`[HLS] Starting FFmpeg for: ${streamName}`);
  console.log(`[HLS] Input: ${inputUrl}`);
  console.log(`[HLS] Output dir: ${streamDir}`);
  
  const ffmpeg = spawn('ffmpeg', [
    '-hide_banner',
    '-loglevel', 'warning',
    '-reconnect', '1',
    '-reconnect_streamed', '1', 
    '-reconnect_delay_max', '5',
    '-i', inputUrl,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-f', 'hls',
    '-hls_time', '4',
    '-hls_list_size', '5',
    '-hls_flags', 'delete_segments+append_list',
    '-hls_segment_filename', path.join(streamDir, 'segment_%03d.ts'),
    playlistPath
  ]);
  
  const hlsData = {
    process: ffmpeg,
    streamDir,
    playlistPath,
    startTime: Date.now(),
    ready: false,
    lastAccess: Date.now()
  };
  
  activeHlsStreams.set(streamName, hlsData);
  
  // Check for playlist ready
  const checkReady = setInterval(() => {
    if (fs.existsSync(playlistPath)) {
      hlsData.ready = true;
      console.log(`[HLS] Stream ready: ${streamName}`);
      clearInterval(checkReady);
    }
    // Timeout after 30 seconds
    if (Date.now() - hlsData.startTime > 30000 && !hlsData.ready) {
      console.log(`[HLS] Timeout waiting for: ${streamName}`);
      clearInterval(checkReady);
    }
  }, 500);
  
  ffmpeg.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg.includes('error') || msg.includes('Error')) {
      console.error(`[HLS] ${streamName}: ${msg}`);
    }
  });
  
  ffmpeg.on('close', (code) => {
    console.log(`[HLS] FFmpeg ended for ${streamName}, code: ${code}`);
    clearInterval(checkReady);
    activeHlsStreams.delete(streamName);
    // Cleanup files
    try {
      fs.rmSync(streamDir, { recursive: true, force: true });
    } catch (e) {}
  });
  
  ffmpeg.on('error', (err) => {
    console.error(`[HLS] FFmpeg error for ${streamName}:`, err.message);
    activeHlsStreams.delete(streamName);
  });
  
  return hlsData;
}

// Cleanup inactive HLS streams every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [name, data] of activeHlsStreams.entries()) {
    if (now - data.lastAccess > 120000) { // 2 minutes idle
      console.log(`[HLS] Stopping idle stream: ${name}`);
      try { data.process.kill('SIGTERM'); } catch (e) {}
      activeHlsStreams.delete(name);
      try { fs.rmSync(data.streamDir, { recursive: true, force: true }); } catch (e) {}
    }
  }
}, 60000);

// ==================== HLS Playlist endpoint ====================
// Serves FFmpeg-generated HLS for protected streams
app.get('/hls/:streamName/index.m3u8', async (req, res) => {
  const { streamName } = req.params;
  const decodedName = decodeURIComponent(streamName);
  
  console.log(`[HLS] Playlist request: ${decodedName}`);
  
  try {
    // Get stream URL with WebVTT data
    let stream = getCachedStream(decodedName);
    if (!stream) {
      const result = await pool.query(
        'SELECT input_url, webvtt_enabled, webvtt_url, webvtt_language, webvtt_label FROM streams WHERE name = $1', 
        [decodedName]
      );
      if (result.rows.length === 0) {
        return res.status(404).send('#EXTM3U\n#EXT-X-ERROR:Stream not found');
      }
      stream = result.rows[0];
      setCachedStream(decodedName, stream);
    }
    
    // Check if HLS stream is running
    let hlsData = activeHlsStreams.get(decodedName);
    
    if (!hlsData || !hlsData.process || hlsData.process.killed) {
      // Start new HLS stream
      hlsData = startHlsStream(decodedName, stream.input_url);
      if (!hlsData) {
        return res.status(500).send('#EXTM3U\n#EXT-X-ERROR:Failed to start stream');
      }
    }
    
    hlsData.lastAccess = Date.now();
    
    // Wait for playlist to be ready (max 10 seconds)
    let waited = 0;
    while (!hlsData.ready && waited < 10000) {
      await new Promise(r => setTimeout(r, 500));
      waited += 500;
    }
    
    if (!fs.existsSync(hlsData.playlistPath)) {
      return res.status(503).send('#EXTM3U\n#EXT-X-ERROR:Stream starting...');
    }
    
    // Read and rewrite playlist with correct segment URLs
    let playlist = fs.readFileSync(hlsData.playlistPath, 'utf8');
    
    // Rewrite segment URLs to point to our endpoint
    playlist = playlist.replace(/segment_(\d+)\.ts/g, `/hls/${encodeURIComponent(streamName)}/segment_$1.ts`);
    
    // If WebVTT is enabled, add subtitle track to master playlist
    if (stream.webvtt_enabled && stream.webvtt_url) {
      const lang = stream.webvtt_language || 'en';
      const label = stream.webvtt_label || 'Subtitles';
      
      // Check if this is a master playlist (has EXT-X-STREAM-INF) or media playlist
      if (playlist.includes('#EXT-X-TARGETDURATION')) {
        // This is a media playlist, need to create a master playlist wrapper
        const masterPlaylist = `#EXTM3U
#EXT-X-VERSION:3

#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="${label}",DEFAULT=YES,AUTOSELECT=YES,FORCED=NO,LANGUAGE="${lang}",URI="/hls/${encodeURIComponent(streamName)}/subtitles.m3u8"

#EXT-X-STREAM-INF:BANDWIDTH=5000000,SUBTITLES="subs"
/hls/${encodeURIComponent(streamName)}/media.m3u8`;
        
        // Store the original media playlist under a different name
        hlsData.mediaPlaylist = playlist;
        hlsData.hasSubtitles = true;
        hlsData.webvttUrl = stream.webvtt_url;
        hlsData.webvttLang = lang;
        
        playlist = masterPlaylist;
        console.log(`[HLS] Created master playlist with WebVTT for: ${decodedName}`);
      }
    }
    
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(playlist);
    
  } catch (error) {
    console.error('[HLS] Error:', error);
    res.status(500).send('#EXTM3U\n#EXT-X-ERROR:' + error.message);
  }
});

// Serve media playlist (for streams with subtitles)
app.get('/hls/:streamName/media.m3u8', async (req, res) => {
  const { streamName } = req.params;
  const decodedName = decodeURIComponent(streamName);
  
  const hlsData = activeHlsStreams.get(decodedName);
  if (!hlsData || !hlsData.mediaPlaylist) {
    // Fall back to reading from file
    if (hlsData && fs.existsSync(hlsData.playlistPath)) {
      let playlist = fs.readFileSync(hlsData.playlistPath, 'utf8');
      playlist = playlist.replace(/segment_(\d+)\.ts/g, `/hls/${encodeURIComponent(streamName)}/segment_$1.ts`);
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(playlist);
    }
    return res.status(404).send('#EXTM3U\n#EXT-X-ERROR:Media playlist not found');
  }
  
  hlsData.lastAccess = Date.now();
  
  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send(hlsData.mediaPlaylist);
});

// Serve WebVTT subtitle playlist
app.get('/hls/:streamName/subtitles.m3u8', async (req, res) => {
  const { streamName } = req.params;
  const decodedName = decodeURIComponent(streamName);
  
  const hlsData = activeHlsStreams.get(decodedName);
  if (!hlsData || !hlsData.hasSubtitles) {
    return res.status(404).send('#EXTM3U\n#EXT-X-ERROR:Subtitles not available');
  }
  
  hlsData.lastAccess = Date.now();
  
  // Create a simple WebVTT playlist that points to the actual subtitle file
  const subtitlePlaylist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:86400
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:86400.0,
/hls/${encodeURIComponent(streamName)}/subtitles.vtt
#EXT-X-ENDLIST`;
  
  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send(subtitlePlaylist);
});

// Proxy the actual WebVTT file
app.get('/hls/:streamName/subtitles.vtt', async (req, res) => {
  const { streamName } = req.params;
  const decodedName = decodeURIComponent(streamName);
  
  const hlsData = activeHlsStreams.get(decodedName);
  if (!hlsData || !hlsData.webvttUrl) {
    return res.status(404).send('WEBVTT\n\n');
  }
  
  hlsData.lastAccess = Date.now();
  
  try {
    // Fetch the WebVTT file from the source
    const response = await fetch(hlsData.webvttUrl);
    if (!response.ok) {
      console.error(`[HLS] Failed to fetch WebVTT: ${response.status}`);
      return res.status(502).send('WEBVTT\n\n');
    }
    
    const vttContent = await response.text();
    
    res.setHeader('Content-Type', 'text/vtt');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(vttContent);
    
  } catch (error) {
    console.error('[HLS] WebVTT proxy error:', error.message);
    res.status(502).send('WEBVTT\n\n');
  }
});

// Serve HLS segments
app.get('/hls/:streamName/:segment', (req, res) => {
  const { streamName, segment } = req.params;
  const decodedName = decodeURIComponent(streamName);
  
  const hlsData = activeHlsStreams.get(decodedName);
  if (!hlsData) {
    return res.status(404).send('Stream not found');
  }
  
  hlsData.lastAccess = Date.now();
  
  const segmentPath = path.join(hlsData.streamDir, segment);
  
  if (!fs.existsSync(segmentPath)) {
    return res.status(404).send('Segment not found');
  }
  
  res.setHeader('Content-Type', 'video/mp2t');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Access-Control-Allow-Origin', '*');
  fs.createReadStream(segmentPath).pipe(res);
});

app.get('/live/:streamName.ts', async (req, res) => {
  const { streamName } = req.params;
  const username = req.query.username;
  const password = req.query.password;
  
  console.log(`[FFmpeg] Live request: ${streamName} from ${username || 'anonymous'}`);
  
  try {
    // Auth check (same as proxy)
    if (username && password) {
      let user = getCachedUser(username);
      if (!user) {
        const userResult = await pool.query(
          'SELECT * FROM streaming_users WHERE username = $1 AND status != $2',
          [username, 'disabled']
        );
        if (userResult.rows.length === 0) {
          return res.status(403).json({ error: 'Invalid credentials' });
        }
        user = userResult.rows[0];
        setCachedUser(username, user);
      }
      
      if (user.password !== password) {
        return res.status(403).json({ error: 'Invalid password' });
      }
      
      const now = new Date();
      const expiry = new Date(user.expiry_date);
      if (expiry < now) {
        return res.status(403).json({ error: 'Account expired' });
      }
    }
    
    // Get stream with WebVTT and LB data
    const decodedName = decodeURIComponent(streamName);
    let stream = getCachedStream(decodedName);
    if (!stream) {
      const result = await pool.query(
        `SELECT s.input_url, s.webvtt_enabled, s.webvtt_url, s.webvtt_language, s.webvtt_label, 
                s.load_balancer_id, lb.ip_address as lb_ip, lb.nginx_port as lb_port 
         FROM streams s 
         LEFT JOIN load_balancers lb ON s.load_balancer_id = lb.id 
         WHERE LOWER(s.name) = LOWER($1)`, 
        [decodedName]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Stream not found' });
      }
      stream = result.rows[0];
      setCachedStream(decodedName, stream);
    }
    
    // If stream has a Load Balancer assigned, redirect to it
    if (stream.lb_ip && stream.lb_port) {
      const lbUrl = `http://${stream.lb_ip}:${stream.lb_port}/live/${encodeURIComponent(decodedName)}.ts?username=${username}&password=${password}`;
      console.log(`[FFmpeg] Redirecting to LB: ${lbUrl}`);
      return res.redirect(302, lbUrl);
    }
    
    // Set headers for MPEG-TS stream
    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // Check if we already have an FFmpeg process for this stream
    let streamData = activeFFmpegProcesses.get(decodedName);
    
    if (!streamData || !streamData.process || streamData.process.killed) {
      // Start new FFmpeg process
      console.log(`[FFmpeg] Starting new process for: ${decodedName}`);
      console.log(`[FFmpeg] Input URL: ${stream.input_url}`);
      console.log(`[FFmpeg] WebVTT enabled: ${stream.webvtt_enabled}, URL: ${stream.webvtt_url}`);
      
      // Build FFmpeg arguments based on WebVTT settings
      let ffmpegArgs = [
        '-hide_banner',
        '-loglevel', 'warning',
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-i', stream.input_url
      ];
      
      // If WebVTT is enabled and URL is provided, add subtitle input
      if (stream.webvtt_enabled && stream.webvtt_url) {
        console.log(`[FFmpeg] Adding WebVTT subtitles from: ${stream.webvtt_url}`);
        ffmpegArgs.push(
          '-i', stream.webvtt_url,
          '-map', '0:v',     // Video from first input
          '-map', '0:a',     // Audio from first input
          '-map', '1:s?',    // Subtitles from second input (optional)
          '-c:v', 'copy',    // Copy video
          '-c:a', 'copy',    // Copy audio
          '-c:s', 'mov_text' // Encode subtitles for MPEG-TS (DVB teletext style)
        );
        
        // Add subtitle metadata
        if (stream.webvtt_language) {
          ffmpegArgs.push('-metadata:s:s:0', `language=${stream.webvtt_language}`);
        }
        if (stream.webvtt_label) {
          ffmpegArgs.push('-metadata:s:s:0', `title=${stream.webvtt_label}`);
        }
      } else {
        // No subtitles - just copy streams
        ffmpegArgs.push('-c', 'copy');
      }
      
      // Output format
      ffmpegArgs.push('-f', 'mpegts', '-');
      
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      
      streamData = {
        process: ffmpeg,
        clients: new Set(),
        startTime: Date.now()
      };
      activeFFmpegProcesses.set(decodedName, streamData);
      
      ffmpeg.stdout.on('data', (chunk) => {
        // Send to all connected clients
        for (const client of streamData.clients) {
          try {
            if (!client.destroyed) {
              client.write(chunk);
            }
          } catch (e) {
            streamData.clients.delete(client);
          }
        }
      });
      
      ffmpeg.stderr.on('data', (data) => {
        console.log(`[FFmpeg] ${decodedName}: ${data.toString().trim()}`);
      });
      
      ffmpeg.on('close', (code) => {
        console.log(`[FFmpeg] Process ended for ${decodedName}, code: ${code}`);
        activeFFmpegProcesses.delete(decodedName);
        // Close all remaining clients
        for (const client of streamData.clients) {
          try { client.end(); } catch (e) {}
        }
      });
      
      ffmpeg.on('error', (err) => {
        console.error(`[FFmpeg] Error for ${decodedName}:`, err.message);
        activeFFmpegProcesses.delete(decodedName);
      });
    }
    
    // Add this client to the stream
    streamData.clients.add(res);
    console.log(`[FFmpeg] Client connected to ${decodedName}, total: ${streamData.clients.size}`);
    
    // Handle client disconnect
    req.on('close', () => {
      streamData.clients.delete(res);
      console.log(`[FFmpeg] Client disconnected from ${decodedName}, remaining: ${streamData.clients.size}`);
      
      // If no more clients, kill FFmpeg after 30 seconds
      if (streamData.clients.size === 0) {
        setTimeout(() => {
          const current = activeFFmpegProcesses.get(decodedName);
          if (current && current.clients.size === 0) {
            console.log(`[FFmpeg] No clients, stopping: ${decodedName}`);
            try { current.process.kill('SIGTERM'); } catch (e) {}
            activeFFmpegProcesses.delete(decodedName);
          }
        }, 30000);
      }
    });
    
  } catch (error) {
    console.error('[FFmpeg] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ACTIVITY LOGS API ====================

app.get('/api/activity-logs', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 100'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== STATS API ====================
// Server start time for uptime calculation
const serverStartTime = Date.now();

// Calculate real-time connections from activeConnections map
function getRealTimeStats() {
  let totalConnections = 0;
  let onlineUsers = 0;
  const connectionDetails = [];
  
  for (const [userId, sessions] of activeConnections.entries()) {
    if (sessions.size > 0) {
      onlineUsers++;
      totalConnections += sessions.size;
      
      for (const [sessionId, data] of sessions.entries()) {
        connectionDetails.push({
          userId,
          sessionId,
          streamName: data.streamName,
          lastSeen: new Date(data.lastSeen).toISOString(),
          duration: Date.now() - (data.startTime || data.lastSeen)
        });
      }
    }
  }
  
  return { totalConnections, onlineUsers, connectionDetails };
}

// Format uptime as human readable
function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

app.get('/api/stats', async (req, res) => {
  try {
    // Get real-time connection stats from memory
    const realTimeStats = getRealTimeStats();
    
    const [usersResult, streamsResult, serversResult, lbResult] = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM streaming_users'),
      pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = $1) as active, SUM(viewers) as viewers FROM streams', ['live']),
      pool.query('SELECT * FROM servers ORDER BY created_at DESC'),
      pool.query('SELECT * FROM load_balancers WHERE status = $1', ['active'])
    ]);
    
    // Calculate server uptime
    const uptimeMs = Date.now() - serverStartTime;
    const uptime = formatUptime(uptimeMs);
    
    // Get OS-level stats if available (for single-server setup)
    let systemStats = {
      cpu: 0,
      memory: 0,
      disk: 0,
      network: 0
    };
    
    try {
      const os = require('os');
      const cpus = os.cpus();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      
      // Calculate CPU usage
      let totalIdle = 0, totalTick = 0;
      for (const cpu of cpus) {
        for (const type in cpu.times) {
          totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
      }
      systemStats.cpu = Math.round(100 - (totalIdle / totalTick * 100));
      systemStats.memory = Math.round((1 - freeMem / totalMem) * 100);
      
      // Network - approximate from active connections
      systemStats.network = Math.min(100, realTimeStats.totalConnections * 2);
    } catch (e) {
      // OS stats not available
    }
    
    // Merge server data with system stats
    const servers = serversResult.rows.map(s => ({
      ...s,
      uptime: uptime,
      cpu_usage: systemStats.cpu || s.cpu_usage || 0,
      memory_usage: systemStats.memory || s.memory_usage || 0,
      network_usage: systemStats.network || s.network_usage || 0
    }));
    
    // Calculate LB stats
    const loadBalancers = lbResult.rows.map(lb => ({
      id: lb.id,
      name: lb.name,
      status: lb.status,
      currentStreams: lb.current_streams || 0,
      maxStreams: lb.max_streams || 500,
      ipAddress: lb.ip_address
    }));
    
    res.json({
      users: {
        total: parseInt(usersResult.rows[0].total) || 0,
        online: realTimeStats.onlineUsers,
        activeConnections: realTimeStats.totalConnections
      },
      streams: {
        total: parseInt(streamsResult.rows[0].total) || 0,
        active: parseInt(streamsResult.rows[0].active) || 0,
        viewers: parseInt(streamsResult.rows[0].viewers) || realTimeStats.totalConnections
      },
      servers: {
        total: servers.length,
        online: servers.filter(s => s.status === 'online').length,
        list: servers
      },
      loadBalancers: {
        total: loadBalancers.length,
        active: loadBalancers.filter(lb => lb.status === 'active').length,
        list: loadBalancers
      },
      system: {
        uptime,
        uptimeMs,
        cpu: systemStats.cpu,
        memory: systemStats.memory,
        disk: systemStats.disk,
        network: systemStats.network
      },
      connections: realTimeStats.connectionDetails.slice(0, 100) // Limit to 100 for performance
    });
  } catch (error) {
    console.error('[Stats] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== CONNECTION MANAGEMENT API ====================

// Force disconnect a user
app.post('/api/connections/disconnect', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }
    
    // Remove from in-memory tracking
    if (activeConnections.has(userId)) {
      activeConnections.delete(userId);
      console.log(`[Disconnect] Removed all sessions for user ${userId}`);
    }
    
    // Update database
    await pool.query(
      'UPDATE streaming_users SET connections = 0, status = $1, updated_at = NOW() WHERE id = $2',
      ['offline', userId]
    );
    
    res.json({ success: true, message: 'User disconnected' });
  } catch (error) {
    console.error('[Disconnect] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get active connections
app.get('/api/connections/active', async (req, res) => {
  try {
    const connections = [];
    
    for (const [userId, sessions] of activeConnections.entries()) {
      const sessionsArray = [];
      for (const [sessionId, data] of sessions.entries()) {
        sessionsArray.push({
          sessionId,
          streamName: data.streamName,
          lastSeen: new Date(data.lastSeen).toISOString()
        });
      }
      
      connections.push({
        userId,
        sessionCount: sessions.size,
        sessions: sessionsArray
      });
    }
    
    res.json({ connections, totalConnections: connections.reduce((sum, c) => sum + c.sessionCount, 0) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== DIRECT STREAM ACCESS ====================
// Format: /:username/:password/:streamName (for IPTV players)

app.get('/:username/:password/:streamName', async (req, res) => {
  try {
    const { username, password, streamName } = req.params;
    
    console.log(`[Stream] Direct access: ${username}/${streamName}`);
    
    // Authenticate user
    const userResult = await pool.query(
      'SELECT * FROM streaming_users WHERE username = $1 AND password = $2',
      [username, password]
    );
    
    if (userResult.rows.length === 0) {
      console.log(`[Stream] Invalid credentials for: ${username}`);
      return res.status(401).send('Invalid credentials');
    }
    
    const user = userResult.rows[0];
    
    // Check expiry
    if (new Date(user.expiry_date) < new Date()) {
      console.log(`[Stream] Account expired for: ${username}`);
      return res.status(403).send('Account expired');
    }
    
    // Connection limiting
    const maxConnections = user.max_connections || 1;
    const sessionId = getSessionId(req);
    
    if (!activeConnections.has(user.id)) {
      activeConnections.set(user.id, new Map());
    }
    const userSessions = activeConnections.get(user.id);
    
    const isExistingSession = userSessions.has(sessionId);
    
    if (!isExistingSession && userSessions.size >= maxConnections) {
      console.log(`[Stream] Connection limit reached for ${username}: ${userSessions.size}/${maxConnections}`);
      return res.status(429).send('Connection limit reached');
    }
    
    // Update session
    userSessions.set(sessionId, {
      streamName: decodeURIComponent(streamName),
      lastSeen: Date.now()
    });
    
    // Update database
    await pool.query(
      'UPDATE streaming_users SET connections = $1, last_active = NOW(), status = $2, updated_at = NOW() WHERE id = $3',
      [userSessions.size, 'online', user.id]
    );
    
    // Find stream
    const streamResult = await pool.query(
      'SELECT input_url, name FROM streams WHERE name = $1',
      [decodeURIComponent(streamName)]
    );
    
    if (streamResult.rows.length === 0) {
      console.log(`[Stream] Stream not found: ${streamName}`);
      return res.status(404).send('Stream not found');
    }
    
    const stream = streamResult.rows[0];
    if (!stream.input_url) {
      return res.status(400).send('Stream has no source URL');
    }
    
    // Proxy the manifest directly (don't redirect - some players don't follow redirects)
    // Use X-Forwarded-Host from nginx, then SERVER_DOMAIN, then Host header
    const forwardedHost = req.get('x-forwarded-host');
    const hostHeader = req.get('host');
    const protocol = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
    const httpPort = process.env.HTTP_PORT || '80';
    const usePort = (httpPort !== '80' && httpPort !== '443') ? `:${httpPort}` : '';
    
    let proxyBase;
    if (forwardedHost) {
      proxyBase = `${protocol}://${forwardedHost}/proxy/${encodeURIComponent(streamName)}/`;
    } else if (process.env.SERVER_DOMAIN) {
      proxyBase = `http://${process.env.SERVER_DOMAIN}${usePort}/proxy/${encodeURIComponent(streamName)}/`;
    } else {
      proxyBase = `${protocol}://${hostHeader}/proxy/${encodeURIComponent(streamName)}/`;
    }
    console.log(`[Stream] Using proxyBase: ${proxyBase}`);
    
    const inputUrl = stream.input_url.trim();
    const targetUrl = inputUrl.endsWith('.m3u8') ? inputUrl : inputUrl.replace(/\/$/, '') + '/index.m3u8';
    
    console.log(`[Stream] Fetching manifest: ${targetUrl}`);
    
    try {
      const response = await fetch(targetUrl, {
        redirect: 'follow',
        headers: { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20' }
      });
      
      if (!response.ok) {
        console.error(`[Stream] Upstream error ${response.status}`);
        return res.status(response.status).send('Stream unavailable');
      }
      
      const content = await response.text();
      const finalUrl = response.url || targetUrl;
      const finalUrlBase = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);
      
      // Rewrite all URLs using base64 encoding
      const lines = content.split('\n');
      const rewritten = lines.map(line => {
        const trimmed = line.trim();
        
        // Handle URI="..." in tags
        if (trimmed.startsWith('#') && trimmed.includes('URI="')) {
          return line.replace(/URI="([^"]+)"/g, (match, uri) => {
            let fullUrl;
            if (uri.startsWith('http')) {
              fullUrl = uri;
            } else if (uri.startsWith('/')) {
              const urlObj = new URL(finalUrl);
              fullUrl = urlObj.origin + uri;
            } else {
              fullUrl = finalUrlBase + uri;
            }
            const encoded = Buffer.from(fullUrl).toString('base64');
            return `URI="${proxyBase}b64/${encodeURIComponent(encoded)}"`;
          });
        }
        
        // Skip comments and empty lines
        if (trimmed.startsWith('#') || !trimmed) return line;
        
        // Rewrite URL
        let fullUrl;
        if (trimmed.startsWith('http')) {
          fullUrl = trimmed;
        } else if (trimmed.startsWith('/')) {
          const urlObj = new URL(finalUrl);
          fullUrl = urlObj.origin + trimmed;
        } else {
          fullUrl = finalUrlBase + trimmed;
        }
        
        const encoded = Buffer.from(fullUrl).toString('base64');
        return proxyBase + 'b64/' + encodeURIComponent(encoded);
      });
      
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(rewritten.join('\n'));
      
    } catch (fetchError) {
      console.error(`[Stream] Fetch error: ${fetchError.message}`);
      return res.status(502).send('Stream unavailable');
    }
    
  } catch (error) {
    console.error('[Stream] Error:', error);
    res.status(500).send('Stream error');
  }
});

// ==================== VOD MOVIE PROXY ====================
app.get('/movie/:username/:password/:vodId', async (req, res) => {
  const { username, password, vodId } = req.params;
  
  console.log(`[Movie] Request: ${vodId} from ${username}`);
  
  try {
    // Auth check
    let user = getCachedUser(username);
    if (!user) {
      const userResult = await pool.query(
        'SELECT * FROM streaming_users WHERE username = $1 AND status != $2',
        [username, 'disabled']
      );
      if (userResult.rows.length === 0) {
        return res.status(403).json({ error: 'Invalid credentials' });
      }
      user = userResult.rows[0];
      setCachedUser(username, user);
    }
    
    if (user.password !== password) {
      return res.status(403).json({ error: 'Invalid password' });
    }
    
    const now = new Date();
    const expiry = new Date(user.expiry_date);
    if (expiry < now) {
      return res.status(403).json({ error: 'Account expired' });
    }
    
    // Get VOD content - extract ID without extension
    const cleanId = vodId.replace(/\.[^/.]+$/, '');
    const result = await pool.query('SELECT stream_url, container_extension FROM vod_content WHERE id = $1', [cleanId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Movie not found' });
    }
    
    const streamUrl = result.rows[0].stream_url;
    const ext = result.rows[0].container_extension || 'mp4';
    console.log(`[Movie] Proxying: ${streamUrl}`);
    
    // Proxy the video stream with Range support
    const https = require('https');
    const http = require('http');
    
    const parsedUrl = new URL(streamUrl);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const proxyHeaders = {
      'User-Agent': 'StreamPanel/1.0'
    };
    
    // Pass through Range header for seeking support
    if (req.headers.range) {
      proxyHeaders['Range'] = req.headers.range;
    }
    
    const proxyReq = protocol.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: proxyHeaders
    }, (proxyRes) => {
      // Set content type based on extension
      const contentTypes = {
        'mkv': 'video/x-matroska',
        'mp4': 'video/mp4',
        'avi': 'video/x-msvideo',
        'mov': 'video/quicktime',
        'wmv': 'video/x-ms-wmv',
        'flv': 'video/x-flv',
        'webm': 'video/webm',
        'ts': 'video/mp2t'
      };
      
      res.setHeader('Content-Type', contentTypes[ext] || 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      
      // Pass through important headers
      if (proxyRes.headers['content-length']) {
        res.setHeader('Content-Length', proxyRes.headers['content-length']);
      }
      if (proxyRes.headers['content-range']) {
        res.setHeader('Content-Range', proxyRes.headers['content-range']);
      }
      
      res.status(proxyRes.statusCode);
      proxyRes.pipe(res);
    });
    
    proxyReq.on('error', (err) => {
      console.error('[Movie] Proxy error:', err.message);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Failed to fetch movie' });
      }
    });
    
    req.on('close', () => {
      proxyReq.destroy();
    });
    
    proxyReq.end();
    
  } catch (error) {
    console.error('[Movie] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== SERIES EPISODE PROXY ====================
app.get('/series/:username/:password/:episodeId', async (req, res) => {
  const { username, password, episodeId } = req.params;
  
  console.log(`[Series] Request: ${episodeId} from ${username}`);
  
  try {
    // Auth check
    let user = getCachedUser(username);
    if (!user) {
      const userResult = await pool.query(
        'SELECT * FROM streaming_users WHERE username = $1 AND status != $2',
        [username, 'disabled']
      );
      if (userResult.rows.length === 0) {
        return res.status(403).json({ error: 'Invalid credentials' });
      }
      user = userResult.rows[0];
      setCachedUser(username, user);
    }
    
    if (user.password !== password) {
      return res.status(403).json({ error: 'Invalid password' });
    }
    
    const now = new Date();
    const expiry = new Date(user.expiry_date);
    if (expiry < now) {
      return res.status(403).json({ error: 'Account expired' });
    }
    
    // Get episode - extract ID without extension
    const cleanId = episodeId.replace(/\.[^/.]+$/, '');
    const result = await pool.query('SELECT stream_url, container_extension FROM series_episodes WHERE id = $1', [cleanId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Episode not found' });
    }
    
    const streamUrl = result.rows[0].stream_url;
    const ext = result.rows[0].container_extension || 'mp4';
    console.log(`[Series] Proxying: ${streamUrl}`);
    
    // Proxy the video stream with Range support
    const https = require('https');
    const http = require('http');
    
    const parsedUrl = new URL(streamUrl);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const proxyHeaders = {
      'User-Agent': 'StreamPanel/1.0'
    };
    
    // Pass through Range header for seeking support
    if (req.headers.range) {
      proxyHeaders['Range'] = req.headers.range;
    }
    
    const proxyReq = protocol.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: proxyHeaders
    }, (proxyRes) => {
      // Set content type based on extension
      const contentTypes = {
        'mkv': 'video/x-matroska',
        'mp4': 'video/mp4',
        'avi': 'video/x-msvideo',
        'mov': 'video/quicktime',
        'wmv': 'video/x-ms-wmv',
        'flv': 'video/x-flv',
        'webm': 'video/webm',
        'ts': 'video/mp2t'
      };
      
      res.setHeader('Content-Type', contentTypes[ext] || 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      
      // Pass through important headers
      if (proxyRes.headers['content-length']) {
        res.setHeader('Content-Length', proxyRes.headers['content-length']);
      }
      if (proxyRes.headers['content-range']) {
        res.setHeader('Content-Range', proxyRes.headers['content-range']);
      }
      
      res.status(proxyRes.statusCode);
      proxyRes.pipe(res);
    });
    
    proxyReq.on('error', (err) => {
      console.error('[Series] Proxy error:', err.message);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Failed to fetch episode' });
      }
    });
    
    req.on('close', () => {
      proxyReq.destroy();
    });
    
    proxyReq.end();
    
  } catch (error) {
    console.error('[Series] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Note: Stalker Portal routes are defined earlier in the file (before catch-all routes)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server and pre-warm cache
app.listen(PORT, async () => {
  console.log(`StreamPanel API running on port ${PORT}`);
  // Pre-warm cache after server starts
  await prewarmCache();
});
