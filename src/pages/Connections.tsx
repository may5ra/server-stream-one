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
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Search, 
  Users, 
  Activity,
  AlertTriangle,
  Clock,
  Zap
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/useSettings";
import { formatDistanceToNow } from "date-fns";
import { hr } from "date-fns/locale";

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
}

const Connections = () => {
  const [connections, setConnections] = useState<ActiveConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [disconnectUser, setDisconnectUser] = useState<ActiveConnection | null>(null);
  const { toast } = useToast();
  const { settings } = useSettings();

  const getDockerUrl = () => {
    const domain = settings?.serverDomain || "";
    if (!domain) return null;
    return `http://${domain}`;
  };

  const fetchConnections = async () => {
    try {
      const { data, error } = await supabase
        .from("streaming_users")
        .select("*")
        .order("last_active", { ascending: false, nullsFirst: false });

      if (error) throw error;

      const now = new Date();
      const mapped: ActiveConnection[] = (data || []).map((user) => {
        const expiryDate = new Date(user.expiry_date);
        const isExpired = expiryDate < now;
        const isAtLimit = (user.connections || 0) >= (user.max_connections || 1);

        return {
          userId: user.id,
          username: user.username,
          connections: user.connections || 0,
          maxConnections: user.max_connections || 1,
          status: user.status,
          lastActive: user.last_active,
          expiryDate: user.expiry_date,
          isExpired,
          isAtLimit,
        };
      });

      setConnections(mapped);
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
  }, []);

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

  const filteredConnections = connections.filter((c) =>
    c.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onlineUsers = connections.filter((c) => c.status === "online").length;
  const totalConnections = connections.reduce((sum, c) => sum + c.connections, 0);
  const atLimitUsers = connections.filter((c) => c.isAtLimit && c.connections > 0).length;
  const expiredUsers = connections.filter((c) => c.isExpired).length;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      <div className="lg:ml-64">
        <Header />

        <main className="p-4 lg:p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-foreground">
              Live Monitoring Konekcija
            </h2>
            <p className="text-muted-foreground">
              Real-time praćenje aktivnih streaming konekcija
            </p>
          </div>

          {/* Stats Cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-success/10 p-2">
                    <Users className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Online Korisnici</p>
                    <p className="text-2xl font-bold text-foreground">{onlineUsers}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Aktivne Konekcije</p>
                    <p className="text-2xl font-bold text-foreground">{totalConnections}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-warning/10 p-2">
                    <Zap className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Na Limitu</p>
                    <p className="text-2xl font-bold text-foreground">{atLimitUsers}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-destructive/10 p-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Istekli Accounti</p>
                    <p className="text-2xl font-bold text-foreground">{expiredUsers}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Connections Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Aktivne Konekcije</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Pretraži korisnike..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Korisnik</TableHead>
                    <TableHead>Konekcije</TableHead>
                    <TableHead>Zadnja Aktivnost</TableHead>
                    <TableHead>Istek</TableHead>
                    <TableHead>Akcije</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredConnections.map((conn) => (
                    <TableRow 
                      key={conn.userId}
                      className={conn.isExpired ? "bg-destructive/5" : conn.isAtLimit && conn.connections > 0 ? "bg-warning/5" : ""}
                    >
                      <TableCell>
                        {conn.status === "online" ? (
                          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                            <Wifi className="h-3 w-3 mr-1" />
                            Online
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground">
                            <WifiOff className="h-3 w-3 mr-1" />
                            Offline
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{conn.username}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={conn.isAtLimit ? "text-warning font-bold" : ""}>
                            {conn.connections}/{conn.maxConnections}
                          </span>
                          {conn.isAtLimit && conn.connections > 0 && (
                            <Badge variant="outline" className="text-warning border-warning/20 text-xs">
                              LIMIT
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {conn.lastActive ? (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(conn.lastActive), { 
                              addSuffix: true, 
                              locale: hr 
                            })}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
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
                      <TableCell>
                        {conn.connections > 0 && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDisconnectUser(conn)}
                          >
                            <WifiOff className="h-3 w-3 mr-1" />
                            Disconnect
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredConnections.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nema pronađenih korisnika
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
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