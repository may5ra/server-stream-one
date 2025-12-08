import { Cpu, HardDrive, MemoryStick, Network } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ServerStatusProps {
  avgCpu: number;
  avgMemory: number;
  avgDisk: number;
  avgNetwork: number;
  onlineServers: number;
}

export function ServerStatus({ avgCpu, avgMemory, avgDisk, avgNetwork, onlineServers }: ServerStatusProps) {
  const metrics = [
    { icon: Cpu, label: "CPU", value: avgCpu, unit: "%", color: "bg-primary" },
    { icon: MemoryStick, label: "Memorija", value: avgMemory, unit: "%", color: "bg-warning" },
    { icon: HardDrive, label: "Disk", value: avgDisk, unit: "%", color: "bg-success" },
    { icon: Network, label: "Mreža", value: avgNetwork, unit: "Mbps", color: "bg-accent" },
  ];

  return (
    <div className="glass rounded-xl p-4 sm:p-5 animate-fade-up" style={{ animationDelay: '0.15s' }}>
      <div className="mb-3 sm:mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-foreground">Server Resursi</h3>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {onlineServers > 0 ? `Prosjek od ${onlineServers} servera` : "Nema servera"}
        </p>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="space-y-1.5 sm:space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <metric.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                <span className="text-xs sm:text-sm text-foreground">{metric.label}</span>
              </div>
              <span className="font-mono text-xs sm:text-sm text-foreground">
                {metric.value}{metric.unit}
              </span>
            </div>
            <Progress 
              value={metric.label === "Mreža" ? Math.min(metric.value, 100) : metric.value} 
              className="h-1.5 sm:h-2"
            />
          </div>
        ))}
      </div>

      <div className="mt-4 sm:mt-5 grid grid-cols-2 gap-2 sm:gap-3">
        <div className="rounded-lg bg-muted/50 p-2 sm:p-3 text-center">
          <p className="text-lg sm:text-2xl font-semibold text-foreground">{onlineServers > 0 ? "99.9%" : "-"}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">Uptime</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-2 sm:p-3 text-center">
          <p className="text-lg sm:text-2xl font-semibold text-foreground">{onlineServers > 0 ? "12ms" : "-"}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">Latencija</p>
        </div>
      </div>
    </div>
  );
}
