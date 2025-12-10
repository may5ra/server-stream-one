import { useState, useEffect, useRef } from "react";
import { 
  Activity, Wifi, WifiOff, RefreshCw, Server, 
  ArrowUpDown, Clock, Zap, AlertTriangle, CheckCircle2,
  TrendingUp, TrendingDown, BarChart3
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, AreaChart, Area 
} from "recharts";

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

interface MetricPoint {
  time: string;
  timestamp: number;
  latency: number;
  cpu: number;
  bandwidth: number;
  streams: number;
}

interface Props {
  loadBalancers: LoadBalancer[];
  onRefresh: () => void;
}

export const LBMonitoring = ({ loadBalancers, onRefresh }: Props) => {
  const [healthStatus, setHealthStatus] = useState<Record<string, LBHealth>>({});
  const [checking, setChecking] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [metricsHistory, setMetricsHistory] = useState<MetricPoint[]>([]);
  const maxHistoryPoints = 20;

  const checkHealth = async (lb: LoadBalancer): Promise<LBHealth> => {
    const startTime = Date.now();
    
    try {
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
        bandwidthEstimate: lb.current_streams * 5
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
    
    // Add to history
    const now = new Date();
    const healthValues = Object.values(results);
    const avgLatency = healthValues.filter(h => h.latency !== null)
      .reduce((sum, h, _, arr) => sum + (h.latency || 0) / arr.length, 0);
    const totalCpu = healthValues.reduce((sum, h) => sum + h.cpuEstimate, 0) / (healthValues.length || 1);
    const totalBandwidth = healthValues.reduce((sum, h) => sum + h.bandwidthEstimate, 0);
    const totalStreams = healthValues.reduce((sum, h) => sum + h.streamsActive, 0);
    
    const newPoint: MetricPoint = {
      time: now.toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      timestamp: now.getTime(),
      latency: Math.round(avgLatency) || 0,
      cpu: Math.round(totalCpu),
      bandwidth: totalBandwidth,
      streams: totalStreams
    };
    
    setMetricsHistory(prev => {
      const updated = [...prev, newPoint];
      return updated.slice(-maxHistoryPoints);
    });
    
    setChecking(false);
  };

  useEffect(() => {
    runHealthCheck();
    
    if (autoRefresh) {
      const interval = setInterval(runHealthCheck, 30000);
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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass rounded-lg p-3 border border-border shadow-lg">
          <p className="text-xs text-muted-foreground mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm font-mono" style={{ color: entry.color }}>
              {entry.name}: {entry.value}{entry.name === 'Latency' ? 'ms' : entry.name === 'Bandwidth' ? ' Mbps' : entry.name === 'CPU' ? '%' : ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

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

      {/* Metrics Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Latency Chart */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-foreground">Latency History</h4>
          </div>
          <div className="h-48">
            {metricsHistory.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metricsHistory}>
                  <defs>
                    <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 10 }} 
                    className="text-muted-foreground"
                    axisLine={{ className: 'stroke-border' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }} 
                    className="text-muted-foreground"
                    axisLine={{ className: 'stroke-border' }}
                    unit="ms"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="latency" 
                    name="Latency"
                    stroke="hsl(var(--primary))" 
                    fill="url(#latencyGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <p className="text-sm">Prikupljanje podataka...</p>
              </div>
            )}
          </div>
        </div>

        {/* CPU Chart */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Server className="h-4 w-4 text-warning" />
            <h4 className="font-semibold text-foreground">CPU Estimation</h4>
          </div>
          <div className="h-48">
            {metricsHistory.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metricsHistory}>
                  <defs>
                    <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--warning))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--warning))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 10 }} 
                    className="text-muted-foreground"
                    axisLine={{ className: 'stroke-border' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }} 
                    className="text-muted-foreground"
                    axisLine={{ className: 'stroke-border' }}
                    domain={[0, 100]}
                    unit="%"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="cpu" 
                    name="CPU"
                    stroke="hsl(var(--warning))" 
                    fill="url(#cpuGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <p className="text-sm">Prikupljanje podataka...</p>
              </div>
            )}
          </div>
        </div>

        {/* Bandwidth Chart */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-accent" />
            <h4 className="font-semibold text-foreground">Bandwidth History</h4>
          </div>
          <div className="h-48">
            {metricsHistory.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metricsHistory}>
                  <defs>
                    <linearGradient id="bandwidthGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 10 }} 
                    className="text-muted-foreground"
                    axisLine={{ className: 'stroke-border' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }} 
                    className="text-muted-foreground"
                    axisLine={{ className: 'stroke-border' }}
                    unit=" Mbps"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="bandwidth" 
                    name="Bandwidth"
                    stroke="hsl(var(--accent))" 
                    fill="url(#bandwidthGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <p className="text-sm">Prikupljanje podataka...</p>
              </div>
            )}
          </div>
        </div>

        {/* Streams Chart */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <ArrowUpDown className="h-4 w-4 text-success" />
            <h4 className="font-semibold text-foreground">Active Streams</h4>
          </div>
          <div className="h-48">
            {metricsHistory.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metricsHistory}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 10 }} 
                    className="text-muted-foreground"
                    axisLine={{ className: 'stroke-border' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }} 
                    className="text-muted-foreground"
                    axisLine={{ className: 'stroke-border' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="streams" 
                    name="Streams"
                    stroke="hsl(var(--success))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--success))', strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5, fill: 'hsl(var(--success))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <p className="text-sm">Prikupljanje podataka...</p>
              </div>
            )}
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

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Latency</p>
                      <p className={`font-mono font-semibold ${getLatencyColor(health?.latency ?? null)}`}>
                        {health?.latency ? `${health.latency}ms` : "--"}
                      </p>
                    </div>

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

                    <div className="w-24">
                      <p className="text-xs text-muted-foreground mb-1">Kapacitet</p>
                      <Progress value={usagePercent} className="h-2" />
                    </div>

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
