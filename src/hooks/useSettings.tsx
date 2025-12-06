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
    // For HLS streams, use proxy to bypass CORS
    if (inputType === 'hls' && inputUrl) {
      const encodedName = encodeURIComponent(streamName);
      
      // If running in Lovable preview, use Supabase edge function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (supabaseUrl && window.location.hostname.includes('lovable')) {
        return `${supabaseUrl}/functions/v1/stream-proxy/${encodedName}/index.m3u8`;
      }
      
      // For self-hosted Docker, use local proxy endpoint
      const domain = settings.serverDomain || window.location.host;
      const protocol = settings.enableSSL ? 'https' : 'http';
      return `${protocol}://${domain}/proxy/${encodedName}/index.m3u8`;
    }
    
    // For RTMP/SRT/other streams, construct the output URL
    const domain = settings.serverDomain || window.location.host;
    const protocol = settings.enableSSL ? 'https' : 'http';
    
    return `${protocol}://${domain}/live/${streamName}/playlist.m3u8`;
  };

  return {
    settings,
    loading,
    saveSettings,
    getStreamUrl,
  };
};
