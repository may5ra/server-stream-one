import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { time: '00:00', connections: 120, bandwidth: 45 },
  { time: '04:00', connections: 85, bandwidth: 32 },
  { time: '08:00', connections: 210, bandwidth: 78 },
  { time: '12:00', connections: 380, bandwidth: 125 },
  { time: '16:00', connections: 420, bandwidth: 145 },
  { time: '20:00', connections: 350, bandwidth: 110 },
  { time: '23:59', connections: 180, bandwidth: 65 },
];

export function ActivityChart() {
  return (
    <div className="glass rounded-xl p-5 animate-fade-up" style={{ animationDelay: '0.1s' }}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Server Activity</h3>
          <p className="text-sm text-muted-foreground">Last 24 hours</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">Connections</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-success" />
            <span className="text-xs text-muted-foreground">Bandwidth (GB)</span>
          </div>
        </div>
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorConnections" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(187, 92%, 50%)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(187, 92%, 50%)" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorBandwidth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(142, 76%, 45%)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(142, 76%, 45%)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 17%)" />
            <XAxis 
              dataKey="time" 
              stroke="hsl(215, 20%, 55%)" 
              fontSize={12}
              tickLine={false}
            />
            <YAxis 
              stroke="hsl(215, 20%, 55%)" 
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(222, 47%, 8%)', 
                border: '1px solid hsl(217, 33%, 17%)',
                borderRadius: '8px',
                color: 'hsl(210, 40%, 98%)'
              }}
            />
            <Area 
              type="monotone" 
              dataKey="connections" 
              stroke="hsl(187, 92%, 50%)" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorConnections)" 
            />
            <Area 
              type="monotone" 
              dataKey="bandwidth" 
              stroke="hsl(142, 76%, 45%)" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorBandwidth)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
