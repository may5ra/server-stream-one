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
    <div className="glass rounded-xl p-5 animate-fade-up" style={{ animationDelay: '0.1s' }}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Server Activity</h3>
          <p className="text-sm text-muted-foreground">
            {onlineServers.length} server(s) online • {activeStreams} active stream(s) • {totalViewers} viewer(s)
          </p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">CPU %</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-success" />
            <span className="text-xs text-muted-foreground">Memory %</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-warning" />
            <span className="text-xs text-muted-foreground">Network %</span>
          </div>
        </div>
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={serverData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 17%)" />
            <XAxis 
              dataKey="name" 
              stroke="hsl(215, 20%, 55%)" 
              fontSize={12}
              tickLine={false}
            />
            <YAxis 
              stroke="hsl(215, 20%, 55%)" 
              fontSize={12}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(222, 47%, 8%)', 
                border: '1px solid hsl(217, 33%, 17%)',
                borderRadius: '8px',
                color: 'hsl(210, 40%, 98%)'
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
