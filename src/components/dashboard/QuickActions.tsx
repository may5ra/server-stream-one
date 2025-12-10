import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, RefreshCw, Download, Shield, Users, Tv, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ServerSSHControl } from "@/components/ServerSSHControl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface ExportOption {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  table: string;
  checked: boolean;
}

export function QuickActions() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sshControlOpen, setSSHControlOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOption[]>([
    { id: "users", label: "Korisnici", icon: Users, table: "streaming_users", checked: true },
    { id: "streams", label: "Streamovi", icon: Tv, table: "streams", checked: true },
    { id: "servers", label: "Serveri", icon: Server, table: "servers", checked: true },
  ]);

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

  const toggleExportOption = (id: string) => {
    setExportOptions(prev =>
      prev.map(opt => (opt.id === id ? { ...opt, checked: !opt.checked } : opt))
    );
  };

  const handleExportData = async () => {
    const selectedOptions = exportOptions.filter(opt => opt.checked);
    
    if (selectedOptions.length === 0) {
      toast({
        title: "Odaberite podatke",
        description: "Morate odabrati barem jednu vrstu podataka za izvoz",
        variant: "destructive",
      });
      return;
    }

    setExporting(true);
    try {
      const exportData: Record<string, unknown> = {
        exportedAt: new Date().toISOString(),
      };

      // Fetch selected data based on selections
      const fetchPromises = selectedOptions.map(async (option) => {
        if (option.table === "streaming_users") {
          const { data, error } = await supabase.from("streaming_users").select("*");
          if (error) throw error;
          return { key: option.id, data: data || [] };
        } else if (option.table === "streams") {
          const { data, error } = await supabase.from("streams").select("*");
          if (error) throw error;
          return { key: option.id, data: data || [] };
        } else if (option.table === "servers") {
          const { data, error } = await supabase.from("servers").select("*");
          if (error) throw error;
          return { key: option.id, data: data || [] };
        }
        return { key: option.id, data: [] };
      });

      const results = await Promise.all(fetchPromises);
      results.forEach(result => {
        exportData[result.key] = result.data;
      });

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

      setExportDialogOpen(false);
      toast({
        title: "Izvoz uspješan",
        description: `Izvezeno: ${selectedOptions.map(o => o.label).join(", ")}`,
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
    { icon: Download, label: "Export Data", variant: "outline" as const, onClick: () => setExportDialogOpen(true) },
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
            >
              <action.icon className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-[10px] sm:text-xs">{action.label}</span>
            </Button>
          ))}
        </div>
      </div>

      <ServerSSHControl open={sshControlOpen} onOpenChange={setSSHControlOpen} />

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Izvoz podataka
            </DialogTitle>
            <DialogDescription>
              Odaberite koje podatke želite izvesti u JSON datoteku.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {exportOptions.map((option) => (
              <div
                key={option.id}
                className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => toggleExportOption(option.id)}
              >
                <Checkbox
                  id={option.id}
                  checked={option.checked}
                  onCheckedChange={() => toggleExportOption(option.id)}
                />
                <option.icon className="h-5 w-5 text-muted-foreground" />
                <Label htmlFor={option.id} className="flex-1 cursor-pointer font-medium">
                  {option.label}
                </Label>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              Odustani
            </Button>
            <Button onClick={handleExportData} disabled={exporting}>
              {exporting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Izvoz...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Izvezi
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
