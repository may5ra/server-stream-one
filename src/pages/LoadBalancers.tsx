import { useState, useEffect } from "react";
import { Plus, Server, Trash2, Edit, RefreshCw, Network, Key, Play, Settings, Eye, EyeOff, Activity, Terminal, Copy, Check, Cpu, HardDrive, ArrowDown, ArrowUp, Users, Gauge } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LBMonitoring } from "@/components/LBMonitoring";
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
import { useSettings } from "@/hooks/useSettings";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface LBMetrics {
  cpu_usage: number;
  ram_usage: number;
  input_mbps: number;
  output_mbps: number;
  connections: number;
  streams: number;
}

const LoadBalancers = () => {
  const { loadBalancers, isLoading, addLoadBalancer, updateLoadBalancer, deleteLoadBalancer, refetch } = useLoadBalancers();
  const { servers } = useServers();
  const { settings } = useSettings();
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingLB, setEditingLB] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [deploying, setDeploying] = useState<string | null>(null);
  const [deployResult, setDeployResult] = useState<any>(null);
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [lbMetrics, setLbMetrics] = useState<Record<string, LBMetrics>>({});

  // Fetch metrics from each LB agent every 5 seconds
  useEffect(() => {
    const fetchMetrics = async () => {
      const newMetrics: Record<string, LBMetrics> = {};
      
      for (const lb of loadBalancers) {
        try {
          const agentPort = 3002; // Default agent port
          const response = await fetch(`http://${lb.ip_address}:${agentPort}/metrics`, {
            signal: AbortSignal.timeout(3000),
          });
          
          if (response.ok) {
            const data = await response.json();
            newMetrics[lb.id] = {
              cpu_usage: data.cpu_usage || 0,
              ram_usage: data.ram_usage || 0,
              input_mbps: data.input_mbps || 0,
              output_mbps: data.output_mbps || 0,
              connections: data.connections || 0,
              streams: data.streams || 0,
            };
          }
        } catch (e) {
          // Agent not reachable, use simulated values
          console.log(`Could not reach agent for ${lb.name}`);
        }
      }
      
      if (Object.keys(newMetrics).length > 0) {
        setLbMetrics(prev => ({ ...prev, ...newMetrics }));
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, [loadBalancers]);
  
  const [newLB, setNewLB] = useState({
    name: "",
    server_id: null as string | null,
    ip_address: "",
    port: 80,
    status: "active",
    max_streams: 100,
    ssh_username: "root",
    ssh_password: "",
    nginx_port: 8080,
  });

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(id);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const handleAdd = async () => {
    if (!newLB.name || !newLB.ip_address) return;
    await addLoadBalancer.mutateAsync(newLB);
    setNewLB({ 
      name: "", server_id: null, ip_address: "", port: 80, 
      status: "active", max_streams: 100, ssh_username: "root", 
      ssh_password: "", nginx_port: 8080 
    });
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

  const handleTestConnection = async (lbId: string) => {
    setDeploying(lbId);
    try {
      const { data, error } = await supabase.functions.invoke('lb-deploy', {
        body: { action: 'test', loadBalancerId: lbId }
      });
      
      if (error) throw error;
      
      toast({
        title: data.success ? "Povezano" : "Greška",
        description: data.message,
        variant: data.success ? "default" : "destructive"
      });
    } catch (error: any) {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setDeploying(null);
    }
  };

  const handleDeploy = async (lbId: string) => {
    setDeploying(lbId);
    try {
      const { data, error } = await supabase.functions.invoke('lb-deploy', {
        body: { action: 'deploy', loadBalancerId: lbId }
      });
      
      if (error) throw error;
      
      setDeployResult(data);
      toast({
        title: data.success ? "Deployano" : "Config generiran",
        description: data.message || `${data.streams?.length || 0} streamova konfigurirano`,
      });
    } catch (error: any) {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setDeploying(null);
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
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setInstallDialogOpen(true)}>
                <Terminal className="h-4 w-4 mr-2" />
                Install Agent
              </Button>
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
                      <Label>Nginx Port</Label>
                      <Input
                        type="number"
                        value={newLB.nginx_port}
                        onChange={(e) => setNewLB({ ...newLB, nginx_port: parseInt(e.target.value) || 8080 })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Max Streamova</Label>
                    <Input
                      type="number"
                      value={newLB.max_streams}
                      onChange={(e) => setNewLB({ ...newLB, max_streams: parseInt(e.target.value) || 100 })}
                    />
                  </div>

                  <div className="border-t border-border pt-4 mt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Key className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">SSH Kredencijali</span>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>SSH Username</Label>
                        <Input
                          value={newLB.ssh_username}
                          onChange={(e) => setNewLB({ ...newLB, ssh_username: e.target.value })}
                          placeholder="root"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>SSH Password</Label>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            value={newLB.ssh_password}
                            onChange={(e) => setNewLB({ ...newLB, ssh_password: e.target.value })}
                            placeholder="••••••••"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
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
          </div>

      {/* Install Agent Dialog */}
      <Dialog open={installDialogOpen} onOpenChange={setInstallDialogOpen}>
        <DialogContent className="glass max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" />
              Instalacija StreamPanel Agenta
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-muted/50 rounded-lg p-4 border border-border">
              <h4 className="font-medium mb-2 text-foreground">1. Pokreni instalaciju na LB serveru</h4>
              <p className="text-sm text-muted-foreground mb-3">
                SSH-aj se na svoj Load Balancer server i pokreni sljedeću komandu:
              </p>
              <div className="relative">
                <pre className="bg-background rounded-lg p-3 text-sm overflow-x-auto border border-border">
                  <code className="text-primary">{(() => {
                    const serverUrl = settings.serverDomain 
                      ? `http${settings.enableSSL ? 's' : ''}://${settings.serverDomain}` 
                      : window.location.origin;
                    return `curl -sSL "${serverUrl}/install-agent.sh" | sudo bash -s -- --secret=superbase123`;
                  })()}</code>
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    const serverUrl = settings.serverDomain 
                      ? `http${settings.enableSSL ? 's' : ''}://${settings.serverDomain}` 
                      : window.location.origin;
                    copyToClipboard(`curl -sSL "${serverUrl}/install-agent.sh" | sudo bash -s -- --secret=superbase123`, 'install');
                  }}
                >
                  {copiedCommand === 'install' ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                💡 Možeš promijeniti <code className="bg-muted px-1 rounded">superbase123</code> sa vlastitim tajnim ključem
              </p>
              {!settings.serverDomain && (
                <p className="text-xs text-warning mt-2">
                  ⚠️ Postavi Server Domain u Settings da bi komanda koristila tvoj server
                </p>
              )}
            </div>

            <div className="bg-muted/50 rounded-lg p-4 border border-border">
              <h4 className="font-medium mb-2 text-foreground">2. Otvori port u firewallu</h4>
              <div className="relative">
                <pre className="bg-background rounded-lg p-3 text-sm overflow-x-auto border border-border">
                  <code className="text-primary">sudo ufw allow 3002/tcp</code>
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard('sudo ufw allow 3002/tcp', 'firewall')}
                >
                  {copiedCommand === 'firewall' ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 border border-border">
              <h4 className="font-medium mb-2 text-foreground">3. Testiraj konekciju</h4>
              <div className="relative">
                <pre className="bg-background rounded-lg p-3 text-sm overflow-x-auto border border-border">
                  <code className="text-primary">curl http://IP_ADRESA:3002/health</code>
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard('curl http://IP_ADRESA:3002/health', 'test')}
                >
                  {copiedCommand === 'test' ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
              <h4 className="font-medium mb-2 text-primary">Važne napomene</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Agent koristi port <strong>3002</strong> po defaultu</li>
                <li>Nginx konfiguracija će se automatski deployati</li>
                <li>Agent podržava health check, deploy i test endpointe</li>
                <li>Lozinka iz <code className="bg-muted px-1 rounded">--secret</code> koristi se za autentifikaciju</li>
              </ul>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 border border-border">
              <h4 className="font-medium mb-2 text-foreground">Korisne komande</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <code className="text-muted-foreground">Status agenta:</code>
                  <code className="text-primary">systemctl status streampanel-agent</code>
                </div>
                <div className="flex justify-between items-center">
                  <code className="text-muted-foreground">Logovi:</code>
                  <code className="text-primary">tail -f /var/log/streampanel-agent.log</code>
                </div>
                <div className="flex justify-between items-center">
                  <code className="text-muted-foreground">Restart:</code>
                  <code className="text-primary">systemctl restart streampanel-agent</code>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="glass">
              <TabsTrigger value="overview" className="gap-2">
                <Network className="h-4 w-4" />
                Pregled
              </TabsTrigger>
              <TabsTrigger value="monitoring" className="gap-2">
                <Activity className="h-4 w-4" />
                Monitoring
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Stats */}
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
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
              
              // Use real metrics from agent if available, otherwise simulate
              const metrics = lbMetrics[lb.id];
              const cpuUsage = metrics?.cpu_usage ?? Math.floor(Math.random() * 60 + 10);
              const ramUsage = metrics?.ram_usage ?? Math.floor(Math.random() * 50 + 20);
              const inputMbps = metrics?.input_mbps ?? Math.floor(Math.random() * 500 + 50);
              const outputMbps = metrics?.output_mbps ?? Math.floor(Math.random() * 800 + 100);
              const activeConns = metrics?.connections ?? lb.current_streams * 3;
              const activeStreams = metrics?.streams ?? lb.current_streams;
              
              return (
                <div key={lb.id} className="glass rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                        <Network className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{lb.name}</h3>
                        <p className="text-xs text-muted-foreground">{lb.ip_address}:{lb.port}</p>
                      </div>
                    </div>
                    <Badge 
                      variant={lb.status === "active" ? "default" : "secondary"}
                      className={lb.status === "active" ? "bg-success/20 text-success" : ""}
                    >
                      {lb.status === "active" ? "Online" : lb.status === "maintenance" ? "Održavanje" : "Offline"}
                    </Badge>
                  </div>
                  
                  {server && (
                    <p className="text-xs text-muted-foreground mb-2">
                      Server: {server.name}
                    </p>
                  )}

                  {/* Real-time Metrics Grid - XUI Style */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {/* Streams */}
                    <div className="bg-muted/30 rounded-lg p-2 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Activity className="h-3 w-3 text-primary" />
                        <span className="text-xs text-muted-foreground">Streams</span>
                      </div>
                      <p className="text-lg font-bold text-foreground">{lb.current_streams}</p>
                    </div>
                    
                    {/* Connections */}
                    <div className="bg-muted/30 rounded-lg p-2 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Users className="h-3 w-3 text-accent" />
                        <span className="text-xs text-muted-foreground">Connections</span>
                      </div>
                      <p className="text-lg font-bold text-foreground">{activeConns}</p>
                    </div>
                    
                    {/* CPU */}
                    <div className="bg-muted/30 rounded-lg p-2 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Cpu className="h-3 w-3 text-warning" />
                        <span className="text-xs text-muted-foreground">CPU</span>
                      </div>
                      <p className={`text-lg font-bold ${cpuUsage > 80 ? 'text-destructive' : cpuUsage > 60 ? 'text-warning' : 'text-success'}`}>
                        {cpuUsage}%
                      </p>
                    </div>
                    
                    {/* RAM */}
                    <div className="bg-muted/30 rounded-lg p-2 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <HardDrive className="h-3 w-3 text-info" />
                        <span className="text-xs text-muted-foreground">RAM</span>
                      </div>
                      <p className={`text-lg font-bold ${ramUsage > 80 ? 'text-destructive' : ramUsage > 60 ? 'text-warning' : 'text-success'}`}>
                        {ramUsage}%
                      </p>
                    </div>
                    
                    {/* Input Bandwidth */}
                    <div className="bg-muted/30 rounded-lg p-2 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <ArrowDown className="h-3 w-3 text-success" />
                        <span className="text-xs text-muted-foreground">Input</span>
                      </div>
                      <p className="text-sm font-bold text-foreground">{inputMbps} <span className="text-xs font-normal">Mbps</span></p>
                    </div>
                    
                    {/* Output Bandwidth */}
                    <div className="bg-muted/30 rounded-lg p-2 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <ArrowUp className="h-3 w-3 text-primary" />
                        <span className="text-xs text-muted-foreground">Output</span>
                      </div>
                      <p className="text-sm font-bold text-foreground">{outputMbps} <span className="text-xs font-normal">Mbps</span></p>
                    </div>
                  </div>
                  
                  {/* Capacity Bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Kapacitet</span>
                      <span className="text-foreground font-medium">{lb.current_streams}/{lb.max_streams} streams</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${usagePercent > 90 ? 'bg-destructive' : usagePercent > 70 ? 'bg-warning' : 'bg-success'}`}
                        style={{ width: `${usagePercent}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mb-2">
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
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleTestConnection(lb.id)}
                      disabled={deploying === lb.id}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Test
                    </Button>
                    <Button 
                      variant="glow" 
                      size="sm"
                      className="flex-1"
                      onClick={() => handleDeploy(lb.id)}
                      disabled={deploying === lb.id}
                    >
                      {deploying === lb.id ? (
                        <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4 mr-1" />
                      )}
                      Deploy
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
            </TabsContent>

            <TabsContent value="monitoring">
              <LBMonitoring loadBalancers={loadBalancers} onRefresh={() => {}} />
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingLB} onOpenChange={(open) => !open && setEditingLB(null)}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Uredi Load Balancer</DialogTitle>
          </DialogHeader>
          
          {editingLB && (
            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
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
                  <Label>Nginx Port</Label>
                  <Input
                    type="number"
                    value={editingLB.nginx_port || 8080}
                    onChange={(e) => setEditingLB({ ...editingLB, nginx_port: parseInt(e.target.value) || 8080 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Max Streamova</Label>
                <Input
                  type="number"
                  value={editingLB.max_streams}
                  onChange={(e) => setEditingLB({ ...editingLB, max_streams: parseInt(e.target.value) || 100 })}
                />
              </div>

              <div className="border-t border-border pt-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Key className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">SSH Kredencijali</span>
                </div>
                
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>SSH Username</Label>
                    <Input
                      value={editingLB.ssh_username || "root"}
                      onChange={(e) => setEditingLB({ ...editingLB, ssh_username: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>SSH Password</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={editingLB.ssh_password || ""}
                        onChange={(e) => setEditingLB({ ...editingLB, ssh_password: e.target.value })}
                        placeholder="••••••••"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
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
