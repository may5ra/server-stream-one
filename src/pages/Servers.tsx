import { useState } from "react";
import { Server, RefreshCw, Power, Terminal, Circle, Cpu, MemoryStick, HardDrive, Network, Plus, Trash2 } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useServers } from "@/hooks/useServers";

const statusConfig = {
  online: { color: "text-success", bg: "bg-success/20", label: "Online" },
  offline: { color: "text-destructive", bg: "bg-destructive/20", label: "Offline" },
  maintenance: { color: "text-warning", bg: "bg-warning/20", label: "Maintenance" },
};

const Servers = () => {
  const { servers, loading, addServer, deleteServer, restartServer, togglePower } = useServers();
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [newServer, setNewServer] = useState({
    name: "",
    ip_address: "",
    os: "Ubuntu 22.04 LTS",
    location: "",
  });

  const handleAddServer = async () => {
    if (!newServer.name || !newServer.ip_address || !newServer.location) return;

    await addServer(newServer);
    setNewServer({ name: "", ip_address: "", os: "Ubuntu 22.04 LTS", location: "" });
    setIsAddOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <div className="lg:ml-64">
        <Header />
        
        <main className="p-4 lg:p-6">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Serveri</h2>
              <p className="text-muted-foreground">Upravljanje serverskom infrastrukturom</p>
            </div>

            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button variant="glow">
                  <Plus className="h-4 w-4" />
                  Dodaj Server
                </Button>
              </DialogTrigger>
              <DialogContent className="glass">
                <DialogHeader>
                  <DialogTitle>Dodaj novi server</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Naziv servera</Label>
                    <Input
                      value={newServer.name}
                      onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                      placeholder="npr. Stream Server US"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>IP Adresa</Label>
                    <Input
                      value={newServer.ip_address}
                      onChange={(e) => setNewServer({ ...newServer, ip_address: e.target.value })}
                      placeholder="npr. 192.168.1.102"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Operativni sustav</Label>
                    <Input
                      value={newServer.os}
                      onChange={(e) => setNewServer({ ...newServer, os: e.target.value })}
                      placeholder="npr. Ubuntu 22.04 LTS"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Lokacija</Label>
                    <Input
                      value={newServer.location}
                      onChange={(e) => setNewServer({ ...newServer, location: e.target.value })}
                      placeholder="npr. New York, US"
                    />
                  </div>
                  <Button onClick={handleAddServer} className="w-full" variant="glow">
                    Dodaj Server
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Server Cards */}
          <div className="grid gap-6 lg:grid-cols-2">
            {servers.map((server) => {
              const status = statusConfig[server.status as keyof typeof statusConfig] || statusConfig.offline;
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
                        <p className="font-mono text-sm text-muted-foreground">{server.ip_address}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.bg} ${status.color}`}>
                        <Circle className="h-2 w-2 fill-current" />
                        {status.label}
                      </span>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteServer(server.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="mb-4 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Lokacija</p>
                      <p className="text-foreground">{server.location || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">OS</p>
                      <p className="text-foreground">{server.os || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Uptime</p>
                      <p className="text-foreground">{server.uptime || '-'}</p>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="mb-4 space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Cpu className="h-4 w-4" /> CPU
                        </span>
                        <span className="font-mono text-foreground">{server.cpu_usage}%</span>
                      </div>
                      <Progress value={server.cpu_usage} className="h-2" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <MemoryStick className="h-4 w-4" /> Memorija
                        </span>
                        <span className="font-mono text-foreground">{server.memory_usage}%</span>
                      </div>
                      <Progress value={server.memory_usage} className="h-2" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <HardDrive className="h-4 w-4" /> Disk
                        </span>
                        <span className="font-mono text-foreground">{server.disk_usage}%</span>
                      </div>
                      <Progress value={server.disk_usage} className="h-2" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Network className="h-4 w-4" /> Mreža
                        </span>
                        <span className="font-mono text-foreground">{server.network_usage} Mbps</span>
                      </div>
                      <Progress value={server.network_usage} className="h-2" />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => restartServer(server.id)} disabled={server.status !== "online"}>
                      <RefreshCw className="h-4 w-4" /> Restart
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Terminal className="h-4 w-4" /> Konzola
                    </Button>
                    <Button 
                      variant={server.status === "online" ? "destructive" : "success"} 
                      size="sm"
                      onClick={() => togglePower(server.id)}
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {servers.length === 0 && (
            <div className="glass rounded-xl p-12 text-center">
              <Server className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">Nema servera</h3>
              <p className="text-muted-foreground">Dodaj prvi server da započneš</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Servers;
