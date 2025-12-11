import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, CreditCard, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ResellerData {
  id: string;
  username: string;
  credits: number;
  status: string;
  userCount: number;
}

export const ResellerStats = () => {
  const [resellers, setResellers] = useState<ResellerData[]>([]);
  const [totalCredits, setTotalCredits] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResellers = async () => {
      try {
        const { data: resellerData, error } = await supabase
          .from('resellers')
          .select('id, username, credits, status')
          .order('credits', { ascending: false })
          .limit(5);

        if (error) throw error;

        // Get user counts per reseller
        const { data: users } = await supabase
          .from('streaming_users')
          .select('reseller_id');

        const userCounts: Record<string, number> = {};
        users?.forEach(u => {
          if (u.reseller_id) {
            userCounts[u.reseller_id] = (userCounts[u.reseller_id] || 0) + 1;
          }
        });

        const enrichedResellers = (resellerData || []).map(r => ({
          ...r,
          userCount: userCounts[r.id] || 0,
        }));

        setResellers(enrichedResellers);
        setTotalCredits(enrichedResellers.reduce((sum, r) => sum + (r.credits || 0), 0));
      } catch (err) {
        console.error('Error fetching resellers:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchResellers();
  }, []);

  if (loading) {
    return (
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Top Reselleri
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-24">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Top Reselleri
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            <CreditCard className="h-3 w-3 mr-1" />
            {totalCredits} kredita
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {resellers.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Nema resellera
          </div>
        ) : (
          <div className="space-y-2">
            {resellers.map((reseller, index) => (
              <div 
                key={reseller.id} 
                className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground w-4">
                    #{index + 1}
                  </span>
                  <span className="font-medium text-sm">{reseller.username}</span>
                  <Badge 
                    variant={reseller.status === 'active' ? 'default' : 'secondary'}
                    className="text-xs h-5"
                  >
                    {reseller.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {reseller.userCount}
                  </span>
                  <span className="font-medium text-primary">
                    {reseller.credits} kr
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
