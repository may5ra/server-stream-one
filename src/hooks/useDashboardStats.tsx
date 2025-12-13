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
  uptime: string;
  totalLBs: number;
  activeLBs: number;
}

export interface RecentStream {
  id: string;
  name: string;
  status: string;
  viewers: number;
  bitrate: number;
  input_type: string;
  created_at: string;
  online_since?: string;
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
  uptime?: string;
  connections: number;
  streamsLive: number;
  requestsPerSec: number;
  inputMbps: number;
  outputMbps: number;
}

export interface ActiveConnection {
  userId: string;
  username?: string;
  streamName: string;
  lastSeen: string;
  duration: number;
  ip?: string;
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
    uptime: "0m",
    totalLBs: 0,
    activeLBs: 0,
  });
  const [recentStreams, setRecentStreams] = useState<RecentStream[]>([]);
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [activeConnections, setActiveConnections] = useState<ActiveConnection[]>([]);
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
    const [streamsRes, serversRes, usersRes, lbRes] = await Promise.all([
      supabase.from("streams").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("servers").select("*").order("created_at", { ascending: false }),
      supabase.from("streaming_users").select("*"),
      supabase.from("load_balancers").select("*"),
    ]);

    const streams = streamsRes.data || [];
    const serversList = serversRes.data || [];
    const usersList = usersRes.data || [];
    const lbList = lbRes.data || [];

    // Calculate stream stats
    const activeStreams = streams.filter((s) => s.status === "live").length;
    const onlineServers = serversList.filter((s) => s.status === "online").length;
    const activeLBs = lbList.filter((lb) => lb.status === "active").length;

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

    // Calculate total connections from Load Balancers (real viewers)
    let totalLBConnections = 0;
    for (const lb of lbList) {
      if (lb.status === "active" && lb.ip_address) {
        try {
          const statusUrl = `http://${lb.ip_address}:${lb.nginx_port || 8080}/status`;
          const response = await fetch(statusUrl, { signal: AbortSignal.timeout(3000) });
          if (response.ok) {
            // Try to get nginx stub_status for connections count
            const stubUrl = `http://${lb.ip_address}:3002/stats`;
            try {
              const statsRes = await fetch(stubUrl, { signal: AbortSignal.timeout(2000) });
              if (statsRes.ok) {
                const statsData = await statsRes.json();
                totalLBConnections += statsData.connections || 0;
              }
            } catch {
              // Agent stats not available, use current_streams as estimate
              totalLBConnections += lb.current_streams || 0;
            }
          }
        } catch {
          // LB not reachable
        }
      }
    }

    // Use LB connections if available, otherwise fall back to user connections
    const activeConnectionsFromUsers = usersList.reduce((sum, u) => sum + (u.connections || 0), 0);
    const activeConnectionsTotal = totalLBConnections > 0 ? totalLBConnections : activeConnectionsFromUsers;

    // Default stats from Supabase
    let finalStats = {
      totalUsers: usersList.length,
      onlineUsers: usersList.filter((u) => u.status === "online").length,
      activeConnections: activeConnectionsTotal,
      uptime: "0m",
      serversList: serversList,
      connections: [] as ActiveConnection[],
    };

    // Fetch real-time stats from Docker backend (if available)
    const dockerUrl = getDockerUrl();
    if (dockerUrl) {
      try {
        const response = await fetch(`${dockerUrl}/api/stats`, {
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          const data = await response.json();
          
          finalStats = {
            totalUsers: data.users?.total || finalStats.totalUsers,
            onlineUsers: data.users?.online || finalStats.onlineUsers,
            activeConnections: data.users?.activeConnections || finalStats.activeConnections,
            uptime: data.system?.uptime || "0m",
            serversList: data.servers?.list || serversList,
            connections: data.connections || [],
          };
          
          // Update stream viewers from real connections
          if (data.streams?.viewers) {
            // Viewers from backend
          }
        }
      } catch (error) {
        console.log("[Dashboard] Docker stats unavailable, using Supabase data");
      }
    }

    // Merge server data with per-server metrics
    const mergedServers = finalStats.serversList.map((s: any) => {
      // Calculate per-server metrics (simulated from available data or real if from backend)
      const serverConnections = s.connections || Math.floor(finalStats.activeConnections / Math.max(1, finalStats.serversList.length));
      const serverStreams = s.streamsLive || 0;
      
      return {
        id: s.id,
        name: s.name,
        status: s.status,
        cpu_usage: s.cpu_usage || 0,
        memory_usage: s.memory_usage || 0,
        disk_usage: s.disk_usage || 0,
        network_usage: s.network_usage || 0,
        ip_address: s.ip_address,
        uptime: s.uptime || finalStats.uptime,
        connections: serverConnections,
        streamsLive: serverStreams,
        requestsPerSec: s.requestsPerSec || Math.round(serverConnections * 2.5),
        inputMbps: s.inputMbps || Math.round((s.network_usage || 0) * 0.3),
        outputMbps: s.outputMbps || Math.round((s.network_usage || 0) * 0.7),
      };
    });

    setStats({
      totalStreams: streams.length,
      activeStreams,
      totalViewers: finalStats.activeConnections,
      totalServers: serversList.length,
      onlineServers,
      avgCpu,
      avgMemory,
      avgDisk,
      avgNetwork,
      totalUsers: finalStats.totalUsers,
      onlineUsers: finalStats.onlineUsers,
      activeConnections: finalStats.activeConnections,
      uptime: finalStats.uptime,
      totalLBs: lbList.length,
      activeLBs,
    });

    setRecentStreams(streams.slice(0, 10) as RecentStream[]);
    setServers(mergedServers);
    setActiveConnections(finalStats.connections);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // No auto-refresh - user can manually refresh if needed
  }, [settings?.serverDomain]);

  return {
    stats,
    recentStreams,
    servers,
    activeConnections,
    loading,
    refetch: fetchData,
  };
};
