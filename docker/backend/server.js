const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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

// ==================== XTREAM CODES API ====================

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
    const { username, password, type } = req.query;
    
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
    
    const settingsResult = await pool.query('SELECT key, value FROM panel_settings');
    const settings = {};
    settingsResult.rows.forEach(row => { settings[row.key] = row.value; });
    
    const baseUrl = `http://${settings.server_domain || 'localhost'}:${settings.http_port || '80'}`;
    
    let playlist = '#EXTM3U\n';
    
    // Live streams
    const streams = await pool.query('SELECT * FROM streams WHERE status != $1 ORDER BY channel_number', ['error']);
    
    for (const stream of streams.rows) {
      playlist += `#EXTINF:-1 tvg-id="${stream.epg_channel_id || ''}" tvg-name="${stream.name}" tvg-logo="${stream.stream_icon || ''}" group-title="${stream.category || ''}",${stream.name}\n`;
      playlist += `${baseUrl}/live/${username}/${password}/${stream.id}.m3u8\n`;
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

// ==================== STREAM PROXY ====================

// Proxy endpoint for HLS streams (bypass CORS)
app.get('/proxy/:streamName/*', async (req, res) => {
  try {
    const { streamName } = req.params;
    const filePath = req.params[0] || 'index.m3u8';
    
    console.log(`Stream proxy request: ${streamName}/${filePath}`);
    
    // Look up stream from database
    const result = await pool.query(
      'SELECT input_url, name, status FROM streams WHERE name = $1',
      [decodeURIComponent(streamName)]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stream not found' });
    }
    
    const stream = result.rows[0];
    if (!stream.input_url) {
      return res.status(400).json({ error: 'Stream has no source URL' });
    }
    
    // Construct target URL
    let targetUrl;
    const inputUrl = stream.input_url.trim();
    
    if (inputUrl.endsWith('/')) {
      targetUrl = `${inputUrl}${filePath}`;
    } else if (inputUrl.endsWith('.m3u8') || inputUrl.endsWith('.ts')) {
      const baseUrl = inputUrl.substring(0, inputUrl.lastIndexOf('/') + 1);
      targetUrl = `${baseUrl}${filePath}`;
    } else {
      targetUrl = `${inputUrl}/${filePath}`;
    }
    
    console.log(`Proxying to: ${targetUrl}`);
    
    // Fetch from original source
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
      }
    });
    
    if (!response.ok) {
      console.error(`Upstream error: ${response.status}`);
      return res.status(response.status).json({ error: `Upstream error: ${response.status}` });
    }
    
    // Set content type
    let contentType = response.headers.get('content-type') || 'application/octet-stream';
    if (filePath.endsWith('.m3u8')) {
      contentType = 'application/vnd.apple.mpegurl';
    } else if (filePath.endsWith('.ts')) {
      contentType = 'video/mp2t';
    }
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', filePath.endsWith('.ts') ? 'max-age=86400' : 'no-cache');
    
    const body = await response.arrayBuffer();
    res.send(Buffer.from(body));
    
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`StreamPanel API running on port ${PORT}`);
});
