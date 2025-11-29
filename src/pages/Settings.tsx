import { useState } from "react";
import { Save, Shield, Bell, Globe, Database, Key } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const Settings = () => {
  const { toast } = useToast();
  
  const [settings, setSettings] = useState({
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
  });

  const handleSave = () => {
    toast({ title: "Settings Saved", description: "Your settings have been updated successfully" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <div className="ml-64">
        <Header />
        
        <main className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Settings</h2>
              <p className="text-muted-foreground">Configure your server panel</p>
            </div>
            <Button variant="glow" onClick={handleSave}>
              <Save className="h-4 w-4" />
              Save Changes
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
              <h3 className="text-lg font-semibold text-foreground">API Key</h3>
            </div>
            
            <div className="flex gap-4">
              <Input
                value="sk_live_xxxxxxxxxxxxxxxxxxxxxxxxx"
                readOnly
                className="flex-1 font-mono"
              />
              <Button variant="outline">Regenerate</Button>
              <Button variant="outline">Copy</Button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Use this key to access the StreamPanel API. Keep it secret!
            </p>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Settings;
