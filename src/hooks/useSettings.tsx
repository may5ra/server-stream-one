import { useState, useEffect } from "react";

const SETTINGS_KEY = 'streampanel_settings';

export interface PanelSettings {
  serverName: string;
  serverDomain: string;
  adminEmail: string;
  maxUsers: string;
  maxConnections: string;
  enableSSL: boolean;
  enableBackup: boolean;
  backupInterval: string;
  enableNotifications: boolean;
  enableTwoFactor: boolean;
  apiEnabled: boolean;
  debugMode: boolean;
}

const defaultSettings: PanelSettings = {
  serverName: "StreamPanel",
  serverDomain: "",
  adminEmail: "",
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

export const useSettings = () => {
  const [settings, setSettings] = useState<PanelSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch {
        setSettings(defaultSettings);
      }
    }
    setLoading(false);
  }, []);

  const saveSettings = (newSettings: PanelSettings) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    setSettings(newSettings);
  };

  const getStreamUrl = (streamName: string, inputType?: string, inputUrl?: string) => {
    const domain = settings.serverDomain || 'your-server.com';
    const protocol = settings.enableSSL ? 'https' : 'http';
    
    // For HLS/HTTP external streams, use proxy location
    if (inputType === 'hls' && inputUrl) {
      const slug = streamName.toLowerCase().replace(/\s+/g, '-');
      return `${protocol}://${domain}/proxy/${slug}/manifest.m3u8`;
    }
    
    // For RTMP/local streams, use standard live path
    return `${protocol}://${domain}/live/${streamName}/playlist.m3u8`;
  };

  return {
    settings,
    loading,
    saveSettings,
    getStreamUrl,
  };
};
