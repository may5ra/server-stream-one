import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "./useSettings";

export const useDockerSync = () => {
  const { settings } = useSettings();

  const syncToDocker = async (
    table: string,
    action: 'insert' | 'update' | 'delete',
    data: Record<string, unknown>
  ) => {
    // Only sync if serverDomain is configured (self-hosted mode)
    if (!settings.serverDomain) {
      console.log('[DockerSync] No server domain configured, skipping sync');
      return { success: false, skipped: true };
    }

    const protocol = settings.enableSSL ? 'https' : 'http';
    const dockerUrl = `${protocol}://${settings.serverDomain}`;

    try {
      console.log(`[DockerSync] Syncing ${action} on ${table} to ${dockerUrl}`);
      
      const { data: result, error } = await supabase.functions.invoke('sync-to-docker', {
        body: {
          table,
          action,
          data,
          dockerUrl,
        },
      });

      if (error) {
        console.error('[DockerSync] Edge function error:', error);
        return { success: false, error: error.message };
      }

      console.log('[DockerSync] Sync result:', result);
      return { success: result?.success || false, ...result };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[DockerSync] Error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  return { syncToDocker };
};