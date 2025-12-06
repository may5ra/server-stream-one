import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/useSettings";

export interface DashboardStats {
  totalStreams: number;
  activeStreams: number;
  totalViewers: number;
  totalServers: number;
  onlineServers: number;
  avgCpu: number;
  avgMemory: number;
  avgDisk: number;
  avgNetwork: number;
  totalUsers: number;
  onlineUsers: number;
  activeConnections: number;
}

export interface RecentStream {
  id: string;
  name: string;
  status: string;
  viewers: number;
  bitrate: number;
  input_type: string;
  created_at: string;
}

export interface ServerInfo {
  id: string;
  name: string;
  status: string;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_usage: number;
  ip_address: string;
}

export const useDashboardStats = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalStreams: 0,
    activeStreams: 0,
    totalViewers: 0,
    totalServers: 0,
    onlineServers: 0,
    avgCpu: 0,
    avgMemory: 0,
    avgDisk: 0,
    avgNetwork: 0,
    totalUsers: 0,
    onlineUsers: 0,
    activeConnections: 0,
  });
  const [recentStreams, setRecentStreams] = useState<RecentStream[]>([]);
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const { settings } = useSettings();

  const getDockerUrl = () => {
    const domain = settings?.serverDomain || "";
    if (!domain) return null;
    const protocol = settings?.enableSSL ? "https" : "http";
    return `${protocol}://${domain}`;
  };

  const fetchData = async () => {
    setLoading(true);

    // Fetch from Supabase (basic data)
    const [streamsRes, serversRes] = await Promise.all([
      supabase.from("streams").select("*").order("created_at", { ascending: false }).limit(10),
      supabase.from("servers").select("*").order("created_at", { ascending: false }),
    ]);

    const streams = streamsRes.data || [];
    const serversList = serversRes.data || [];

    // Calculate stream stats
    const activeStreams = streams.filter((s) => s.status === "live").length;
    const onlineServers = serversList.filter((s) => s.status === "online").length;

    // Calculate averages from online servers
    const onlineServersList = serversList.filter((s) => s.status === "online");
    const avgCpu = onlineServersList.length > 0
      ? Math.round(onlineServersList.reduce((sum, s) => sum + (s.cpu_usage || 0), 0) / onlineServersList.length)
      : 0;
    const avgMemory = onlineServersList.length > 0
      ? Math.round(onlineServersList.reduce((sum, s) => sum + (s.memory_usage || 0), 0) / onlineServersList.length)
      : 0;
    const avgDisk = onlineServersList.length > 0
      ? Math.round(onlineServersList.reduce((sum, s) => sum + (s.disk_usage || 0), 0) / onlineServersList.length)
      : 0;
    const avgNetwork = onlineServersList.length > 0
      ? Math.round(onlineServersList.reduce((sum, s) => sum + (s.network_usage || 0), 0) / onlineServersList.length)
      : 0;

    // Fetch real-time stats from Docker backend (if available)
    let dockerStats = {
      totalUsers: 0,
      onlineUsers: 0,
      activeConnections: 0,
    };

    const dockerUrl = getDockerUrl();
    if (dockerUrl) {
      try {
        const response = await fetch(`${dockerUrl}/api/stats`);
        if (response.ok) {
          const data = await response.json();
          dockerStats = {
            totalUsers: data.users?.total || 0,
            onlineUsers: data.users?.online || 0,
            activeConnections: data.users?.activeConnections || 0,
          };
        }
      } catch (error) {
        console.log("[Dashboard] Could not fetch Docker stats, using Supabase fallback");
        // Fallback to Supabase data
        const usersRes = await supabase.from("streaming_users").select("*");
        const usersList = usersRes.data || [];
        dockerStats = {
          totalUsers: usersList.length,
          onlineUsers: usersList.filter((u) => u.status === "online").length,
          activeConnections: usersList.reduce((sum, u) => sum + (u.connections || 0), 0),
        };
      }
    } else {
      // No Docker URL, use Supabase
      const usersRes = await supabase.from("streaming_users").select("*");
      const usersList = usersRes.data || [];
      dockerStats = {
        totalUsers: usersList.length,
        onlineUsers: usersList.filter((u) => u.status === "online").length,
        activeConnections: usersList.reduce((sum, u) => sum + (u.connections || 0), 0),
      };
    }

    setStats({
      totalStreams: streams.length,
      activeStreams,
      totalViewers: dockerStats.activeConnections,
      totalServers: serversList.length,
      onlineServers,
      avgCpu,
      avgMemory,
      avgDisk,
      avgNetwork,
      ...dockerStats,
    });

    setRecentStreams(streams.slice(0, 5));
    setServers(serversList);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    
    // Refresh stats every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [settings?.serverDomain]);

  return {
    stats,
    recentStreams,
    servers,
    loading,
    refetch: fetchData,
  };
};
