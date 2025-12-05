import { useState, useEffect } from "react";
import { Save, Shield, Bell, Globe, Database, Key, Copy, RefreshCw, Server, Play, ExternalLink, Terminal, FileCode } from "lucide-react";
import { StreamTestPlayer } from "@/components/StreamTestPlayer";
import { NginxConfigGenerator } from "@/components/NginxConfigGenerator";
import { ServerSSHControl } from "@/components/ServerSSHControl";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const SETTINGS_KEY = 'streampanel_settings';
const API_KEY_KEY = 'streampanel_api_key';

const defaultSettings = {
  serverName: "StreamPanel",
  serverDomain: "panel.example.com",
  adminEmail: "admin@example.com",
  maxUsers: "5000",
  maxConnections: "10000",
  enableSSL: true,
  enableBackup: true,
  backupInterval: "24",
  enableNotifications: true,
  enableTwoFactor: false,
  apiEnabled: true,
  debugMode: false,
  // Streaming server config
  streamServerIp: "",
  streamServerPort: "1935",
  streamHttpPort: "8080",
  streamHlsPath: "/live",
  streamUseSSL: false,
  // Advanced streaming config
  hlsSegmentDuration: "2",
  hlsPlaylistLength: "6",
  ffmpegPath: "/usr/bin/ffmpeg",
  recordingsPath: "/var/www/recordings",
  enableTranscoding: false,
  transcodingPreset: "medium",
  transcodingBitrate: "4000",
  enableDVR: false,
  dvrDuration: "24",
  allowedCodecs: "h264,aac",
  maxBitrate: "8000",
  enableAuth: false,
  streamKeyPrefix: "live_",
};

const generateApiKey = () => {
  return 'sk_live_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

const Settings = () => {
  const { toast } = useToast();
  
  const [settings, setSettings] = useState(defaultSettings);
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [testPlayerOpen, setTestPlayerOpen] = useState(false);
  const [testStreamUrl, setTestStreamUrl] = useState('');
  const [testStreamName, setTestStreamName] = useState('');
  const [nginxConfigOpen, setNginxConfigOpen] = useState(false);
  const [sshControlOpen, setSshControlOpen] = useState(false);

  useEffect(() => {
    // Load settings from localStorage and merge with defaults
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        // Merge saved settings with defaults to ensure new fields are included
        setSettings({ ...defaultSettings, ...parsed });
      } catch {
        setSettings(defaultSettings);
      }
    }
    
    // Load or generate API key
    let savedApiKey = localStorage.getItem(API_KEY_KEY);
    if (!savedApiKey) {
      savedApiKey = generateApiKey();
      localStorage.setItem(API_KEY_KEY, savedApiKey);
    }
    setApiKey(savedApiKey);
    setLoading(false);
  }, []);

  const handleSave = () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    toast({ title: "Spremljeno", description: "Postavke su uspješno spremljene" });
  };

  const handleRegenerateKey = () => {
    const newKey = generateApiKey();
    setApiKey(newKey);
    localStorage.setItem(API_KEY_KEY, newKey);
    toast({ title: "Generirano", description: "Novi API ključ je generiran" });
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    toast({ title: "Kopirano", description: "API ključ kopiran u clipboard" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <div className="lg:ml-64">
        <Header />
        
        <main className="p-4 lg:p-6">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Postavke</h2>
              <p className="text-muted-foreground">Konfiguracija server panela</p>
            </div>
            <Button variant="glow" onClick={handleSave}>
              <Save className="h-4 w-4" />
              Spremi
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* General Settings */}
            <div className="glass rounded-xl p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">General</h3>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Server Name</Label>
                  <Input
                    value={settings.serverName}
                    onChange={(e) => setSettings({ ...settings, serverName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Domain</Label>
                  <Input
                    value={settings.serverDomain}
                    onChange={(e) => setSettings({ ...settings, serverDomain: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Admin Email</Label>
                  <Input
                    type="email"
                    value={settings.adminEmail}
                    onChange={(e) => setSettings({ ...settings, adminEmail: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Limits */}
            <div className="glass rounded-xl p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/20">
                  <Database className="h-5 w-5 text-warning" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Limits</h3>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Max Users</Label>
                  <Input
                    type="number"
                    value={settings.maxUsers}
                    onChange={(e) => setSettings({ ...settings, maxUsers: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Connections</Label>
                  <Input
                    type="number"
                    value={settings.maxConnections}
                    onChange={(e) => setSettings({ ...settings, maxConnections: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Backup Interval (hours)</Label>
                  <Input
                    type="number"
                    value={settings.backupInterval}
                    onChange={(e) => setSettings({ ...settings, backupInterval: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Security */}
            <div className="glass rounded-xl p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/20">
                  <Shield className="h-5 w-5 text-success" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Security</h3>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable SSL</Label>
                    <p className="text-sm text-muted-foreground">Force HTTPS connections</p>
                  </div>
                  <Switch
                    checked={settings.enableSSL}
                    onCheckedChange={(checked) => setSettings({ ...settings, enableSSL: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Two-Factor Auth</Label>
                    <p className="text-sm text-muted-foreground">Require 2FA for admin login</p>
                  </div>
                  <Switch
                    checked={settings.enableTwoFactor}
                    onCheckedChange={(checked) => setSettings({ ...settings, enableTwoFactor: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>API Access</Label>
                    <p className="text-sm text-muted-foreground">Enable REST API</p>
                  </div>
                  <Switch
                    checked={settings.apiEnabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, apiEnabled: checked })}
                  />
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div className="glass rounded-xl p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20">
                  <Bell className="h-5 w-5 text-accent" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">System</h3>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Send alerts via email</p>
                  </div>
                  <Switch
                    checked={settings.enableNotifications}
                    onCheckedChange={(checked) => setSettings({ ...settings, enableNotifications: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto Backup</Label>
                    <p className="text-sm text-muted-foreground">Automatic database backup</p>
                  </div>
                  <Switch
                    checked={settings.enableBackup}
                    onCheckedChange={(checked) => setSettings({ ...settings, enableBackup: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Debug Mode</Label>
                    <p className="text-sm text-muted-foreground">Enable verbose logging</p>
                  </div>
                  <Switch
                    checked={settings.debugMode}
                    onCheckedChange={(checked) => setSettings({ ...settings, debugMode: checked })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Streaming Server Configuration */}
          <div className="mt-6 glass rounded-xl p-6">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/20">
                  <Server className="h-5 w-5 text-destructive" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Streaming Server</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setSshControlOpen(true)}>
                  <Terminal className="h-4 w-4 mr-1" />
                  SSH
                </Button>
                <Button variant="outline" size="sm" onClick={() => setNginxConfigOpen(true)}>
                  <FileCode className="h-4 w-4 mr-1" />
                  nginx.conf
                </Button>
              </div>
            </div>
            
            {/* Basic Connection */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Osnovna konekcija</h4>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label>Server IP / Hostname</Label>
                  <Input
                    placeholder="38.18.100.86"
                    value={settings.streamServerIp}
                    onChange={(e) => setSettings({ ...settings, streamServerIp: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>RTMP Port</Label>
                  <Input
                    type="number"
                    placeholder="1935"
                    value={settings.streamServerPort}
                    onChange={(e) => setSettings({ ...settings, streamServerPort: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>HTTP Port (HLS)</Label>
                  <Input
                    type="number"
                    placeholder="8080"
                    value={settings.streamHttpPort}
                    onChange={(e) => setSettings({ ...settings, streamHttpPort: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>HLS Path</Label>
                  <Input
                    placeholder="/live"
                    value={settings.streamHlsPath}
                    onChange={(e) => setSettings({ ...settings, streamHlsPath: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* HLS Configuration */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">HLS Konfiguracija</h4>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label>Segment Duration (s)</Label>
                  <Input
                    type="number"
                    placeholder="2"
                    value={settings.hlsSegmentDuration}
                    onChange={(e) => setSettings({ ...settings, hlsSegmentDuration: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Playlist Length</Label>
                  <Input
                    type="number"
                    placeholder="6"
                    value={settings.hlsPlaylistLength}
                    onChange={(e) => setSettings({ ...settings, hlsPlaylistLength: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Bitrate (kbps)</Label>
                  <Input
                    type="number"
                    placeholder="8000"
                    value={settings.maxBitrate}
                    onChange={(e) => setSettings({ ...settings, maxBitrate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Allowed Codecs</Label>
                  <Input
                    placeholder="h264,aac"
                    value={settings.allowedCodecs}
                    onChange={(e) => setSettings({ ...settings, allowedCodecs: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Paths */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Putanje</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>FFmpeg Path</Label>
                  <Input
                    placeholder="/usr/bin/ffmpeg"
                    value={settings.ffmpegPath}
                    onChange={(e) => setSettings({ ...settings, ffmpegPath: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Recordings Path</Label>
                  <Input
                    placeholder="/var/www/recordings"
                    value={settings.recordingsPath}
                    onChange={(e) => setSettings({ ...settings, recordingsPath: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Transcoding */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Transcoding</h4>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-center justify-between col-span-1">
                  <div>
                    <Label>Enable Transcoding</Label>
                    <p className="text-xs text-muted-foreground">Re-encode streams</p>
                  </div>
                  <Switch
                    checked={settings.enableTranscoding}
                    onCheckedChange={(checked) => setSettings({ ...settings, enableTranscoding: checked })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preset</Label>
                  <Input
                    placeholder="medium"
                    value={settings.transcodingPreset}
                    onChange={(e) => setSettings({ ...settings, transcodingPreset: e.target.value })}
                    disabled={!settings.enableTranscoding}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bitrate (kbps)</Label>
                  <Input
                    type="number"
                    placeholder="4000"
                    value={settings.transcodingBitrate}
                    onChange={(e) => setSettings({ ...settings, transcodingBitrate: e.target.value })}
                    disabled={!settings.enableTranscoding}
                  />
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Značajke</h4>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>SSL/HTTPS</Label>
                    <p className="text-xs text-muted-foreground">Za stream URL-ove</p>
                  </div>
                  <Switch
                    checked={settings.streamUseSSL}
                    onCheckedChange={(checked) => setSettings({ ...settings, streamUseSSL: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>DVR/Timeshift</Label>
                    <p className="text-xs text-muted-foreground">Snimanje streamova</p>
                  </div>
                  <Switch
                    checked={settings.enableDVR}
                    onCheckedChange={(checked) => setSettings({ ...settings, enableDVR: checked })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>DVR Duration (h)</Label>
                  <Input
                    type="number"
                    placeholder="24"
                    value={settings.dvrDuration}
                    onChange={(e) => setSettings({ ...settings, dvrDuration: e.target.value })}
                    disabled={!settings.enableDVR}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Stream Auth</Label>
                    <p className="text-xs text-muted-foreground">Zahtjev za auth</p>
                  </div>
                  <Switch
                    checked={settings.enableAuth}
                    onCheckedChange={(checked) => setSettings({ ...settings, enableAuth: checked })}
                  />
                </div>
              </div>
            </div>

            {/* Stream Key */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Stream Key</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Stream Key Prefix</Label>
                  <Input
                    placeholder="live_"
                    value={settings.streamKeyPrefix}
                    onChange={(e) => setSettings({ ...settings, streamKeyPrefix: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Test Stream URL Generator */}
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                <Play className="h-4 w-4" />
                Test Stream URL
              </h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm">Stream ime za test</Label>
                  <Input
                    id="testStreamName"
                    placeholder="hbo, sport1, movie..."
                    defaultValue="hbo"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="p-3 bg-background rounded-md border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Generirani URL:</p>
                  <code className="text-sm text-primary break-all">
                    {settings.streamServerIp 
                      ? `${settings.streamUseSSL ? 'https' : 'http'}://${settings.streamServerIp}:${settings.streamHttpPort}${settings.streamHlsPath || '/live'}/[stream]/index.m3u8`
                      : 'Unesi Server IP za generiranje URL-a'}
                  </code>
                </div>
                {settings.streamServerIp && (
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const streamName = (document.getElementById('testStreamName') as HTMLInputElement)?.value || 'test';
                        const url = `${settings.streamUseSSL ? 'https' : 'http'}://${settings.streamServerIp}:${settings.streamHttpPort}${settings.streamHlsPath || '/live'}/${streamName}/index.m3u8`;
                        navigator.clipboard.writeText(url);
                        toast({ title: "Kopirano", description: "Stream URL kopiran" });
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Kopiraj URL
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const streamName = (document.getElementById('testStreamName') as HTMLInputElement)?.value || 'test';
                        const url = `${settings.streamUseSSL ? 'https' : 'http'}://${settings.streamServerIp}:${settings.streamHttpPort}${settings.streamHlsPath || '/live'}/${streamName}/index.m3u8`;
                        window.open(url, '_blank');
                      }}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Otvori u novom tabu
                    </Button>
                    <Button 
                      variant="default" 
                      size="sm"
                      onClick={() => {
                        const streamName = (document.getElementById('testStreamName') as HTMLInputElement)?.value || 'test';
                        const url = `${settings.streamUseSSL ? 'https' : 'http'}://${settings.streamServerIp}:${settings.streamHttpPort}${settings.streamHlsPath || '/live'}/${streamName}/index.m3u8`;
                        setTestStreamUrl(url);
                        setTestStreamName(streamName);
                        setTestPlayerOpen(true);
                      }}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Testiraj Stream
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Server Tools - Prominent Section */}
            <div className="mt-6 p-4 rounded-lg bg-primary/10 border-2 border-primary/30">
              <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Terminal className="h-5 w-5 text-primary" />
                Alati za server
              </h4>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1 justify-center"
                  onClick={() => setSshControlOpen(true)}
                >
                  <Terminal className="h-4 w-4 mr-2" />
                  SSH Kontrola
                </Button>
                <Button 
                  variant="default" 
                  className="flex-1 justify-center"
                  onClick={() => setNginxConfigOpen(true)}
                >
                  <FileCode className="h-4 w-4 mr-2" />
                  Generiraj nginx.conf
                </Button>
              </div>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              Konfiguriraj adresu streaming servera (nginx-rtmp, FFmpeg, itd.) za generiranje ispravnih stream URL-ova.
            </p>

            <StreamTestPlayer 
              open={testPlayerOpen} 
              onOpenChange={setTestPlayerOpen} 
              streamUrl={testStreamUrl}
              streamName={testStreamName}
            />

            <NginxConfigGenerator 
              open={nginxConfigOpen}
              onOpenChange={setNginxConfigOpen}
              settings={settings}
            />

            <ServerSSHControl 
              open={sshControlOpen}
              onOpenChange={setSshControlOpen}
            />
          </div>

          {/* API Key Section */}
          <div className="mt-6 glass rounded-xl p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                <Key className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">API Ključ</h3>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                value={apiKey}
                readOnly
                className="flex-1 font-mono text-xs sm:text-sm"
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleRegenerateKey} className="flex-1 sm:flex-none">
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Regeneriraj
                </Button>
                <Button variant="outline" onClick={handleCopyKey} className="flex-1 sm:flex-none">
                  <Copy className="h-4 w-4 mr-1" />
                  Kopiraj
                </Button>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Koristi ovaj ključ za pristup StreamPanel API-ju. Čuvaj ga tajnim!
            </p>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Settings;
