import { Server, Users, Tv, Activity, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ServerCardData {
  id: string;
  name: string;
  status: string;
  ip_address: string;
  connections: number;
  streamsLive: number;
  requestsPerSec: number;
  inputMbps: number;
  outputMbps: number;
  cpu_usage: number;
  memory_usage: number;
}

interface ServerCardsProps {
  servers: ServerCardData[];
}

export function ServerCards({ servers }: ServerCardsProps) {
  if (!servers || servers.length === 0) {
    return (
      <div className="glass rounded-xl p-6 animate-fade-up" style={{ animationDelay: '0.2s' }}>
        <div className="flex items-center gap-3 mb-4">
          <Server className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Serveri</h3>
        </div>
        <p className="text-muted-foreground text-center py-8">Nema konfiguriranih servera</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-4 sm:p-5 animate-fade-up" style={{ animationDelay: '0.2s' }}>
      <div className="flex items-center gap-3 mb-4">
        <Server className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Server Status</h3>
        <Badge variant="outline" className="ml-auto">
          {servers.filter(s => s.status === "online").length}/{servers.length} Online
        </Badge>
      </div>

      <div className="grid gap-3">
        {servers.map((server) => (
          <ServerCard key={server.id} server={server} />
        ))}
      </div>
    </div>
  );
}

function ServerCard({ server }: { server: ServerCardData }) {
  const isOnline = server.status === "online";
  
  return (
    <div className={`rounded-lg border p-3 sm:p-4 transition-all ${
      isOnline 
        ? "border-success/30 bg-success/5" 
        : "border-destructive/30 bg-destructive/5"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${isOnline ? "bg-success animate-pulse" : "bg-destructive"}`} />
          <span className="font-medium text-foreground">{server.name}</span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">{server.ip_address}</span>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
        {/* Connections */}
        <div className="rounded-md bg-background/50 p-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Users className="h-3 w-3 text-primary" />
          </div>
          <p className="text-base sm:text-lg font-bold text-foreground">{server.connections}</p>
          <p className="text-[10px] text-muted-foreground">Connections</p>
        </div>

        {/* Streams Live */}
        <div className="rounded-md bg-background/50 p-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Tv className="h-3 w-3 text-success" />
          </div>
          <p className="text-base sm:text-lg font-bold text-foreground">{server.streamsLive}</p>
          <p className="text-[10px] text-muted-foreground">Streams Live</p>
        </div>

        {/* Requests/sec */}
        <div className="rounded-md bg-background/50 p-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Activity className="h-3 w-3 text-warning" />
          </div>
          <p className="text-base sm:text-lg font-bold text-foreground">{server.requestsPerSec}</p>
          <p className="text-[10px] text-muted-foreground">Req/sec</p>
        </div>

        {/* Input Mbps */}
        <div className="rounded-md bg-background/50 p-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <ArrowDownToLine className="h-3 w-3 text-accent" />
          </div>
          <p className="text-base sm:text-lg font-bold text-foreground">{server.inputMbps}</p>
          <p className="text-[10px] text-muted-foreground">Input Mbps</p>
        </div>

        {/* Output Mbps */}
        <div className="rounded-md bg-background/50 p-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <ArrowUpFromLine className="h-3 w-3 text-accent" />
          </div>
          <p className="text-base sm:text-lg font-bold text-foreground">{server.outputMbps}</p>
          <p className="text-[10px] text-muted-foreground">Output Mbps</p>
        </div>
      </div>

      {/* CPU/Memory bar */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>CPU {server.cpu_usage}%</span>
            <span>RAM {server.memory_usage}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden flex gap-px">
            <div 
              className={`h-full transition-all ${server.cpu_usage > 80 ? "bg-destructive" : server.cpu_usage > 50 ? "bg-warning" : "bg-success"}`}
              style={{ width: `${server.cpu_usage}%` }}
            />
            <div 
              className={`h-full transition-all ${server.memory_usage > 80 ? "bg-destructive" : server.memory_usage > 50 ? "bg-warning" : "bg-primary"}`}
              style={{ width: `${server.memory_usage}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
