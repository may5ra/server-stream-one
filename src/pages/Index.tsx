import { Users, Tv, Activity, Server, RefreshCw, Database } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { StreamsTable } from "@/components/dashboard/StreamsTable";
import { ServerStatus } from "@/components/dashboard/ServerStatus";
import { ServerCards } from "@/components/dashboard/ServerCards";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { UserLocationMap } from "@/components/dashboard/UserLocationMap";
import { ContentStats } from "@/components/dashboard/ContentStats";
import { ResellerStats } from "@/components/dashboard/ResellerStats";
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
        
        <main className="p-3 sm:p-4 lg:p-6">
          {/* Page Title */}
          <div className="mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground">Dashboard</h2>
            <p className="text-sm text-muted-foreground">Dobrodošli natrag. Evo pregleda servera.</p>
          </div>

          {/* Stats Grid - Horizontal scroll on mobile */}
          <div className="mb-4 sm:mb-6 -mx-3 sm:mx-0 px-3 sm:px-0 overflow-x-auto pb-2">
            <div className="flex sm:grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-5 min-w-max sm:min-w-0">
              <div className="w-36 sm:w-auto flex-shrink-0 sm:flex-shrink">
                <StatsCard
                  title="Korisnici"
                  value={`${stats.onlineUsers}/${stats.totalUsers}`}
                  change={stats.onlineUsers > 0 ? `${stats.activeConnections} aktivnih` : "Nema online"}
                  changeType={stats.onlineUsers > 0 ? "positive" : "neutral"}
                  icon={Users}
                  iconColor="text-success"
                />
              </div>
              <div className="w-36 sm:w-auto flex-shrink-0 sm:flex-shrink">
                <StatsCard
                  title="Streamovi"
                  value={stats.totalStreams}
                  change={`${stats.activeStreams} aktivnih`}
                  changeType={stats.activeStreams > 0 ? "positive" : "neutral"}
                  icon={Tv}
                  iconColor="text-primary"
                />
              </div>
              <div className="w-36 sm:w-auto flex-shrink-0 sm:flex-shrink">
                <StatsCard
                  title="Aktivni"
                  value={stats.activeStreams}
                  change={stats.activeStreams > 0 ? "Uživo" : "Nema"}
                  changeType={stats.activeStreams > 0 ? "positive" : "neutral"}
                  icon={Activity}
                  iconColor="text-success"
                />
              </div>
              <div className="w-36 sm:w-auto flex-shrink-0 sm:flex-shrink">
                <StatsCard
                  title="Gledatelji"
                  value={stats.activeConnections}
                  change="Konekcije"
                  changeType={stats.activeConnections > 0 ? "positive" : "neutral"}
                  icon={Users}
                  iconColor="text-warning"
                />
              </div>
              <div className="w-36 sm:w-auto flex-shrink-0 sm:flex-shrink">
                <StatsCard
                  title="Serveri"
                  value={`${stats.onlineServers}/${stats.totalServers}`}
                  change={stats.onlineServers === stats.totalServers && stats.totalServers > 0 ? "Online" : `${stats.totalServers - stats.onlineServers} offline`}
                  changeType={stats.onlineServers === stats.totalServers && stats.totalServers > 0 ? "positive" : stats.totalServers === 0 ? "neutral" : "negative"}
                  icon={Server}
                  iconColor="text-primary"
                />
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
            {/* Chart - 2 columns */}
            <div className="lg:col-span-2 order-2 lg:order-1">
              <ActivityChart 
                servers={servers}
                activeStreams={stats.activeStreams}
                totalViewers={stats.totalViewers}
              />
            </div>
            
            {/* Server Status */}
            <div className="order-1 lg:order-2">
              <ServerStatus 
                avgCpu={stats.avgCpu}
                avgMemory={stats.avgMemory}
                avgDisk={stats.avgDisk}
                avgNetwork={stats.avgNetwork}
                onlineServers={stats.onlineServers}
                uptime={stats.uptime}
                activeConnections={stats.activeConnections}
              />
            </div>
          </div>

          {/* Server Cards - Full Width */}
          <div className="mt-4 sm:mt-6">
            <ServerCards servers={servers} />
          </div>

          {/* Content & Reseller Stats Row */}
          <div className="mt-4 sm:mt-6 grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
            <ContentStats />
            <ResellerStats />
          </div>

          {/* Bottom Grid */}
          <div className="mt-4 sm:mt-6 grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
            {/* Streams Table - 2 columns */}
            <div className="lg:col-span-2">
              <StreamsTable streams={recentStreams} />
            </div>
            
            {/* User Map + Quick Actions */}
            <div className="space-y-4">
              <UserLocationMap />
              <QuickActions />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
