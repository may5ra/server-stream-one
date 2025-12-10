import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, RefreshCw, Download, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ServerSSHControl } from "@/components/ServerSSHControl";

export function QuickActions() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sshControlOpen, setSSHControlOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleAddUser = () => {
    navigate("/users");
    toast({
      title: "Korisnici",
      description: "Otvoren je panel korisnika za dodavanje",
    });
  };

  const handleRestartServer = () => {
    setSSHControlOpen(true);
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      // Fetch all data for export
      const [usersRes, streamsRes, serversRes] = await Promise.all([
        supabase.from("streaming_users").select("*"),
        supabase.from("streams").select("*"),
        supabase.from("servers").select("*"),
      ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        users: usersRes.data || [],
        streams: streamsRes.data || [],
        servers: serversRes.data || [],
      };

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `streampanel-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Izvoz uspješan",
        description: "Podaci su izvezeni u JSON datoteku",
      });
    } catch (error) {
      toast({
        title: "Greška",
        description: "Nije moguće izvesti podatke",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleSecurityScan = () => {
    navigate("/security");
    toast({
      title: "Sigurnost",
      description: "Otvorena je stranica sigurnosnog pregleda",
    });
  };

  const actions = [
    { icon: UserPlus, label: "Add User", variant: "glow" as const, onClick: handleAddUser },
    { icon: RefreshCw, label: "Restart Server", variant: "outline" as const, onClick: handleRestartServer },
    { icon: Download, label: "Export Data", variant: "outline" as const, onClick: handleExportData, loading: exporting },
    { icon: Shield, label: "Security Scan", variant: "outline" as const, onClick: handleSecurityScan },
  ];

  return (
    <>
      <div className="glass rounded-xl p-4 sm:p-5 animate-fade-up" style={{ animationDelay: '0.25s' }}>
        <div className="mb-3 sm:mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-foreground">Quick Actions</h3>
          <p className="text-xs sm:text-sm text-muted-foreground">Common operations</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant}
              className="h-auto flex-col gap-1.5 sm:gap-2 py-3 sm:py-4"
              onClick={action.onClick}
              disabled={action.loading}
            >
              {action.loading ? (
                <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
              ) : (
                <action.icon className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
              <span className="text-[10px] sm:text-xs">{action.label}</span>
            </Button>
          ))}
        </div>
      </div>

      <ServerSSHControl open={sshControlOpen} onOpenChange={setSSHControlOpen} />
    </>
  );
}
