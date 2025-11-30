import { useState, useEffect } from "react";
import { Database as DatabaseIcon, Table, RefreshCw, Download, Search } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TableInfo {
  name: string;
  rowCount: number;
}

const Database = () => {
  const { toast } = useToast();
  const [tables, setTables] = useState<TableInfo[]>([
    { name: "streams", rowCount: 0 },
    { name: "servers", rowCount: 0 },
    { name: "panel_settings", rowCount: 0 },
    { name: "activity_logs", rowCount: 0 },
    { name: "user_roles", rowCount: 0 },
  ]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchTableCounts = async () => {
    setLoading(true);
    try {
      const updatedTables = await Promise.all(
        tables.map(async (table) => {
          const { count, error } = await supabase
            .from(table.name as any)
            .select('*', { count: 'exact', head: true });
          
          return {
            ...table,
            rowCount: error ? 0 : (count || 0)
          };
        })
      );
      setTables(updatedTables);
    } catch (error) {
      console.error('Error fetching table counts:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTableCounts();
  }, []);

  const filteredTables = tables.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExport = (tableName: string) => {
    toast({
      title: "Export started",
      description: `Exporting ${tableName} table...`
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <div className="lg:ml-64">
        <Header />
        
        <main className="p-4 lg:p-6">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Database</h2>
              <p className="text-muted-foreground">Pregled tablica i podataka</p>
            </div>
            <Button variant="outline" onClick={fetchTableCounts} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Osvježi
            </Button>
          </div>

          {/* Search */}
          <div className="mb-6 relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pretraži tablice..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Tables Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTables.map((table) => (
              <div key={table.name} className="glass rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                      <Table className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{table.name}</h3>
                      <p className="text-sm text-muted-foreground">{table.rowCount} redova</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleExport(table.name)}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Export
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {filteredTables.length === 0 && (
            <div className="text-center py-12">
              <DatabaseIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nema pronađenih tablica</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Database;