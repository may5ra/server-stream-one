import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SystemUpdate {
  id: string;
  version: string;
  changelog: string | null;
  is_available: boolean;
  released_at: string;
  applied_at: string | null;
  created_at: string;
}

export const useSystemUpdates = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: availableUpdate, isLoading, refetch } = useQuery({
    queryKey: ["system-updates"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("update-webhook", {
        method: "GET",
      });

      if (error) throw error;
      return data as { hasUpdate: boolean; update: SystemUpdate | null };
    },
    refetchInterval: 60000, // Check every minute
  });

  const applyUpdate = useMutation({
    mutationFn: async (updateId: string) => {
      // First mark update as applied in DB
      const { error } = await supabase.functions.invoke("update-webhook", {
        method: "PATCH",
        body: { updateId },
      });

      if (error) throw error;

      // The actual update will be triggered on the server via SSH
      // This would call the update.sh script
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-updates"] });
      toast({ 
        title: "Update pokrenut", 
        description: "Server se ažurira. Ovo može potrajati nekoliko minuta." 
      });
    },
    onError: (error) => {
      toast({ 
        title: "Greška", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  return {
    hasUpdate: availableUpdate?.hasUpdate ?? false,
    update: availableUpdate?.update ?? null,
    isLoading,
    refetch,
    applyUpdate,
  };
};
