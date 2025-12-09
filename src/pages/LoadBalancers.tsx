import { useState } from "react";
import { Plus, Server, Trash2, Edit, RefreshCw, Network } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useLoadBalancers } from "@/hooks/useLoadBalancers";
import { useServers } from "@/hooks/useServers";

const LoadBalancers = () => {
  const { loadBalancers, isLoading, addLoadBalancer, updateLoadBalancer, deleteLoadBalancer } = useLoadBalancers();
  const { servers } = useServers();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingLB, setEditingLB] = useState<any>(null);
  
  const [newLB, setNewLB] = useState({
    name: "",
    server_id: null as string | null,
    ip_address: "",
    port: 80,
    status: "active",
    max_streams: 100,
  });

  const handleAdd = async () => {
    if (!newLB.name || !newLB.ip_address) return;
    await addLoadBalancer.mutateAsync(newLB);
    setNewLB({ name: "", server_id: null, ip_address: "", port: 80, status: "active", max_streams: 100 });
    setIsAddOpen(false);
  };

  const handleUpdate = async () => {
    if (!editingLB) return;
    await updateLoadBalancer.mutateAsync(editingLB);
    setEditingLB(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Jesi siguran da želiš obrisati ovaj Load Balancer?")) {
      await deleteLoadBalancer.mutateAsync(id);
    }
  };

  if (isLoading) {
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
              <h2 className="text-2xl font-semibold text-foreground">Load Balanceri</h2>
              <p className="text-muted-foreground">Upravljanje serverima za distribuciju streamova</p>
            </div>
            
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button variant="glow">
                  <Plus className="h-4 w-4 mr-2" />
                  Dodaj Load Balancer
                </Button>
              </DialogTrigger>
              <DialogContent className="glass">
                <DialogHeader>
                  <DialogTitle>Novi Load Balancer</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Naziv</Label>
                    <Input
                      value={newLB.name}
                      onChange={(e) => setNewLB({ ...newLB, name: e.target.value })}
                      placeholder="LB Europe 1"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>IP Adresa</Label>
                    <Input
                      value={newLB.ip_address}
                      onChange={(e) => setNewLB({ ...newLB, ip_address: e.target.value })}
                      placeholder="192.168.1.100"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Port</Label>
                      <Input
                        type="number"
                        value={newLB.port}
                        onChange={(e) => setNewLB({ ...newLB, port: parseInt(e.target.value) || 80 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Streamova</Label>
                      <Input
                        type="number"
                        value={newLB.max_streams}
                        onChange={(e) => setNewLB({ ...newLB, max_streams: parseInt(e.target.value) || 100 })}
                      />
                    </div>
                  </div>
                  
                  {servers.length > 0 && (
                    <div className="space-y-2">
                      <Label>Povezani Server</Label>
                      <Select 
                        value={newLB.server_id || "none"}
                        onValueChange={(v) => setNewLB({ ...newLB, server_id: v === "none" ? null : v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Odaberi server" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Bez servera</SelectItem>
                          {servers.map((server) => (
                            <SelectItem key={server.id} value={server.id}>
                              {server.name} ({server.ip_address})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select 
                      value={newLB.status}
                      onValueChange={(v) => setNewLB({ ...newLB, status: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Aktivan</SelectItem>
                        <SelectItem value="inactive">Neaktivan</SelectItem>
                        <SelectItem value="maintenance">Održavanje</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <Button onClick={handleAdd} className="w-full" variant="glow">
                  Dodaj Load Balancer
                </Button>
              </DialogContent>
            </Dialog>
          </div>

          {/* Stats */}
          <div className="mb-6 grid gap-4 grid-cols-2 lg:grid-cols-3">
            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                  <Network className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{loadBalancers.length}</p>
                  <p className="text-sm text-muted-foreground">Ukupno LB-ova</p>
                </div>
              </div>
            </div>
            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/20">
                  <Server className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {loadBalancers.filter(lb => lb.status === "active").length}
                  </p>
                  <p className="text-sm text-muted-foreground">Aktivnih</p>
                </div>
              </div>
            </div>
            <div className="glass rounded-xl p-4 col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20">
                  <RefreshCw className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {loadBalancers.reduce((sum, lb) => sum + lb.current_streams, 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Aktivnih streamova</p>
                </div>
              </div>
            </div>
          </div>

          {/* Load Balancers Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {loadBalancers.map((lb) => {
              const server = servers.find(s => s.id === lb.server_id);
              const usagePercent = lb.max_streams > 0 ? (lb.current_streams / lb.max_streams) * 100 : 0;
              
              return (
                <div key={lb.id} className="glass rounded-xl p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                        <Network className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{lb.name}</h3>
                        <p className="text-sm text-muted-foreground">{lb.ip_address}:{lb.port}</p>
                      </div>
                    </div>
                    <Badge 
                      variant={lb.status === "active" ? "default" : "secondary"}
                      className={lb.status === "active" ? "bg-success/20 text-success" : ""}
                    >
                      {lb.status === "active" ? "Aktivan" : lb.status === "maintenance" ? "Održavanje" : "Neaktivan"}
                    </Badge>
                  </div>
                  
                  {server && (
                    <p className="text-xs text-muted-foreground mb-2">
                      Server: {server.name}
                    </p>
                  )}
                  
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Iskorištenost</span>
                      <span className="text-foreground">{lb.current_streams}/{lb.max_streams}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${usagePercent}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => setEditingLB(lb)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Uredi
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(lb.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            
            {loadBalancers.length === 0 && (
              <div className="col-span-full glass rounded-xl p-8 text-center">
                <Network className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nema Load Balancera</h3>
                <p className="text-muted-foreground mb-4">
                  Dodaj prvi Load Balancer za distribuciju streamova
                </p>
                <Button variant="glow" onClick={() => setIsAddOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Dodaj Load Balancer
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingLB} onOpenChange={(open) => !open && setEditingLB(null)}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Uredi Load Balancer</DialogTitle>
          </DialogHeader>
          
          {editingLB && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Naziv</Label>
                <Input
                  value={editingLB.name}
                  onChange={(e) => setEditingLB({ ...editingLB, name: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>IP Adresa</Label>
                <Input
                  value={editingLB.ip_address}
                  onChange={(e) => setEditingLB({ ...editingLB, ip_address: e.target.value })}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input
                    type="number"
                    value={editingLB.port}
                    onChange={(e) => setEditingLB({ ...editingLB, port: parseInt(e.target.value) || 80 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Streamova</Label>
                  <Input
                    type="number"
                    value={editingLB.max_streams}
                    onChange={(e) => setEditingLB({ ...editingLB, max_streams: parseInt(e.target.value) || 100 })}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={editingLB.status}
                  onValueChange={(v) => setEditingLB({ ...editingLB, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktivan</SelectItem>
                    <SelectItem value="inactive">Neaktivan</SelectItem>
                    <SelectItem value="maintenance">Održavanje</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          
          <Button onClick={handleUpdate} className="w-full" variant="glow">
            Spremi promjene
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoadBalancers;
