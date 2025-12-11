import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, Users, MapPin } from "lucide-react";

// Demo location data - in production this would come from your database
const demoLocations = [
  { country: 'Serbia', code: 'RS', users: 1247, percentage: 35 },
  { country: 'Croatia', code: 'HR', users: 892, percentage: 25 },
  { country: 'Germany', code: 'DE', users: 634, percentage: 18 },
  { country: 'Slovenia', code: 'SI', users: 445, percentage: 12 },
  { country: 'Bosnia', code: 'BA', users: 356, percentage: 10 },
];

export const UserLocationMap = () => {
  const totalUsers = demoLocations.reduce((sum, loc) => sum + loc.users, 0);

  return (
    <Card className="glass h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Lokacije Korisnika
          </CardTitle>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {totalUsers.toLocaleString()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {demoLocations.map((location, index) => (
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
                <span className="text-sm text-muted-foreground">
                  {location.users.toLocaleString()}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${location.percentage}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
