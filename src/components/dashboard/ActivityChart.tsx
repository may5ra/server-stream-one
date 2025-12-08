import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface ActivityChartProps {
  servers: Array<{
    id: string;
    name: string;
    status: string;
    cpu_usage: number;
    memory_usage: number;
    network_usage: number;
  }>;
  activeStreams: number;
  totalViewers: number;
}

export function ActivityChart({ servers, activeStreams, totalViewers }: ActivityChartProps) {
  const onlineServers = servers.filter(s => s.status === 'online');
  
  const serverData = onlineServers.map(server => ({
    name: server.name.length > 10 ? server.name.substring(0, 10) + '...' : server.name,
    cpu: server.cpu_usage || 0,
    memory: server.memory_usage || 0,
    network: server.network_usage || 0,
  }));

  // If no online servers, show empty state
  if (serverData.length === 0) {
    serverData.push({
      name: 'No servers',
      cpu: 0,
      memory: 0,
      network: 0,
    });
  }

  return (
    <div className="glass rounded-xl p-4 sm:p-5 animate-fade-up" style={{ animationDelay: '0.1s' }}>
      <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-foreground">Server Activity</h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {onlineServers.length} server • {activeStreams} streams • {totalViewers} viewers
          </p>
        </div>
        <div className="flex gap-3 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-primary" />
            <span className="text-[10px] sm:text-xs text-muted-foreground">CPU</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-success" />
            <span className="text-[10px] sm:text-xs text-muted-foreground">RAM</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-warning" />
            <span className="text-[10px] sm:text-xs text-muted-foreground">Net</span>
          </div>
        </div>
      </div>
      
      <div className="h-48 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={serverData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 17%)" />
            <XAxis 
              dataKey="name" 
              stroke="hsl(215, 20%, 55%)" 
              fontSize={10}
              tickLine={false}
            />
            <YAxis 
              stroke="hsl(215, 20%, 55%)" 
              fontSize={10}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(222, 47%, 8%)', 
                border: '1px solid hsl(217, 33%, 17%)',
                borderRadius: '8px',
                color: 'hsl(210, 40%, 98%)',
                fontSize: '12px'
              }}
              formatter={(value: number) => [`${value}%`]}
            />
            <Bar dataKey="cpu" fill="hsl(187, 92%, 50%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="memory" fill="hsl(142, 76%, 45%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="network" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
