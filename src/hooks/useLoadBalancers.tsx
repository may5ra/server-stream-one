import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface LoadBalancer {
  id: string;
  name: string;
  server_id: string | null;
  ip_address: string;
  port: number;
  status: string;
  max_streams: number;
  current_streams: number;
  created_at: string;
  updated_at: string;
}

export const useLoadBalancers = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: loadBalancers = [], isLoading, refetch } = useQuery({
    queryKey: ["load-balancers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("load_balancers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as LoadBalancer[];
    },
  });

  const addLoadBalancer = useMutation({
    mutationFn: async (lb: Omit<LoadBalancer, "id" | "created_at" | "updated_at" | "current_streams">) => {
      const { data, error } = await supabase
        .from("load_balancers")
        .insert(lb)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["load-balancers"] });
      toast({ title: "Load Balancer dodan" });
    },
    onError: (error) => {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    },
  });

  const updateLoadBalancer = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LoadBalancer> & { id: string }) => {
      const { data, error } = await supabase
        .from("load_balancers")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["load-balancers"] });
      toast({ title: "Load Balancer ažuriran" });
    },
    onError: (error) => {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    },
  });

  const deleteLoadBalancer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("load_balancers")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["load-balancers"] });
      toast({ title: "Load Balancer obrisan" });
    },
    onError: (error) => {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    },
  });

  return {
    loadBalancers,
    isLoading,
    refetch,
    addLoadBalancer,
    updateLoadBalancer,
    deleteLoadBalancer,
  };
};
