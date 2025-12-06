import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Bell, AlertTriangle, UserX } from "lucide-react";

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const processedEvents = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Subscribe to streaming_users changes
    const channel = supabase
      .channel("streaming-notifications")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "streaming_users",
        },
        (payload) => {
          const newData = payload.new as any;
          const oldData = payload.old as any;
          
          if (!newData || !oldData) return;

          const eventId = `${newData.id}-${Date.now()}`;
          
          // Prevent duplicate notifications
          if (processedEvents.current.has(eventId)) return;
          processedEvents.current.add(eventId);
          
          // Clean up old events
          if (processedEvents.current.size > 100) {
            const entries = Array.from(processedEvents.current);
            entries.slice(0, 50).forEach((e) => processedEvents.current.delete(e));
          }

          // Check if user hit connection limit
          const oldConnections = oldData.connections || 0;
          const newConnections = newData.connections || 0;
          const maxConnections = newData.max_connections || 1;

          if (newConnections >= maxConnections && oldConnections < maxConnections) {
            toast({
              title: "Limit Konekcija Dosegnut",
              description: (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <span>
                    Korisnik <strong>{newData.username}</strong> je dosegnuo maksimum od{" "}
                    {maxConnections} konekcija
                  </span>
                </div>
              ),
              variant: "default",
            });
          }

          // Check if account just expired
          const now = new Date();
          const expiryDate = new Date(newData.expiry_date);
          const oldExpiryDate = new Date(oldData.expiry_date);
          
          // If expiry date hasn't changed but we're now past it
          if (expiryDate <= now && oldExpiryDate > now) {
            toast({
              title: "Pretplata Istekla",
              description: (
                <div className="flex items-center gap-2">
                  <UserX className="h-4 w-4 text-destructive" />
                  <span>
                    Pretplata za korisnika <strong>{newData.username}</strong> je upravo istekla
                  </span>
                </div>
              ),
              variant: "destructive",
            });
          }
        }
      )
      .subscribe();

    // Check for expiring accounts on mount
    const checkExpiringAccounts = async () => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      const { data } = await supabase
        .from("streaming_users")
        .select("username, expiry_date")
        .gte("expiry_date", now.toISOString())
        .lte("expiry_date", tomorrow.toISOString());

      if (data && data.length > 0) {
        toast({
          title: "Upozorenje: Pretplate Ističu",
          description: (
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-warning" />
              <span>
                {data.length} korisnik(a) ima pretplatu koja ističe u sljedećih 24 sata
              </span>
            </div>
          ),
          duration: 10000,
        });
      }
    };

    checkExpiringAccounts();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  return <>{children}</>;
}