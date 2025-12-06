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

  const fetchData = async () => {
    setLoading(true);

    // Fetch from Supabase
    const [streamsRes, serversRes, usersRes] = await Promise.all([
      supabase.from("streams").select("*").order("created_at", { ascending: false }).limit(10),
      supabase.from("servers").select("*").order("created_at", { ascending: false }),
      supabase.from("streaming_users").select("*")
    ]);

    const streams = streamsRes.data || [];
    const serversList = serversRes.data || [];
    const usersList = usersRes.data || [];

    // Calculate stats from Supabase data
    const activeStreams = streams.filter((s) => s.status === "live").length;
    const onlineServers = serversList.filter((s) => s.status === "online").length;
    const onlineUsers = usersList.filter((u) => u.status === "online").length;
    const activeConnections = usersList.reduce((sum, u) => sum + (u.connections || 0), 0);

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

    setStats({
      totalStreams: streams.length,
      activeStreams,
      totalViewers: activeConnections, // Active connections = viewers
      totalServers: serversList.length,
      onlineServers,
      avgCpu,
      avgMemory,
      avgDisk,
      avgNetwork,
      totalUsers: usersList.length,
      onlineUsers,
      activeConnections,
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
  }, []);

  return {
    stats,
    recentStreams,
    servers,
    loading,
    refetch: fetchData,
  };
};
