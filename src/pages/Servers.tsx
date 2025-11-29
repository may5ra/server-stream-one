import { useState } from "react";
import { Server, RefreshCw, Power, Terminal, Circle, Cpu, MemoryStick, HardDrive, Network } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

interface ServerData {
  id: string;
  name: string;
  ip: string;
  status: "online" | "offline" | "maintenance";
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  uptime: string;
  os: string;
  location: string;
}

const servers: ServerData[] = [
  { id: "1", name: "Main Server", ip: "192.168.1.100", status: "online", cpu: 42, memory: 67, disk: 35, network: 28, uptime: "45 days", os: "Ubuntu 22.04 LTS", location: "Frankfurt, DE" },
  { id: "2", name: "Backup Server", ip: "192.168.1.101", status: "online", cpu: 15, memory: 32, disk: 45, network: 12, uptime: "30 days", os: "Debian 12", location: "Amsterdam, NL" },
  { id: "3", name: "Stream Server EU", ip: "10.0.0.50", status: "online", cpu: 78, memory: 82, disk: 60, network: 85, uptime: "15 days", os: "Ubuntu 22.04 LTS", location: "London, UK" },
  { id: "4", name: "Stream Server US", ip: "10.0.1.50", status: "maintenance", cpu: 0, memory: 0, disk: 55, network: 0, uptime: "0 days", os: "Ubuntu 22.04 LTS", location: "New York, US" },
];

const statusConfig = {
  online: { color: "text-success", bg: "bg-success/20", label: "Online" },
  offline: { color: "text-destructive", bg: "bg-destructive/20", label: "Offline" },
  maintenance: { color: "text-warning", bg: "bg-warning/20", label: "Maintenance" },
};

const Servers = () => {
  const [serverList, setServerList] = useState(servers);
  const { toast } = useToast();

  const handleRestart = (id: string) => {
    toast({ title: "Restarting", description: "Server restart initiated..." });
    setServerList(serverList.map(s => 
      s.id === id ? { ...s, status: "maintenance" as const } : s
    ));
    
    setTimeout(() => {
      setServerList(prev => prev.map(s => 
        s.id === id ? { ...s, status: "online" as const } : s
      ));
      toast({ title: "Success", description: "Server restarted successfully" });
    }, 3000);
  };

  const getProgressColor = (value: number) => {
    if (value > 80) return "bg-destructive";
    if (value > 60) return "bg-warning";
    return "bg-primary";
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <div className="ml-64">
        <Header />
        
        <main className="p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-foreground">Servers</h2>
            <p className="text-muted-foreground">Monitor and manage your server infrastructure</p>
          </div>

          {/* Server Cards */}
          <div className="grid gap-6 lg:grid-cols-2">
            {serverList.map((server) => {
              const status = statusConfig[server.status];
              return (
                <div key={server.id} className="glass rounded-xl p-6">
                  {/* Header */}
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
                        <Server className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{server.name}</h3>
                        <p className="font-mono text-sm text-muted-foreground">{server.ip}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.bg} ${status.color}`}>
                      <Circle className="h-2 w-2 fill-current" />
                      {status.label}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="mb-4 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Location</p>
                      <p className="text-foreground">{server.location}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">OS</p>
                      <p className="text-foreground">{server.os}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Uptime</p>
                      <p className="text-foreground">{server.uptime}</p>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="mb-4 space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Cpu className="h-4 w-4" /> CPU
                        </span>
                        <span className="font-mono text-foreground">{server.cpu}%</span>
                      </div>
                      <Progress value={server.cpu} className="h-2" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <MemoryStick className="h-4 w-4" /> Memory
                        </span>
                        <span className="font-mono text-foreground">{server.memory}%</span>
                      </div>
                      <Progress value={server.memory} className="h-2" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <HardDrive className="h-4 w-4" /> Disk
                        </span>
                        <span className="font-mono text-foreground">{server.disk}%</span>
                      </div>
                      <Progress value={server.disk} className="h-2" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Network className="h-4 w-4" /> Network
                        </span>
                        <span className="font-mono text-foreground">{server.network} Mbps</span>
                      </div>
                      <Progress value={server.network} className="h-2" />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleRestart(server.id)}>
                      <RefreshCw className="h-4 w-4" /> Restart
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Terminal className="h-4 w-4" /> Console
                    </Button>
                    <Button variant="outline" size="sm">
                      <Power className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Servers;
