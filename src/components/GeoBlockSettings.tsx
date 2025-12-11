import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Shield, 
  Plus, 
  Trash2, 
  Search, 
  Globe,
  Ban,
  Check
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BlockedCountry {
  id: string;
  country_code: string;
  country_name: string;
  blocked_at: string;
  reason?: string;
}

// Popular countries list
const COUNTRIES = [
  { code: 'RU', name: 'Russia' },
  { code: 'CN', name: 'China' },
  { code: 'IR', name: 'Iran' },
  { code: 'KP', name: 'North Korea' },
  { code: 'SY', name: 'Syria' },
  { code: 'CU', name: 'Cuba' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'BY', name: 'Belarus' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'ZW', name: 'Zimbabwe' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'PL', name: 'Poland' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'RO', name: 'Romania' },
  { code: 'RS', name: 'Serbia' },
  { code: 'HR', name: 'Croatia' },
  { code: 'BA', name: 'Bosnia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'AL', name: 'Albania' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'XK', name: 'Kosovo' },
  { code: 'TR', name: 'Turkey' },
  { code: 'GR', name: 'Greece' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'AT', name: 'Austria' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'BE', name: 'Belgium' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IE', name: 'Ireland' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'BR', name: 'Brazil' },
  { code: 'AR', name: 'Argentina' },
  { code: 'MX', name: 'Mexico' },
  { code: 'IN', name: 'India' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'PH', name: 'Philippines' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'AE', name: 'UAE' },
  { code: 'EG', name: 'Egypt' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'KE', name: 'Kenya' },
];

export const GeoBlockSettings = () => {
  const [blockedCountries, setBlockedCountries] = useState<BlockedCountry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const fetchBlockedCountries = async () => {
    try {
      const { data, error } = await supabase
        .from("geo_blocked_countries")
        .select("*")
        .order("blocked_at", { ascending: false });

      if (error) throw error;
      setBlockedCountries(data || []);
    } catch (error: any) {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockedCountries();
  }, []);

  const blockCountry = async (code: string, name: string) => {
    try {
      const { error } = await supabase
        .from("geo_blocked_countries")
        .insert({ country_code: code, country_name: name });

      if (error) throw error;

      toast({
        title: "Zemlja blokirana",
        description: `${name} je dodana na listu blokiranih zemalja`,
      });
      fetchBlockedCountries();
    } catch (error: any) {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const unblockCountry = async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from("geo_blocked_countries")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Zemlja odblokirana",
        description: `${name} je uklonjena s liste blokiranih`,
      });
      fetchBlockedCountries();
    } catch (error: any) {
      toast({
        title: "Greška",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const blockedCodes = blockedCountries.map(c => c.country_code);
  const filteredCountries = COUNTRIES.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Geo-Blocking
        </CardTitle>
        <CardDescription>
          Blokiraj pristup streamovima iz određenih zemalja
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Blocked Countries */}
        {blockedCountries.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              Blokirane zemlje ({blockedCountries.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {blockedCountries.map((country) => (
                <Badge 
                  key={country.id} 
                  variant="destructive"
                  className="flex items-center gap-1 pr-1"
                >
                  <img 
                    src={`https://flagcdn.com/16x12/${country.country_code.toLowerCase()}.png`}
                    alt={country.country_name}
                    className="h-3 w-4"
                  />
                  {country.country_name}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1 hover:bg-destructive-foreground/20"
                    onClick={() => unblockCountry(country.id, country.country_name)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Search and Add Countries */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pretraži zemlje..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-48 rounded-lg border border-border">
            <div className="p-2 space-y-1">
              {filteredCountries.map((country) => {
                const isBlocked = blockedCodes.includes(country.code);
                return (
                  <div 
                    key={country.code}
                    className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                      isBlocked 
                        ? 'bg-destructive/10' 
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <img 
                        src={`https://flagcdn.com/20x15/${country.code.toLowerCase()}.png`}
                        alt={country.name}
                        className="h-4 w-5"
                      />
                      <span className="text-sm">{country.name}</span>
                      <span className="text-xs text-muted-foreground">({country.code})</span>
                    </div>
                    {isBlocked ? (
                      <Badge variant="destructive" className="gap-1">
                        <Ban className="h-3 w-3" />
                        Blokirano
                      </Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => blockCountry(country.code, country.name)}
                        className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Blokiraj
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <p className="text-xs text-muted-foreground">
          💡 Blokirane zemlje neće moći pristupiti streamovima putem Xtream API-ja i M3U playlist-a
        </p>
      </CardContent>
    </Card>
  );
};
