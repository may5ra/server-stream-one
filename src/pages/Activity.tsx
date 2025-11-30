import { useState, useEffect } from "react";
import { Activity as ActivityIcon, RefreshCw, Filter, Clock, User, Shield, Server } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

interface ActivityLog {
  id: string;
  action: string;
  details: any;
  ip_address: string | null;
  created_at: string;
}

const actionIcons: Record<string, React.ElementType> = {
  login: User,
  logout: User,
  settings: Shield,
  server: Server,
  default: ActivityIcon,
};

const actionColors: Record<string, string> = {
  login: "text-success",
  logout: "text-warning",
  settings: "text-primary",
  server: "text-accent",
  default: "text-muted-foreground",
};

const Activity = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (!error && data) {
      setLogs(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => 
    log.action.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getIcon = (action: string) => {
    const key = Object.keys(actionIcons).find(k => action.toLowerCase().includes(k));
    return actionIcons[key || 'default'];
  };

  const getColor = (action: string) => {
    const key = Object.keys(actionColors).find(k => action.toLowerCase().includes(k));
    return actionColors[key || 'default'];
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('hr-HR');
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <div className="lg:ml-64">
        <Header />
        
        <main className="p-4 lg:p-6">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Aktivnost</h2>
              <p className="text-muted-foreground">Pregled svih akcija na panelu</p>
            </div>
            <Button variant="outline" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Osvježi
            </Button>
          </div>

          {/* Search */}
          <div className="mb-6 relative max-w-md">
            <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filtriraj po akciji..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Activity List */}
          <div className="glass rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Učitavanje...</p>
              </div>
            ) : filteredLogs.length > 0 ? (
              <div className="divide-y divide-border">
                {filteredLogs.map((log) => {
                  const Icon = getIcon(log.action);
                  const color = getColor(log.action);
                  return (
                    <div key={log.id} className="p-4 flex items-start gap-4 hover:bg-muted/50 transition-colors">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted ${color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">{log.action}</p>
                        {log.details && (
                          <p className="text-sm text-muted-foreground truncate">
                            {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTime(log.created_at)}
                          </span>
                          {log.ip_address && (
                            <span className="font-mono">{log.ip_address}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center">
                <ActivityIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nema zabilježenih aktivnosti</p>
                <p className="text-sm text-muted-foreground mt-1">Aktivnosti će se pojaviti ovdje kad se dogode</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Activity;