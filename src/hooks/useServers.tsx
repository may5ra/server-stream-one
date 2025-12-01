import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Server {
  id: string;
  name: string;
  ip_address: string;
  status: string;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_usage: number;
  uptime: string | null;
  os: string | null;
  location: string | null;
}

export const useServers = () => {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchServers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("servers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Greška", description: "Nije moguće učitati servere", variant: "destructive" });
    } else {
      setServers(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const addServer = async (server: { name: string; ip_address: string; os: string; location: string }) => {
    const { data, error } = await supabase
      .from("servers")
      .insert({
        name: server.name,
        ip_address: server.ip_address,
        os: server.os,
        location: server.location,
        status: "offline",
        cpu_usage: 0,
        memory_usage: 0,
        disk_usage: 0,
        network_usage: 0,
        uptime: "0 days",
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
      return null;
    }

    setServers((prev) => [data, ...prev]);
    toast({ title: "Uspješno", description: "Server dodan" });
    return data;
  };

  const updateServer = async (id: string, updates: Partial<Server>) => {
    const { error } = await supabase
      .from("servers")
      .update(updates)
      .eq("id", id);

    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
      return false;
    }

    setServers((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    return true;
  };

  const deleteServer = async (id: string) => {
    const { error } = await supabase.from("servers").delete().eq("id", id);

    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
      return false;
    }

    setServers((prev) => prev.filter((s) => s.id !== id));
    toast({ title: "Obrisano", description: "Server uklonjen" });
    return true;
  };

  const restartServer = async (id: string) => {
    toast({ title: "Restart", description: "Server restart pokrenut..." });
    await updateServer(id, { status: "maintenance" });

    setTimeout(async () => {
      await updateServer(id, {
        status: "online",
        cpu_usage: Math.floor(Math.random() * 50),
        memory_usage: Math.floor(Math.random() * 60) + 20,
      });
      toast({ title: "Uspješno", description: "Server restartiran" });
    }, 3000);
  };

  const togglePower = async (id: string) => {
    const server = servers.find((s) => s.id === id);
    if (!server) return;

    const newStatus = server.status === "online" ? "offline" : "online";
    await updateServer(id, {
      status: newStatus,
      cpu_usage: newStatus === "online" ? Math.floor(Math.random() * 50) : 0,
      memory_usage: newStatus === "online" ? Math.floor(Math.random() * 60) + 20 : 0,
      network_usage: newStatus === "online" ? Math.floor(Math.random() * 100) : 0,
    });
  };

  return {
    servers,
    loading,
    addServer,
    updateServer,
    deleteServer,
    restartServer,
    togglePower,
    refetch: fetchServers,
  };
};
