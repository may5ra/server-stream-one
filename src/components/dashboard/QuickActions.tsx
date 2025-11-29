import { UserPlus, RefreshCw, Download, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

const actions = [
  { icon: UserPlus, label: "Add User", variant: "glow" as const },
  { icon: RefreshCw, label: "Restart Server", variant: "outline" as const },
  { icon: Download, label: "Export Data", variant: "outline" as const },
  { icon: Shield, label: "Security Scan", variant: "outline" as const },
];

export function QuickActions() {
  return (
    <div className="glass rounded-xl p-5 animate-fade-up" style={{ animationDelay: '0.25s' }}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">Quick Actions</h3>
        <p className="text-sm text-muted-foreground">Common operations</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant={action.variant}
            className="h-auto flex-col gap-2 py-4"
          >
            <action.icon className="h-5 w-5" />
            <span className="text-xs">{action.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
