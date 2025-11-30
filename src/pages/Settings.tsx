import { useState, useEffect } from "react";
import { Save, Shield, Bell, Globe, Database, Key, Copy, RefreshCw } from "lucide-react";
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

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
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
