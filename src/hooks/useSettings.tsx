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
    const encodedName = encodeURIComponent(streamName);
    
    // Determine if we're in Lovable cloud preview
    const isLovablePreview = window.location.hostname.includes('lovable.app') || 
                              window.location.hostname.includes('lovableproject.com');
    
    // For HLS streams, use proxy to bypass CORS
    if (inputType === 'hls' && inputUrl) {
      // If running in Lovable preview, use Supabase edge function
      if (isLovablePreview) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        if (supabaseUrl) {
          return `${supabaseUrl}/functions/v1/stream-proxy/${encodedName}/index.m3u8`;
        }
      }
      
      // For self-hosted Docker, use local proxy endpoint
      // Use current host (which should be the Docker nginx on port 80)
      const domain = settings.serverDomain || window.location.host;
      const protocol = settings.enableSSL ? 'https' : (window.location.protocol === 'https:' ? 'https' : 'http');
      return `${protocol}://${domain}/proxy/${encodedName}/index.m3u8`;
    }
    
    // For RTMP/SRT/other streams, construct the output URL
    const domain = settings.serverDomain || window.location.host;
    const protocol = settings.enableSSL ? 'https' : (window.location.protocol === 'https:' ? 'https' : 'http');
    
    return `${protocol}://${domain}/live/${streamName}/playlist.m3u8`;
  };

  return {
    settings,
    loading,
    saveSettings,
    getStreamUrl,
  };
};
