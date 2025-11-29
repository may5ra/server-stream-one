import { Cpu, HardDrive, MemoryStick, Network } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ServerMetric {
  icon: React.ElementType;
  label: string;
  value: number;
  unit: string;
  color: string;
}

const metrics: ServerMetric[] = [
  { icon: Cpu, label: "CPU Usage", value: 42, unit: "%", color: "bg-primary" },
  { icon: MemoryStick, label: "Memory", value: 67, unit: "%", color: "bg-warning" },
  { icon: HardDrive, label: "Disk", value: 35, unit: "%", color: "bg-success" },
  { icon: Network, label: "Network", value: 28, unit: "Mbps", color: "bg-accent" },
];

export function ServerStatus() {
  return (
    <div className="glass rounded-xl p-5 animate-fade-up" style={{ animationDelay: '0.15s' }}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">Server Resources</h3>
        <p className="text-sm text-muted-foreground">Real-time system metrics</p>
      </div>

      <div className="space-y-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <metric.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{metric.label}</span>
              </div>
              <span className="font-mono text-sm text-foreground">
                {metric.value}{metric.unit}
              </span>
            </div>
            <Progress 
              value={metric.value} 
              className="h-2"
            />
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <p className="text-2xl font-semibold text-foreground">99.9%</p>
          <p className="text-xs text-muted-foreground">Uptime</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <p className="text-2xl font-semibold text-foreground">12ms</p>
          <p className="text-xs text-muted-foreground">Latency</p>
        </div>
      </div>
    </div>
  );
}
