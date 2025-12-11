import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, Users, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface UserLocation {
  ip: string;
  lat: number;
  lng: number;
  country: string;
  countryCode: string;
  city: string;
  username: string;
  streamName?: string;
}

export const UserLocationMap = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [locations, setLocations] = useState<UserLocation[]>([]);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Fetch Mapbox token from edge function
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        if (data?.token) {
          setMapboxToken(data.token);
        }
      } catch (e) {
        console.error('Could not fetch Mapbox token:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchToken();
  }, []);

  // Simulated user locations for demo
  useEffect(() => {
    // In production, this would fetch real data from connections
    const demoLocations: UserLocation[] = [
      { ip: '185.60.12.45', lat: 44.8, lng: 20.5, country: 'Serbia', countryCode: 'RS', city: 'Belgrade', username: 'user1' },
      { ip: '89.142.33.12', lat: 45.8, lng: 15.98, country: 'Croatia', countryCode: 'HR', city: 'Zagreb', username: 'user2' },
      { ip: '78.24.15.87', lat: 43.85, lng: 18.35, country: 'Bosnia', countryCode: 'BA', city: 'Sarajevo', username: 'user3' },
      { ip: '91.185.12.65', lat: 46.05, lng: 14.5, country: 'Slovenia', countryCode: 'SI', city: 'Ljubljana', username: 'user4' },
      { ip: '195.178.45.21', lat: 42.0, lng: 21.4, country: 'North Macedonia', countryCode: 'MK', city: 'Skopje', username: 'user5' },
      { ip: '52.14.78.123', lat: 40.71, lng: -74.0, country: 'United States', countryCode: 'US', city: 'New York', username: 'user6' },
      { ip: '87.65.32.11', lat: 52.52, lng: 13.4, country: 'Germany', countryCode: 'DE', city: 'Berlin', username: 'user7' },
    ];
    setLocations(demoLocations);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || map.current) return;

    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      projection: 'globe',
      zoom: 3,
      center: [15, 45],
      pitch: 20,
    });

    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      'top-right'
    );

    map.current.scrollZoom.disable();

    map.current.on('style.load', () => {
      map.current?.setFog({
        color: 'rgb(20, 20, 30)',
        'high-color': 'rgb(40, 40, 60)',
        'horizon-blend': 0.1,
      });
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [mapboxToken]);

  // Add markers for user locations
  useEffect(() => {
    if (!map.current || locations.length === 0) return;

    // Wait for map to load
    const addMarkers = () => {
      locations.forEach((loc) => {
        const el = document.createElement('div');
        el.className = 'user-marker';
        el.style.cssText = `
          width: 12px;
          height: 12px;
          background: hsl(var(--primary));
          border: 2px solid white;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 0 10px hsl(var(--primary));
          animation: pulse 2s infinite;
        `;

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="padding: 8px; font-family: system-ui;">
            <strong>${loc.username}</strong><br/>
            <span style="font-size: 12px; color: #888;">
              ${loc.city}, ${loc.country}<br/>
              IP: ${loc.ip}
            </span>
          </div>
        `);

        new mapboxgl.Marker(el)
          .setLngLat([loc.lng, loc.lat])
          .setPopup(popup)
          .addTo(map.current!);
      });
    };

    if (map.current.loaded()) {
      addMarkers();
    } else {
      map.current.on('load', addMarkers);
    }
  }, [locations, mapboxToken]);

  // Count by country
  const countryStats = locations.reduce((acc, loc) => {
    acc[loc.country] = (acc[loc.country] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (!mapboxToken && !loading) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Mapa Korisnika
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <MapPin className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">Mapbox token nije konfiguriran</p>
            <p className="text-xs">Dodaj MAPBOX_PUBLIC_TOKEN u Secrets</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Live Korisnici
          </CardTitle>
          <Badge variant="outline" className="gap-1">
            <Users className="h-3 w-3" />
            {locations.length} online
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div 
          ref={mapContainer} 
          className="h-64 w-full"
          style={{ minHeight: '250px' }}
        />
        
        {/* Country stats */}
        <div className="p-3 border-t border-border bg-muted/20">
          <div className="flex flex-wrap gap-2">
            {Object.entries(countryStats)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([country, count]) => (
                <Badge key={country} variant="secondary" className="text-xs">
                  {country}: {count}
                </Badge>
              ))}
          </div>
        </div>
      </CardContent>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.7; }
        }
      `}</style>
    </Card>
  );
};
