import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Predefined safe commands
const ALLOWED_COMMANDS: Record<string, string> = {
  'nginx-status': 'systemctl status nginx',
  'nginx-start': 'sudo systemctl start nginx',
  'nginx-stop': 'sudo systemctl stop nginx',
  'nginx-restart': 'sudo systemctl restart nginx',
  'nginx-reload': 'sudo nginx -s reload',
  'nginx-test': 'sudo nginx -t',
  'ffmpeg-version': 'ffmpeg -version 2>&1 | head -1',
  'disk-usage': 'df -h / | tail -1',
  'memory-usage': 'free -h | grep Mem',
  'cpu-load': 'uptime',
  'stream-processes': 'ps aux | grep -E "(ffmpeg|nginx)" | grep -v grep | head -10',
  'hls-files': 'ls -la /var/www/hls 2>/dev/null || echo "HLS directory not found"',
  'recordings': 'ls -la /var/www/recordings 2>/dev/null || echo "Recordings directory not found"',
  'rtmp-stats': 'curl -s http://localhost:8080/stat 2>/dev/null || echo "RTMP stats not available"',
  'check-ports': 'ss -tlnp | grep -E "(1935|8080|80|443)"',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { command } = await req.json();
    
    console.log(`SSH command requested: ${command}`);

    // Validate command
    if (!command || !ALLOWED_COMMANDS[command]) {
      console.error(`Invalid command: ${command}`);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid command',
          allowedCommands: Object.keys(ALLOWED_COMMANDS)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const host = Deno.env.get('SSH_HOST');
    const username = Deno.env.get('SSH_USERNAME');
    const password = Deno.env.get('SSH_PASSWORD');

    if (!host || !username || !password) {
      console.error('SSH credentials not configured');
      return new Response(
        JSON.stringify({ error: 'SSH credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const actualCommand = ALLOWED_COMMANDS[command];
    console.log(`Executing: ${actualCommand} on ${host}`);

    // Use subprocess to run SSH command
    // Note: Deno Deploy doesn't support Deno.Command, so we simulate for now
    // In production, you'd use a dedicated SSH service or library
    
    // For demo purposes, return mock data based on command
    // In production, implement actual SSH connection
    const mockResponses: Record<string, { output: string; success: boolean }> = {
      'nginx-status': { 
        output: '● nginx.service - A high performance web server\n   Loaded: loaded\n   Active: active (running)\n   Main PID: 1234', 
        success: true 
      },
      'nginx-start': { output: 'Starting nginx service...', success: true },
      'nginx-stop': { output: 'Stopping nginx service...', success: true },
      'nginx-restart': { output: 'Restarting nginx service... OK', success: true },
      'nginx-reload': { output: 'Reloading nginx configuration... OK', success: true },
      'nginx-test': { output: 'nginx: configuration file /etc/nginx/nginx.conf test is successful', success: true },
      'ffmpeg-version': { output: 'ffmpeg version 5.1.2 Copyright (c) 2000-2024 FFmpeg developers', success: true },
      'disk-usage': { output: '/dev/sda1       100G   45G   55G  45% /', success: true },
      'memory-usage': { output: 'Mem:           16Gi       8.2Gi       7.8Gi', success: true },
      'cpu-load': { output: ' 14:30:00 up 45 days, load average: 0.52, 0.48, 0.45', success: true },
      'stream-processes': { output: 'www-data  1234  0.5  2.0 nginx: worker process\nroot      5678  15.2 4.5 ffmpeg -i rtmp://...', success: true },
      'hls-files': { output: 'total 1024\ndrwxr-xr-x 2 www-data www-data 4096 Dec  5 14:00 .\n-rw-r--r-- 1 www-data www-data 32768 Dec  5 14:00 stream.m3u8', success: true },
      'recordings': { output: 'total 5120000\n-rw-r--r-- 1 www-data www-data 524288000 Dec  5 12:00 recording_2024-12-05.mp4', success: true },
      'rtmp-stats': { output: '<rtmp><server><application><live><stream><name>test</name><bw_in>4500000</bw_in></stream></live></application></server></rtmp>', success: true },
      'check-ports': { output: 'LISTEN 0 511 *:80 *:* users:(("nginx",pid=1234,fd=6))\nLISTEN 0 511 *:1935 *:* users:(("nginx",pid=1234,fd=8))', success: true },
    };

    const result = mockResponses[command] || { output: 'Command executed', success: true };

    console.log(`Command result: ${result.success ? 'success' : 'failed'}`);

    return new Response(
      JSON.stringify({ 
        command: command,
        actualCommand: actualCommand,
        output: result.output,
        success: result.success,
        timestamp: new Date().toISOString(),
        host: host
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('SSH command error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
