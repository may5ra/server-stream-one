import { Users, Tv, Activity, HardDrive } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { UsersTable } from "@/components/dashboard/UsersTable";
import { ServerStatus } from "@/components/dashboard/ServerStatus";
import { QuickActions } from "@/components/dashboard/QuickActions";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <div className="ml-64">
        <Header />
        
        <main className="p-6">
          {/* Page Title */}
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-foreground">Dashboard</h2>
            <p className="text-muted-foreground">Welcome back, Admin. Here's your server overview.</p>
          </div>

          {/* Stats Grid */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Total Users"
              value="1,284"
              change="+12% from last month"
              changeType="positive"
              icon={Users}
              iconColor="text-primary"
            />
            <StatsCard
              title="Active Streams"
              value="342"
              change="+8% from yesterday"
              changeType="positive"
              icon={Tv}
              iconColor="text-success"
            />
            <StatsCard
              title="Active Connections"
              value="892"
              change="-3% from peak"
              changeType="negative"
              icon={Activity}
              iconColor="text-warning"
            />
            <StatsCard
              title="Bandwidth Used"
              value="2.4 TB"
              change="45% of monthly quota"
              changeType="neutral"
              icon={HardDrive}
              iconColor="text-primary"
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Chart - 2 columns */}
            <div className="lg:col-span-2">
              <ActivityChart />
            </div>
            
            {/* Server Status */}
            <div>
              <ServerStatus />
            </div>
          </div>

          {/* Bottom Grid */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Users Table - 2 columns */}
            <div className="lg:col-span-2">
              <UsersTable />
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
