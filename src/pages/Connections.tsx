import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Search, 
  Users, 
  Activity,
  AlertTriangle,
  Clock,
  Zap,
  Monitor,
  Globe,
  Download,
  ExternalLink,
  Square
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/useSettings";
import { formatDistanceToNow } from "date-fns";
import { hr } from "date-fns/locale";

interface GeoData {
  country: string;
  countryCode: string;
  city: string;
  isp: string;
}

interface ActiveConnection {
  userId: string;
  username: string;
  connections: number;
  maxConnections: number;
  status: string;
  lastActive: string | null;
  expiryDate: string;
  isExpired: boolean;
  isAtLimit: boolean;
  currentStream?: string;
  ip?: string;
  duration?: number;
  player?: string;
  geo?: GeoData;
}

interface BackendConnection {
  userId: string;
  sessionCount: number;
  sessions: Array<{
    sessionId: string;
    streamName: string;
    lastSeen: string;
    startTime?: number;
    ip?: string;
    username?: string;
  }>;
}

// Format duration in human readable format
function formatDuration(ms: number): string {
  if (!ms || ms < 0) return "0s";
  
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (days > 0) return `${days}d ${hours.toString().padStart(2, '0')}h`;
  if (hours > 0) return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
  return `${secs}s`;
}

// Get duration badge color
function getDurationColor(ms: number): string {
  const hours = ms / (1000 * 60 * 60);
  if (hours >= 24) return "bg-destructive text-destructive-foreground";
  if (hours >= 12) return "bg-warning text-warning-foreground";
  if (hours >= 1) return "bg-primary text-primary-foreground";
  return "bg-success text-success-foreground";
}

const Connections = () => {
  const [connections, setConnections] = useState<ActiveConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [disconnectUser, setDisconnectUser] = useState<ActiveConnection | null>(null);
  const [geoCache, setGeoCache] = useState<Record<string, GeoData>>({});
  const { toast } = useToast();
  const { settings } = useSettings();

  // Fetch geolocation for an IP
  const fetchGeoData = async (ip: string): Promise<GeoData | null> => {
    if (!ip || ip === '-' || geoCache[ip]) return geoCache[ip] || null;
    
    try {
      const { data, error } = await supabase.functions.invoke('ip-geolocation', {
        body: { ip }
      });
      
      if (error) throw error;
      
      const geoData: GeoData = {
        country: data.country || 'Unknown',
        countryCode: data.countryCode || 'XX',
        city: data.city || 'Unknown',
        isp: data.isp || 'Unknown'
      };
      
      setGeoCache(prev => ({ ...prev, [ip]: geoData }));
      return geoData;
    } catch (e) {
      console.error('Geo lookup failed for', ip, e);
      return null;
    }
  };

  const getDockerUrl = () => {
    const domain = settings?.serverDomain || "";
    if (!domain) return null;
    return `http://${domain}`;
  };

  const fetchConnections = async () => {
    try {
      // Fetch from Supabase
      const { data, error } = await supabase
        .from("streaming_users")
        .select("*")
        .order("last_active", { ascending: false, nullsFirst: false });

      if (error) throw error;

      // Try to get live connections from backend
      let backendConnections: BackendConnection[] = [];
      const dockerUrl = getDockerUrl();
      if (dockerUrl) {
        try {
          const response = await fetch(`${dockerUrl}/api/connections/active`, {
            signal: AbortSignal.timeout(5000),
          });
          if (response.ok) {
            const result = await response.json();
            backendConnections = result.connections || [];
          }
        } catch (e) {
          console.log("Could not fetch live connections from backend");
        }
      }

      const now = new Date();
      const mapped: ActiveConnection[] = (data || []).map((user) => {
        const expiryDate = new Date(user.expiry_date);
        const isExpired = expiryDate < now;
        
        // Find live session info from backend
        const liveSession = backendConnections.find(c => c.userId === user.id);
        const activeSession = liveSession?.sessions?.[0];
        const currentConnections = liveSession?.sessionCount || user.connections || 0;
        const isAtLimit = currentConnections >= (user.max_connections || 1);

        const ip = activeSession?.ip;
        
        return {
          userId: user.id,
          username: user.username,
          connections: currentConnections,
          maxConnections: user.max_connections || 1,
          status: currentConnections > 0 ? "online" : user.status,
          lastActive: activeSession?.lastSeen || user.last_active,
          expiryDate: user.expiry_date,
          isExpired,
          isAtLimit: isAtLimit && currentConnections > 0,
          currentStream: activeSession?.streamName,
          ip,
          duration: activeSession?.startTime ? Date.now() - activeSession.startTime : 0,
          geo: ip ? geoCache[ip] : undefined,
        };
      });

      setConnections(mapped);
      
      // Fetch geo data for IPs we don't have cached yet
      const ipsToLookup = mapped
        .filter(c => c.ip && !geoCache[c.ip])
        .map(c => c.ip!)
        .filter((ip, idx, arr) => arr.indexOf(ip) === idx); // unique
      
      // Batch geo lookups (limit to 5 at a time to avoid rate limiting)
      for (const ip of ipsToLookup.slice(0, 5)) {
        fetchGeoData(ip);
      }
    } catch (error: any) {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchConnections, 5000);
    return () => clearInterval(interval);
  }, [settings?.serverDomain]);

  // Update connections with geo data when cache changes
  useEffect(() => {
    if (Object.keys(geoCache).length > 0) {
      setConnections(prev => prev.map(conn => ({
        ...conn,
        geo: conn.ip ? geoCache[conn.ip] : undefined
      })));
    }
  }, [geoCache]);

  const handleForceDisconnect = async () => {
    if (!disconnectUser) return;

    const dockerUrl = getDockerUrl();
    if (!dockerUrl) {
      toast({
        title: "Greška",
        description: "Server domain nije konfiguriran",
        variant: "destructive",
      });
      setDisconnectUser(null);
      return;
    }

    try {
      // Call backend to force disconnect
      const response = await fetch(`${dockerUrl}/api/connections/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: disconnectUser.userId }),
      });

      if (!response.ok) {
        throw new Error("Failed to disconnect user");
      }

      // Update local state
      await supabase
        .from("streaming_users")
        .update({ connections: 0, status: "offline" })
        .eq("id", disconnectUser.userId);

      toast({
        title: "Korisnik disconnectan",
        description: `${disconnectUser.username} je prisilno odjavljen`,
      });

      fetchConnections();
    } catch (error: any) {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDisconnectUser(null);
    }
  };

  // Filter connections
  const filteredConnections = connections.filter((c) => {
    const matchesSearch = c.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.currentStream?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.ip?.includes(searchQuery);
    
    if (statusFilter === "online") return matchesSearch && c.status === "online";
    if (statusFilter === "offline") return matchesSearch && c.status !== "online";
    if (statusFilter === "expired") return matchesSearch && c.isExpired;
    if (statusFilter === "limit") return matchesSearch && c.isAtLimit;
    
    return matchesSearch;
  });

  const onlineUsers = connections.filter((c) => c.status === "online").length;
  const totalConnections = connections.reduce((sum, c) => sum + c.connections, 0);
  const atLimitUsers = connections.filter((c) => c.isAtLimit).length;
  const expiredUsers = connections.filter((c) => c.isExpired).length;

  // Export to CSV
  const exportToCSV = () => {
    const headers = ["Username", "Stream", "Status", "Connections", "IP", "Duration", "Expiry"];
    const rows = filteredConnections.map(c => [
      c.username,
      c.currentStream || "-",
      c.status,
      `${c.connections}/${c.maxConnections}`,
      c.ip || "-",
      formatDuration(c.duration || 0),
      c.expiryDate
    ]);
    
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `connections_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      <div className="lg:ml-64">
        <Header />

        <main className="p-4 lg:p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">
                Live Connections
              </h2>
              <p className="text-muted-foreground">
                Real-time praćenje aktivnih streaming konekcija
              </p>
            </div>
            <Button onClick={exportToCSV} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-success/20 bg-success/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-success/10 p-2">
                    <Users className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Online Korisnici</p>
                    <p className="text-2xl font-bold text-success">{onlineUsers}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Aktivne Konekcije</p>
                    <p className="text-2xl font-bold text-primary">{totalConnections}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-warning/20 bg-warning/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-warning/10 p-2">
                    <Zap className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Na Limitu</p>
                    <p className="text-2xl font-bold text-warning">{atLimitUsers}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive/20 bg-destructive/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-destructive/10 p-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Istekli Accounti</p>
                    <p className="text-2xl font-bold text-destructive">{expiredUsers}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Connections Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
              <CardTitle>Live Connections</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Pretraži..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-48"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Svi</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="expired">Istekli</SelectItem>
                    <SelectItem value="limit">Na limitu</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchConnections}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12">Status</TableHead>
                      <TableHead>Korisnik</TableHead>
                      <TableHead>Stream</TableHead>
                      <TableHead>IP / Lokacija</TableHead>
                      <TableHead>ISP</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="text-center">Konekcije</TableHead>
                      <TableHead>Istek</TableHead>
                      <TableHead className="text-right">Akcije</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredConnections.map((conn) => (
                      <TableRow 
                        key={conn.userId}
                        className={conn.isExpired ? "bg-destructive/5" : conn.isAtLimit ? "bg-warning/5" : ""}
                      >
                        <TableCell>
                          {conn.status === "online" ? (
                            <div className="flex items-center gap-1">
                              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-primary">{conn.username}</span>
                        </TableCell>
                        <TableCell>
                          {conn.currentStream ? (
                            <div className="flex items-center gap-2">
                              <Monitor className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">
                                {decodeURIComponent(conn.currentStream)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {conn.ip ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1 text-sm">
                                {conn.geo?.countryCode && conn.geo.countryCode !== 'XX' ? (
                                  <img 
                                    src={`https://flagcdn.com/16x12/${conn.geo.countryCode.toLowerCase()}.png`}
                                    alt={conn.geo.country}
                                    className="h-3 w-4"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                ) : (
                                  <Globe className="h-3 w-3 text-muted-foreground" />
                                )}
                                <span className="font-mono text-xs">{conn.ip}</span>
                              </div>
                              {conn.geo?.city && conn.geo.city !== 'Unknown' && (
                                <span className="text-xs text-muted-foreground">
                                  {conn.geo.city}, {conn.geo.country}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {conn.geo?.isp && conn.geo.isp !== 'Unknown' ? (
                            <span className="text-xs text-muted-foreground truncate max-w-32 block" title={conn.geo.isp}>
                              {conn.geo.isp.length > 20 ? conn.geo.isp.substring(0, 20) + '...' : conn.geo.isp}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {conn.duration && conn.duration > 0 ? (
                            <Badge className={getDurationColor(conn.duration)}>
                              {formatDuration(conn.duration)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant={conn.isAtLimit ? "destructive" : "outline"}
                            className="font-mono"
                          >
                            {conn.connections}/{conn.maxConnections}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {conn.isExpired ? (
                            <Badge variant="destructive">Istekao</Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {new Date(conn.expiryDate).toLocaleDateString("hr-HR")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {conn.connections > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDisconnectUser(conn)}
                              className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Square className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredConnections.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Nema pronađenih korisnika
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Force Disconnect Dialog */}
      <AlertDialog open={!!disconnectUser} onOpenChange={() => setDisconnectUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Prisilni Disconnect?</AlertDialogTitle>
            <AlertDialogDescription>
              Jeste li sigurni da želite prisilno odjaviti korisnika{" "}
              <strong>{disconnectUser?.username}</strong>? 
              Ovo će prekinuti sve njegove aktivne streaming sesije.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleForceDisconnect}
              className="bg-destructive hover:bg-destructive/90"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Connections;