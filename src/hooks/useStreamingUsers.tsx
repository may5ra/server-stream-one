import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
}

export const useStreamingUsers = () => {
  const [users, setUsers] = useState<StreamingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

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
  }) => {
    const { data, error } = await supabase
      .from("streaming_users")
      .insert([{ ...user, status: "offline", connections: 0 }])
      .select()
      .single();

    if (error) throw error;

    setUsers((prev) => [{ ...data, status: data.status as StreamingUser["status"] }, ...prev]);
    return data;
  };

  const updateUser = async (id: string, updates: Partial<StreamingUser>) => {
    const { error } = await supabase
      .from("streaming_users")
      .update(updates)
      .eq("id", id);

    if (error) throw error;

    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...updates } : u))
    );
  };

  const deleteUser = async (id: string) => {
    const { error } = await supabase
      .from("streaming_users")
      .delete()
      .eq("id", id);

    if (error) throw error;

    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  return {
    users,
    loading,
    addUser,
    updateUser,
    deleteUser,
    refetch: fetchUsers,
  };
};
