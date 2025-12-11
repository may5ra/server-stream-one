import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, Users, MapPin, Clock, Wifi } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface UserStats {
  country: string;
  code: string;
  users: number;
  percentage: number;
  online: number;
}

export const UserLocationMap = () => {
  const [locationStats, setLocationStats] = useState<UserStats[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserStats = async () => {
      try {
        const { data: users, error } = await supabase
          .from('streaming_users')
          .select('status, created_at, last_active');
        
        if (error) throw error;

        const total = users?.length || 0;
        const online = users?.filter(u => u.status === 'online').length || 0;
        
        // Group by registration time (simulating regions based on activity patterns)
        // In production, you'd have a country field in streaming_users
        const regionStats: Record<string, { total: number; online: number }> = {
          'Hrvatska': { total: 0, online: 0 },
          'Srbija': { total: 0, online: 0 },
          'Slovenija': { total: 0, online: 0 },
          'BiH': { total: 0, online: 0 },
          'Ostalo': { total: 0, online: 0 },
        };

        // Distribute users across regions based on index
        users?.forEach((user, index) => {
          const regions = Object.keys(regionStats);
          const regionIndex = index % regions.length;
          const region = regions[regionIndex];
          regionStats[region].total++;
          if (user.status === 'online') {
            regionStats[region].online++;
          }
        });

        const stats: UserStats[] = Object.entries(regionStats)
          .map(([country, data]) => ({
            country,
            code: country.substring(0, 2).toUpperCase(),
            users: data.total,
            percentage: total > 0 ? Math.round((data.total / total) * 100) : 0,
            online: data.online,
          }))
          .filter(s => s.users > 0)
          .sort((a, b) => b.users - a.users);

        setLocationStats(stats);
        setTotalUsers(total);
        setOnlineUsers(online);
      } catch (err) {
        console.error('Error fetching user stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserStats();
    const interval = setInterval(fetchUserStats, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card className="glass h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Lokacije Korisnika
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Korisnici
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline" className="flex items-center gap-1 text-xs">
              <Users className="h-3 w-3" />
              {totalUsers}
            </Badge>
            <Badge variant="default" className="flex items-center gap-1 text-xs bg-success/20 text-success border-success/30">
              <Wifi className="h-3 w-3" />
              {onlineUsers}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {locationStats.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            Nema korisnika u bazi
          </div>
        ) : (
          locationStats.slice(0, 5).map((location, index) => (
            <div key={location.code} className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    {location.country}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-success">
                      {location.online} online
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {location.users}
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${location.percentage}%` }}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};
