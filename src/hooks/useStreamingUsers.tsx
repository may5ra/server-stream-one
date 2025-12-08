import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/useSettings";

export interface StreamingUser {
  id: string;
  username: string;
  password: string;
  status: "online" | "offline" | "expired";
  connections: number;
  max_connections: number;
  expiry_date: string;
  last_active: string | null;
  created_at: string;
  reseller_id?: string | null;
  bouquets?: string[];
}

export const useStreamingUsers = () => {
  const [users, setUsers] = useState<StreamingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { settings } = useSettings();

  // Get Docker server URL from settings
  const getDockerUrl = () => {
    const domain = settings?.serverDomain || "";
    if (!domain) return null;
    const protocol = settings?.enableSSL ? "https" : "http";
    return `${protocol}://${domain}`;
  };

  // Sync user to Docker server
  const syncToDocker = async (user: any, action: "upsert" | "delete") => {
    const dockerUrl = getDockerUrl();
    if (!dockerUrl) return;

    try {
      if (action === "delete") {
        await fetch(`${dockerUrl}/api/streaming-users/sync/${user.id}`, {
          method: "DELETE",
        });
      } else {
        await fetch(`${dockerUrl}/api/streaming-users/sync-one`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user),
        });
      }
      console.log(`[Sync] ${action} user ${user.username} to Docker`);
    } catch (error) {
      console.error(`[Sync] Failed to ${action} user to Docker:`, error);
    }
  };

  // Sync all users to Docker
  const syncAllToDocker = async () => {
    const dockerUrl = getDockerUrl();
    if (!dockerUrl) {
      toast({ title: "Error", description: "Server domain not configured", variant: "destructive" });
      return;
    }

    try {
      const response = await fetch(`${dockerUrl}/api/streaming-users/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users }),
      });
      const result = await response.json();
      toast({ title: "Sync Complete", description: `Synced ${result.synced} users to Docker` });
    } catch (error: any) {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("streaming_users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mappedUsers = (data || []).map((u) => ({
        ...u,
        status: checkExpiry(u.expiry_date, u.status) as StreamingUser["status"],
        connections: u.connections || 0,
        max_connections: u.max_connections || 1,
      }));

      setUsers(mappedUsers);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const checkExpiry = (expiryDate: string, currentStatus: string): string => {
    const expiry = new Date(expiryDate);
    const now = new Date();
    if (expiry < now) return "expired";
    return currentStatus;
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const addUser = async (user: {
    username: string;
    password: string;
    max_connections: number;
    expiry_date: string;
    bouquets?: string[];
  }) => {
    const { data, error } = await supabase
      .from("streaming_users")
      .insert([{ 
        username: user.username,
        password: user.password,
        max_connections: user.max_connections,
        expiry_date: user.expiry_date,
        bouquets: user.bouquets || [],
        status: "offline", 
        connections: 0 
      }])
      .select()
      .single();

    if (error) throw error;

    // Sync to Docker
    await syncToDocker(data, "upsert");

    setUsers((prev) => [{ ...data, status: data.status as StreamingUser["status"] }, ...prev]);
    return data;
  };

  const updateUser = async (id: string, updates: Partial<StreamingUser>) => {
    const { data, error } = await supabase
      .from("streaming_users")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Sync to Docker
    if (data) {
      await syncToDocker(data, "upsert");
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...updates } : u))
    );
  };

  const deleteUser = async (id: string) => {
    const userToDelete = users.find((u) => u.id === id);
    
    const { error } = await supabase
      .from("streaming_users")
      .delete()
      .eq("id", id);

    if (error) throw error;

    // Sync to Docker
    if (userToDelete) {
      await syncToDocker(userToDelete, "delete");
    }

    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  return {
    users,
    loading,
    addUser,
    updateUser,
    deleteUser,
    refetch: fetchUsers,
    syncAllToDocker,
  };
};
