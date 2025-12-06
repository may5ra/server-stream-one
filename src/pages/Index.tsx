import { Users, Tv, Activity, Server, RefreshCw } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { StreamsTable } from "@/components/dashboard/StreamsTable";
import { ServerStatus } from "@/components/dashboard/ServerStatus";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { useDashboardStats } from "@/hooks/useDashboardStats";

const Index = () => {
  const { stats, recentStreams, servers, loading } = useDashboardStats();

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
          {/* Page Title */}
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-foreground">Dashboard</h2>
            <p className="text-muted-foreground">Dobrodošli natrag. Evo pregleda servera.</p>
          </div>

          {/* Stats Grid */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatsCard
              title="Streaming Korisnici"
              value={`${stats.onlineUsers}/${stats.totalUsers}`}
              change={stats.onlineUsers > 0 ? `${stats.activeConnections} aktivnih konekcija` : "Nema online korisnika"}
              changeType={stats.onlineUsers > 0 ? "positive" : "neutral"}
              icon={Users}
              iconColor="text-success"
            />
            <StatsCard
              title="Ukupno Streamova"
              value={stats.totalStreams}
              change={`${stats.activeStreams} aktivnih`}
              changeType={stats.activeStreams > 0 ? "positive" : "neutral"}
              icon={Tv}
              iconColor="text-primary"
            />
            <StatsCard
              title="Aktivni Streamovi"
              value={stats.activeStreams}
              change={stats.activeStreams > 0 ? "Emitiranje uživo" : "Nema aktivnih"}
              changeType={stats.activeStreams > 0 ? "positive" : "neutral"}
              icon={Activity}
              iconColor="text-success"
            />
            <StatsCard
              title="Gledatelji"
              value={stats.activeConnections}
              change="Aktivne konekcije"
              changeType={stats.activeConnections > 0 ? "positive" : "neutral"}
              icon={Users}
              iconColor="text-warning"
            />
            <StatsCard
              title="Serveri"
              value={`${stats.onlineServers}/${stats.totalServers}`}
              change={stats.onlineServers === stats.totalServers && stats.totalServers > 0 ? "Svi online" : `${stats.totalServers - stats.onlineServers} offline`}
              changeType={stats.onlineServers === stats.totalServers && stats.totalServers > 0 ? "positive" : stats.totalServers === 0 ? "neutral" : "negative"}
              icon={Server}
              iconColor="text-primary"
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Chart - 2 columns */}
            <div className="lg:col-span-2">
              <ActivityChart 
                servers={servers}
                activeStreams={stats.activeStreams}
                totalViewers={stats.totalViewers}
              />
            </div>
            
            {/* Server Status */}
            <div>
              <ServerStatus 
                avgCpu={stats.avgCpu}
                avgMemory={stats.avgMemory}
                avgDisk={stats.avgDisk}
                avgNetwork={stats.avgNetwork}
                onlineServers={stats.onlineServers}
              />
            </div>
          </div>

          {/* Bottom Grid */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Streams Table - 2 columns */}
            <div className="lg:col-span-2">
              <StreamsTable streams={recentStreams} />
            </div>
            
            {/* Quick Actions */}
            <div>
              <QuickActions />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
