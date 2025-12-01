import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  });
  const [recentStreams, setRecentStreams] = useState<RecentStream[]>([]);
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);

    // Fetch streams
    const { data: streamsData } = await supabase
      .from("streams")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch servers
    const { data: serversData } = await supabase
      .from("servers")
      .select("*")
      .order("created_at", { ascending: false });

    const streams = streamsData || [];
    const serversList = serversData || [];

    // Calculate stats
    const activeStreams = streams.filter((s) => s.status === "live").length;
    const totalViewers = streams.reduce((sum, s) => sum + (s.viewers || 0), 0);
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

    setStats({
      totalStreams: streams.length,
      activeStreams,
      totalViewers,
      totalServers: serversList.length,
      onlineServers,
      avgCpu,
      avgMemory,
      avgDisk,
      avgNetwork,
    });

    setRecentStreams(streams.slice(0, 5));
    setServers(serversList);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    stats,
    recentStreams,
    servers,
    loading,
    refetch: fetchData,
  };
};
