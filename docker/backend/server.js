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
const streamCache = new Map(); // name -> {input_url, cachedAt}
const userCache = new Map(); // username -> {user, cachedAt}
const CACHE_TTL = 10000; // 10 seconds cache - short TTL for quick status updates

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
    
    // Load all active streams (include status for proxy check)
    const streamsResult = await pool.query(
      "SELECT name, input_url, status FROM streams WHERE status != 'error'"
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
    const streamsResult = await pool.query(
      "SELECT name, input_url, status FROM streams WHERE status != 'error'"
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
    
    if (!Array.isArray(streams)) {
      return res.status(400).json({ error: 'Streams array required' });
    }
    
    let synced = 0, errors = [];
    
    for (const stream of streams) {
      try {
        await pool.query(`
          INSERT INTO streams (id, name, input_type, input_url, category, bouquet, channel_number, output_formats, bitrate, resolution, webvtt_enabled, webvtt_url, webvtt_language, webvtt_label, dvr_enabled, dvr_duration, abr_enabled, stream_icon, epg_channel_id, status, viewers, created_at)
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
    
    await pool.query(`
      INSERT INTO streams (id, name, input_type, input_url, category, bouquet, channel_number, output_formats, bitrate, resolution, webvtt_enabled, webvtt_url, webvtt_language, webvtt_label, dvr_enabled, dvr_duration, abr_enabled, stream_icon, epg_channel_id, status, viewers)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
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
      stream.viewers || 0
    ]);
    
    // Invalidate cache for this stream immediately
    invalidateStreamCache(stream.name);
    
    console.log(`[Sync] Synced stream: ${stream.name}, status: ${stream.status || 'inactive'}`);
    res.json({ success: true });
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
    
    // Determine output format: m3u8 (HLS) or ts (direct transport stream)
    // output=ts generates .ts URLs, output=m3u8 or default generates HLS index.m3u8
    const useTs = output === 'ts';
    
    for (const stream of streams.rows) {
      // Use bouquet for group-title (country grouping like "Slovenia", "Croatia")
      // Falls back to category if bouquet is not set
      const groupTitle = stream.bouquet || stream.category || 'Uncategorized';
      
      playlist += `#EXTINF:-1 tvg-id="${stream.epg_channel_id || ''}" tvg-name="${stream.name}" tvg-logo="${stream.stream_icon || ''}" group-title="${groupTitle}",${stream.name}\n`;
      
      const encodedName = encodeURIComponent(stream.name);
      
      // Generate URL based on input_type
      if (stream.input_type === 'mpd') {
        // MPD/DASH streams - use manifest.mpd
        playlist += `${baseUrl}/proxy/${username}/${password}/${encodedName}/manifest.mpd\n`;
      } else if (stream.input_type === 'hls') {
        // HLS streams
        if (useTs) {
          playlist += `${baseUrl}/proxy/${username}/${password}/${encodedName}/index.ts\n`;
        } else {
          playlist += `${baseUrl}/proxy/${username}/${password}/${encodedName}/index.m3u8\n`;
        }
      } else {
        // RTMP/SRT/other streams - use standard format
        if (useTs) {
          playlist += `${baseUrl}/proxy/${username}/${password}/${encodedName}/index.ts\n`;
        } else {
          playlist += `${baseUrl}/proxy/${username}/${password}/${encodedName}/index.m3u8\n`;
        }
      }
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
    
    // Fast path: Check if looks like authenticated format (3+ parts)
    if (parts.length >= 3) {
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
    }
    
    // If not authenticated format, treat as legacy
    if (!isAuthenticated) {
      streamName = parts[0];
      filePath = parts.slice(1).join('/') || 'index.m3u8';
    }
    
    // Only log main playlist requests, not every .ts segment
    const isSegment = filePath.endsWith('.ts');
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
      userSessions.set(sessionId, {
        streamName,
        lastSeen: Date.now()
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
    
    // Cache for storing resolved base URLs after redirects
    // Key: streamName or streamName:pathPrefix, Value: { baseUrl, timestamp }
    if (!global.streamBaseUrlCache) {
      global.streamBaseUrlCache = new Map();
    }
    
    // Construct target URL
    let targetUrl;
    const inputUrl = stream.input_url.trim();
    let effectiveFilePath = filePath;
    const cacheMaxAge = 5 * 60 * 1000; // 5 minutes cache
    
    // Get path prefix for caching (e.g., "16/Video-5M" from "16/Video-5M/manifest.m3u8")
    const getPathPrefix = (fp) => {
      const lastSlash = fp.lastIndexOf('/');
      return lastSlash > 0 ? fp.substring(0, lastSlash) : '';
    };
    
    // Get cache key based on stream and path prefix
    const pathPrefix = getPathPrefix(filePath);
    const cacheKey = pathPrefix ? `${decodedStreamName}:${pathPrefix}` : decodedStreamName;
    const masterCacheKey = decodedStreamName;
    
    // Check if we have a cached base URL for this specific path or the master
    const cachedBase = global.streamBaseUrlCache.get(cacheKey);
    const masterCachedBase = global.streamBaseUrlCache.get(masterCacheKey);
    
    // For .ts segments without path prefix, try to find any cached path that matches
    const isSegment = filePath.endsWith('.ts') || filePath.endsWith('.m4s');
    
    if (cachedBase && (Date.now() - cachedBase.timestamp) < cacheMaxAge && filePath !== 'index.m3u8' && filePath !== 'index.ts') {
      // Use cached base URL for this specific path
      const fileName = filePath.includes('/') ? filePath.substring(filePath.lastIndexOf('/') + 1) : filePath;
      targetUrl = cachedBase.baseUrl + fileName;
      if (!isSegment) console.log(`[Proxy] Using cached base URL for path: ${targetUrl}`);
    } else if (isSegment && !filePath.includes('/')) {
      // Segment without directory - find most recent matching cache
      let foundCache = null;
      let foundKey = null;
      for (const [key, value] of global.streamBaseUrlCache.entries()) {
        if (key.startsWith(decodedStreamName + ':') && (Date.now() - value.timestamp) < cacheMaxAge) {
          if (!foundCache || value.timestamp > foundCache.timestamp) {
            foundCache = value;
            foundKey = key;
          }
        }
      }
      if (foundCache) {
        targetUrl = foundCache.baseUrl + filePath;
        console.log(`[Proxy] Using recent cached base for segment: ${targetUrl}`);
      } else if (masterCachedBase && (Date.now() - masterCachedBase.timestamp) < cacheMaxAge) {
        targetUrl = masterCachedBase.baseUrl + filePath;
        console.log(`[Proxy] Using master cached base for segment: ${targetUrl}`);
      } else {
        // Fallback to constructing from input_url
        const baseUrl = inputUrl.endsWith('.m3u8') || inputUrl.endsWith('.mpd') 
          ? inputUrl.substring(0, inputUrl.lastIndexOf('/') + 1)
          : inputUrl.endsWith('/') ? inputUrl : inputUrl + '/';
        targetUrl = baseUrl + filePath;
      }
    } else if (filePath === 'index.m3u8' || filePath === 'index.ts') {
      // For main playlist requests, use input_url and resolve redirects
      if (inputUrl.endsWith('.m3u8')) {
        targetUrl = inputUrl;
      } else if (inputUrl.endsWith('/')) {
        targetUrl = `${inputUrl}index.m3u8`;
      } else {
        targetUrl = `${inputUrl}/index.m3u8`;
      }
      effectiveFilePath = 'index.m3u8';
    } else if (filePath === 'manifest.mpd') {
      if (inputUrl.endsWith('.mpd')) {
        targetUrl = inputUrl;
      } else if (inputUrl.endsWith('/')) {
        targetUrl = `${inputUrl}manifest.mpd`;
      } else {
        targetUrl = `${inputUrl}/manifest.mpd`;
      }
    } else if (masterCachedBase && (Date.now() - masterCachedBase.timestamp) < cacheMaxAge) {
      // Use master cached base for any other file type
      targetUrl = masterCachedBase.baseUrl + filePath;
    } else if (inputUrl.endsWith('.mpd')) {
      const baseUrl = inputUrl.substring(0, inputUrl.lastIndexOf('/') + 1);
      targetUrl = `${baseUrl}${filePath}`;
    } else if (inputUrl.endsWith('.m3u8')) {
      const baseUrl = inputUrl.substring(0, inputUrl.lastIndexOf('/') + 1);
      targetUrl = `${baseUrl}${filePath}`;
    } else if (inputUrl.endsWith('/')) {
      targetUrl = `${inputUrl}${filePath}`;
    } else {
      targetUrl = `${inputUrl}/${filePath}`;
    }
    
    console.log(`[Proxy] Target URL: ${targetUrl}`);
    
    // Helper function to extract redirect URL from HTML
    const extractRedirectUrl = (html) => {
      // Look for href="..." pattern in HTML redirect pages
      const hrefMatch = html.match(/href=["']?([^"'\s>]+\.m3u8[^"'\s>]*)["']?/i);
      if (hrefMatch) return hrefMatch[1];
      
      // Also try meta refresh pattern
      const metaMatch = html.match(/content=["'][^"']*url=([^"'\s>]+)["']/i);
      if (metaMatch) return metaMatch[1];
      
      return null;
    };
    
    // Fetch with timeout for faster failure
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
    
    try {
      let currentUrl = targetUrl;
      let response;
      let redirectCount = 0;
      const maxRedirects = 5;
      
      // Manually follow redirects to handle 302 properly
      while (redirectCount < maxRedirects) {
        console.log(`[Proxy] Fetching: ${currentUrl}`);
        response = await fetch(currentUrl, {
          redirect: 'manual', // Handle redirects manually
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*',
          },
          signal: controller.signal
        });
        
        // Check for redirect status codes (301, 302, 303, 307, 308)
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get('location');
          if (location) {
            // Handle relative URLs
            if (location.startsWith('/')) {
              const urlObj = new URL(currentUrl);
              currentUrl = `${urlObj.protocol}//${urlObj.host}${location}`;
            } else if (!location.startsWith('http')) {
              const baseUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/') + 1);
              currentUrl = baseUrl + location;
            } else {
              currentUrl = location;
            }
            console.log(`[Proxy] Following redirect to: ${currentUrl}`);
            redirectCount++;
            continue;
          }
        }
        
        // Not a redirect, break the loop
        break;
      }
      
      // After following redirects, cache the base URL for this stream/path
      if (redirectCount > 0 || (effectiveFilePath.endsWith('.m3u8') && filePath !== 'index.m3u8')) {
        const resolvedBaseUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/') + 1);
        // Cache with path prefix for sub-manifests
        const pathPrefix = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '';
        const cacheKey = pathPrefix ? `${decodedStreamName}:${pathPrefix}` : decodedStreamName;
        global.streamBaseUrlCache.set(cacheKey, {
          baseUrl: resolvedBaseUrl,
          timestamp: Date.now()
        });
        console.log(`[Proxy] Cached base URL for ${cacheKey}: ${resolvedBaseUrl}`);
      }
      
      if (redirectCount >= maxRedirects) {
        console.error(`[Proxy] Too many redirects`);
        clearTimeout(timeout);
        return res.status(502).json({ error: 'Too many redirects' });
      }
      
      // Check if response is HTML (might be a redirect page)
      const responseContentType = response.headers.get('content-type') || '';
      if (response.ok && responseContentType.includes('text/html')) {
        const html = await response.text();
        const redirectUrl = extractRedirectUrl(html);
        
        if (redirectUrl) {
          console.log(`[Proxy] Found HTML redirect, following to: ${redirectUrl}`);
          currentUrl = redirectUrl;
          
          // Cache this base URL too
          const resolvedBaseUrl = redirectUrl.substring(0, redirectUrl.lastIndexOf('/') + 1);
          global.streamBaseUrlCache.set(decodedStreamName, {
            baseUrl: resolvedBaseUrl,
            timestamp: Date.now()
          });
          
          response = await fetch(redirectUrl, {
            redirect: 'follow',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': '*/*',
            },
            signal: controller.signal
          });
        } else {
          console.error(`[Proxy] Got HTML response but no redirect URL found`);
          clearTimeout(timeout);
          return res.status(502).json({ error: 'Invalid upstream response (HTML without redirect)' });
        }
      }
      
      clearTimeout(timeout);
      
      if (!response.ok) {
        console.error(`[Proxy] Upstream error: ${response.status}`);
        return res.status(response.status).json({ error: `Upstream error: ${response.status}` });
      }
      
      let contentType = response.headers.get('content-type') || 'application/octet-stream';
      if (effectiveFilePath.endsWith('.m3u8') || filePath === 'index.ts') contentType = 'application/vnd.apple.mpegurl';
      else if (effectiveFilePath.endsWith('.ts')) contentType = 'video/mp2t';
      else if (effectiveFilePath.endsWith('.mpd') || filePath === 'manifest.mpd') contentType = 'application/dash+xml';
      else if (effectiveFilePath.endsWith('.m4s')) contentType = 'video/iso.segment';
      
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', effectiveFilePath.endsWith('.ts') ? 'max-age=86400' : 'no-cache');
      
      const body = await response.arrayBuffer();
      let bodyBuffer = Buffer.from(body);
      
      // For m3u8 playlists, rewrite relative URLs to proxy URLs
      if (effectiveFilePath.endsWith('.m3u8') || filePath === 'index.ts') {
        let m3u8Content = bodyBuffer.toString('utf8');
        
        // Get the proxy base URL for this stream
        const proxyBaseUrl = `/proxy/${encodeURIComponent(streamName)}/`;
        
        // Rewrite relative URLs to go through our proxy
        const lines = m3u8Content.split('\n');
        const rewrittenLines = lines.map(line => {
          const trimmedLine = line.trim();
          
          // Skip comments and empty lines, but handle URI= attributes
          if (trimmedLine.startsWith('#')) {
            // Handle URI="..." in tags like EXT-X-MEDIA and EXT-X-I-FRAME-STREAM-INF
            if (trimmedLine.includes('URI="')) {
              return line.replace(/URI="([^"]+)"/g, (match, uri) => {
                if (uri.startsWith('http://') || uri.startsWith('https://')) {
                  return match; // Already absolute - leave it
                }
                // Route through proxy
                return `URI="${proxyBaseUrl}${uri}"`;
              });
            }
            return line;
          }
          if (!trimmedLine) return line;
          
          // If it's a relative URL, route it through proxy
          if (!trimmedLine.startsWith('http://') && !trimmedLine.startsWith('https://')) {
            return proxyBaseUrl + trimmedLine;
          }
          return line;
        });
        
        m3u8Content = rewrittenLines.join('\n');
        console.log(`[Proxy] Rewrote m3u8 URLs to use proxy: ${proxyBaseUrl}`);
        bodyBuffer = Buffer.from(m3u8Content, 'utf8');
      }
      
      res.send(bodyBuffer);
    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError.name === 'AbortError') {
        console.error(`[Proxy] Timeout fetching: ${targetUrl}`);
        return res.status(504).json({ error: 'Upstream timeout' });
      }
      throw fetchError;
    }
    
  } catch (error) {
    console.error('[Proxy] Error:', error);
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
app.get('/api/stats', async (req, res) => {
  try {
    const [usersResult, streamsResult, serversResult] = await Promise.all([
      pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = $1) as online, SUM(connections) as active_connections FROM streaming_users', ['online']),
      pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = $1) as active FROM streams', ['live']),
      pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = $1) as online FROM servers', ['online'])
    ]);
    
    res.json({
      users: {
        total: parseInt(usersResult.rows[0].total) || 0,
        online: parseInt(usersResult.rows[0].online) || 0,
        activeConnections: parseInt(usersResult.rows[0].active_connections) || 0
      },
      streams: {
        total: parseInt(streamsResult.rows[0].total) || 0,
        active: parseInt(streamsResult.rows[0].active) || 0
      },
      servers: {
        total: parseInt(serversResult.rows[0].total) || 0,
        online: parseInt(serversResult.rows[0].online) || 0
      }
    });
  } catch (error) {
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
    
    // Redirect to actual stream
    const targetUrl = stream.input_url.trim();
    console.log(`[Stream] Redirecting to: ${targetUrl}`);
    
    // Proxy the stream content
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': req.headers['user-agent'] || 'StreamPanel/1.0'
      }
    });
    
    if (!response.ok) {
      return res.status(response.status).send('Stream unavailable');
    }
    
    // Set content type
    const contentType = response.headers.get('content-type') || 'application/vnd.apple.mpegurl';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Stream the content
    const body = await response.arrayBuffer();
    res.send(Buffer.from(body));
    
  } catch (error) {
    console.error('[Stream] Error:', error);
    res.status(500).send('Stream error');
  }
});

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
