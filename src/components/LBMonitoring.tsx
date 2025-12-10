import { useState, useEffect } from "react";
import { 
  Activity, Wifi, WifiOff, RefreshCw, Server, 
  ArrowUpDown, Clock, Zap, AlertTriangle, CheckCircle2,
  TrendingUp, TrendingDown
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

interface LoadBalancer {
  id: string;
  name: string;
  ip_address: string;
  port: number;
  nginx_port?: number;
  status: string;
  max_streams: number;
  current_streams: number;
  last_deploy?: string;
}

interface LBHealth {
  id: string;
  online: boolean;
  latency: number | null;
  lastCheck: Date;
  streamsActive: number;
  errorCount: number;
  cpuEstimate: number;
  bandwidthEstimate: number;
}

interface Props {
  loadBalancers: LoadBalancer[];
  onRefresh: () => void;
}

export const LBMonitoring = ({ loadBalancers, onRefresh }: Props) => {
  const [healthStatus, setHealthStatus] = useState<Record<string, LBHealth>>({});
  const [checking, setChecking] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const checkHealth = async (lb: LoadBalancer): Promise<LBHealth> => {
    const startTime = Date.now();
    
    try {
      // Try to ping the LB through edge function
      const { data, error } = await supabase.functions.invoke('lb-deploy', {
        body: { action: 'test', loadBalancerId: lb.id }
      });
      
      const latency = Date.now() - startTime;
      
      return {
        id: lb.id,
        online: data?.success || false,
        latency: data?.success ? latency : null,
        lastCheck: new Date(),
        streamsActive: lb.current_streams,
        errorCount: error ? 1 : 0,
        cpuEstimate: Math.min(100, (lb.current_streams / lb.max_streams) * 100 * 1.2),
        bandwidthEstimate: lb.current_streams * 5 // ~5 Mbps per stream estimate
      };
    } catch {
      return {
        id: lb.id,
        online: false,
        latency: null,
        lastCheck: new Date(),
        streamsActive: lb.current_streams,
        errorCount: 1,
        cpuEstimate: 0,
        bandwidthEstimate: 0
      };
    }
  };

  const runHealthCheck = async () => {
    setChecking(true);
    const results: Record<string, LBHealth> = {};
    
    await Promise.all(
      loadBalancers.map(async (lb) => {
        const health = await checkHealth(lb);
        results[lb.id] = health;
      })
    );
    
    setHealthStatus(results);
    setChecking(false);
  };

  useEffect(() => {
    runHealthCheck();
    
    if (autoRefresh) {
      const interval = setInterval(runHealthCheck, 30000); // Check every 30s
      return () => clearInterval(interval);
    }
  }, [loadBalancers, autoRefresh]);

  const getStatusColor = (health?: LBHealth) => {
    if (!health) return "text-muted-foreground";
    if (health.online) return "text-success";
    return "text-destructive";
  };

  const getLatencyColor = (latency: number | null) => {
    if (latency === null) return "text-muted-foreground";
    if (latency < 100) return "text-success";
    if (latency < 300) return "text-warning";
    return "text-destructive";
  };

  const totalOnline = Object.values(healthStatus).filter(h => h.online).length;
  const totalStreams = loadBalancers.reduce((sum, lb) => sum + lb.current_streams, 0);
  const totalCapacity = loadBalancers.reduce((sum, lb) => sum + lb.max_streams, 0);
  const avgLatency = Object.values(healthStatus)
    .filter(h => h.latency !== null)
    .reduce((sum, h, _, arr) => sum + (h.latency || 0) / arr.length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Real-time Monitoring</h3>
            <p className="text-sm text-muted-foreground">
              Auto-refresh: {autoRefresh ? "Uključen (30s)" : "Isključen"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? "Pauziraj" : "Nastavi"}
          </Button>
          <Button
            variant="glow"
            size="sm"
            onClick={runHealthCheck}
            disabled={checking}
          >
            {checking ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wifi className="h-4 w-4 text-success" />
            <span className="text-sm text-muted-foreground">Online</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{totalOnline}</span>
            <span className="text-sm text-muted-foreground">/ {loadBalancers.length}</span>
          </div>
          <Progress 
            value={loadBalancers.length > 0 ? (totalOnline / loadBalancers.length) * 100 : 0} 
            className="mt-2 h-1" 
          />
        </div>

        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpDown className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">Streamovi</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{totalStreams}</span>
            <span className="text-sm text-muted-foreground">/ {totalCapacity}</span>
          </div>
          <Progress 
            value={totalCapacity > 0 ? (totalStreams / totalCapacity) * 100 : 0} 
            className="mt-2 h-1" 
          />
        </div>

        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-warning" />
            <span className="text-sm text-muted-foreground">Avg Latency</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${getLatencyColor(avgLatency)}`}>
              {avgLatency > 0 ? Math.round(avgLatency) : "--"}
            </span>
            <span className="text-sm text-muted-foreground">ms</span>
          </div>
        </div>

        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-accent" />
            <span className="text-sm text-muted-foreground">Bandwidth</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">
              {Object.values(healthStatus).reduce((sum, h) => sum + h.bandwidthEstimate, 0)}
            </span>
            <span className="text-sm text-muted-foreground">Mbps</span>
          </div>
        </div>
      </div>

      {/* Individual LB Status */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h4 className="font-semibold text-foreground">Status Load Balancera</h4>
        </div>
        
        <div className="divide-y divide-border">
          {loadBalancers.map((lb) => {
            const health = healthStatus[lb.id];
            const usagePercent = lb.max_streams > 0 ? (lb.current_streams / lb.max_streams) * 100 : 0;
            
            return (
              <div key={lb.id} className="p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Status Indicator */}
                    <div className={`relative ${getStatusColor(health)}`}>
                      {health?.online ? (
                        <CheckCircle2 className="h-8 w-8" />
                      ) : (
                        <AlertTriangle className="h-8 w-8" />
                      )}
                      {checking && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        </div>
                      )}
                    </div>

                    {/* LB Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{lb.name}</span>
                        <Badge variant={health?.online ? "default" : "destructive"} className="text-xs">
                          {health?.online ? "ONLINE" : "OFFLINE"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {lb.ip_address}:{lb.nginx_port || lb.port}
                      </p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6">
                    {/* Latency */}
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Latency</p>
                      <p className={`font-mono font-semibold ${getLatencyColor(health?.latency ?? null)}`}>
                        {health?.latency ? `${health.latency}ms` : "--"}
                      </p>
                    </div>

                    {/* Streams */}
                    <div className="text-right min-w-[80px]">
                      <p className="text-xs text-muted-foreground">Streams</p>
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-semibold text-foreground">
                          {lb.current_streams}/{lb.max_streams}
                        </span>
                        {usagePercent > 80 ? (
                          <TrendingUp className="h-4 w-4 text-destructive" />
                        ) : usagePercent > 50 ? (
                          <TrendingUp className="h-4 w-4 text-warning" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-success" />
                        )}
                      </div>
                    </div>

                    {/* Usage Bar */}
                    <div className="w-24">
                      <p className="text-xs text-muted-foreground mb-1">Kapacitet</p>
                      <Progress 
                        value={usagePercent} 
                        className="h-2"
                      />
                    </div>

                    {/* Last Deploy */}
                    <div className="text-right min-w-[100px]">
                      <p className="text-xs text-muted-foreground">Last Deploy</p>
                      <p className="text-sm text-foreground">
                        {lb.last_deploy 
                          ? new Date(lb.last_deploy).toLocaleString('hr-HR', { 
                              day: '2-digit', 
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : "Nikad"
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* CPU/Bandwidth Estimates */}
                {health && (
                  <div className="mt-3 flex gap-6 pl-12">
                    <div className="flex items-center gap-2">
                      <Server className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">CPU Est:</span>
                      <span className="text-xs font-mono text-foreground">
                        {Math.round(health.cpuEstimate)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Bandwidth:</span>
                      <span className="text-xs font-mono text-foreground">
                        {health.bandwidthEstimate} Mbps
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Checked:</span>
                      <span className="text-xs font-mono text-foreground">
                        {health.lastCheck.toLocaleTimeString('hr-HR')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {loadBalancers.length === 0 && (
            <div className="p-8 text-center">
              <WifiOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nema Load Balancera za monitoring</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
