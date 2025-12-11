import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Film, Tv2, List, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ContentCounts {
  vodCount: number;
  seriesCount: number;
  episodesCount: number;
  categoriesCount: number;
}

export const ContentStats = () => {
  const [counts, setCounts] = useState<ContentCounts>({
    vodCount: 0,
    seriesCount: 0,
    episodesCount: 0,
    categoriesCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [vodRes, seriesRes, episodesRes, catRes] = await Promise.all([
          supabase.from('vod_content').select('id', { count: 'exact', head: true }),
          supabase.from('series').select('id', { count: 'exact', head: true }),
          supabase.from('series_episodes').select('id', { count: 'exact', head: true }),
          supabase.from('live_categories').select('id', { count: 'exact', head: true }),
        ]);

        setCounts({
          vodCount: vodRes.count || 0,
          seriesCount: seriesRes.count || 0,
          episodesCount: episodesRes.count || 0,
          categoriesCount: catRes.count || 0,
        });
      } catch (err) {
        console.error('Error fetching content counts:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCounts();
  }, []);

  const stats = [
    { label: 'Filmovi', value: counts.vodCount, icon: Film, color: 'text-blue-500' },
    { label: 'Serije', value: counts.seriesCount, icon: Tv2, color: 'text-purple-500' },
    { label: 'Epizode', value: counts.episodesCount, icon: List, color: 'text-green-500' },
    { label: 'Kategorije', value: counts.categoriesCount, icon: FolderOpen, color: 'text-orange-500' },
  ];

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Film className="h-5 w-5 text-primary" />
          Sadržaj
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <div className={`p-2 rounded-lg bg-background ${stat.color}`}>
                <stat.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-lg font-bold">
                  {loading ? '-' : stat.value.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
