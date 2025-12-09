import { useState, useEffect } from "react";
import { Plus, Search, Play, Pause, Trash2, Circle, Settings, Subtitles, Video, Tv, RefreshCw, Globe, Download, Eye, Upload, Sparkles } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useStreams, Stream } from "@/hooks/useStreams";
import { useSettings } from "@/hooks/useSettings";
import { useLoadBalancers } from "@/hooks/useLoadBalancers";
import { StreamTestPlayer } from "@/components/StreamTestPlayer";
import { M3UImportDialog } from "@/components/M3UImportDialog";

const statusConfig = {
  live: { color: "text-success", bg: "bg-success/20", label: "Live" },
  inactive: { color: "text-muted-foreground", bg: "bg-muted", label: "Offline" },
  error: { color: "text-destructive", bg: "bg-destructive/20", label: "Error" },
  transcoding: { color: "text-warning", bg: "bg-warning/20", label: "Transcoding" },
};

const inputTypeLabels: Record<string, string> = {
  rtmp: "RTMP",
  rtsp: "RTSP",
  srt: "SRT",
  hls: "HLS Pull",
  mpd: "MPD/DASH",
  udp: "UDP/Multicast"
};

// Get unique bouquets from streams
const getUniqueBouquets = (streams: Stream[]): string[] => {
  const bouquets = streams
    .map(s => s.bouquet)
    .filter((b): b is string => b !== null && b !== undefined && b.trim() !== "");
  return [...new Set(bouquets)].sort();
};

// Get unique categories from streams  
const getUniqueCategories = (streams: Stream[]): string[] => {
  const categories = streams
    .map(s => s.category)
    .filter((c): c is string => c !== null && c !== undefined && c.trim() !== "");
  return [...new Set(categories)].sort();
};

// Auto-detect proxy mode based on URL patterns (IP-protected CDNs)
const protectedPatterns: { pattern: RegExp; label: string }[] = [
  // Czech CDNs
  { pattern: /\.cdn\.cz/i, label: "Czech CDN (.cdn.cz)" },
  { pattern: /\.o2tv\.cz/i, label: "O2 TV Czech" },
  { pattern: /\.sledovanitv\.cz/i, label: "Sledovaní TV" },
  { pattern: /\.telly\.cz/i, label: "Telly.cz" },
  { pattern: /\.kuki\.cz/i, label: "Kuki.cz" },
  { pattern: /\.magiogo\.net/i, label: "Magio Go" },
  { pattern: /\.antik\.sk/i, label: "Antik SK" },
  // Slovak CDNs
  { pattern: /\.skylink\.sk/i, label: "Skylink SK" },
  { pattern: /\.digi\.sk/i, label: "Digi SK" },
  // Other protected patterns
  { pattern: /cdnbg\./i, label: "Bulgarian CDN" },
  { pattern: /\.digi-online\./i, label: "Digi Online" },
  { pattern: /ott\.zetcdn\./i, label: "ZetCDN OTT" },
  { pattern: /\.gcs-cdn\./i, label: "GCS CDN" },
  { pattern: /\.akamaized\.net.*token/i, label: "Akamai (token protected)" },
  { pattern: /\.cloudfront\.net.*token/i, label: "CloudFront (token protected)" },
  // Nova and similar
  { pattern: /nova\./i, label: "Nova TV" },
  { pattern: /novaplus\./i, label: "Nova Plus" },
  { pattern: /\.voyo\./i, label: "Voyo" },
  { pattern: /\.markiza\./i, label: "Markíza" },
  // Generic patterns for protected streams
  { pattern: /hdauth=/i, label: "HD Auth token" },
  { pattern: /wmsAuthSign=/i, label: "WMS Auth signature" },
  { pattern: /token=/i, label: "Token authentication" },
];

const detectProxyMode = (url: string): string => {
  if (!url) return "direct";
  
  for (const { pattern } of protectedPatterns) {
    if (pattern.test(url)) {
      return "hls";
    }
  }
  
  return "direct";
};

const getDetectedPatternLabel = (url: string): string | null => {
  if (!url) return null;
  
  for (const { pattern, label } of protectedPatterns) {
    if (pattern.test(url)) {
      return label;
    }
  }
  
  return null;
};

const Streams = () => {
  const { streams, loading, addStream, updateStream, deleteStream, toggleStream, refetch, syncAllStreams } = useStreams();
  const { loadBalancers } = useLoadBalancers();
  const [syncing, setSyncing] = useState(false);

  const handleSyncAll = async () => {
    setSyncing(true);
    await syncAllStreams();
    setSyncing(false);
  };
  const { settings, getStreamUrl } = useSettings();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBouquet, setFilterBouquet] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingStream, setEditingStream] = useState<Stream | null>(null);
  const [testingStream, setTestingStream] = useState<Stream | null>(null);
  
  // Get unique values for filters
  const uniqueBouquets = getUniqueBouquets(streams);
  const uniqueCategories = getUniqueCategories(streams);

  // Calculate next channel number
  const getNextChannelNumber = () => {
    const maxChannel = streams.reduce((max, s) => Math.max(max, s.channel_number || 0), 0);
    return maxChannel + 1;
  };

  const [newStream, setNewStream] = useState({
    name: "",
    input_type: "rtmp",
    input_url: "",
    output_formats: ["hls"],
    bitrate: 4500,
    resolution: "1920x1080",
    webvtt_enabled: false,
    webvtt_url: "",
    webvtt_language: "hr",
    webvtt_label: "Hrvatski",
    dvr_enabled: false,
    dvr_duration: 24,
    abr_enabled: false,
    category: null as string | null,
    bouquet: null as string | null,
    channel_number: null as number | null,
    stream_icon: null as string | null,
    epg_channel_id: null as string | null,
    proxy_mode: "direct" as string | null,
    load_balancer_id: null as string | null,
  });

  // Auto-assign channel number when dialog opens
  useEffect(() => {
    if (isAddOpen && newStream.channel_number === null) {
      setNewStream(prev => ({ ...prev, channel_number: getNextChannelNumber() }));
    }
  }, [isAddOpen, streams]);

  const filteredStreams = streams
    .filter(stream => {
      const matchesSearch = stream.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesBouquet = !filterBouquet || stream.bouquet === filterBouquet;
      const matchesCategory = !filterCategory || stream.category === filterCategory;
      return matchesSearch && matchesBouquet && matchesCategory;
    })
    .sort((a, b) => {
      // Sort by category first
      if (a.category && !b.category) return -1;
      if (!a.category && b.category) return 1;
      if (a.category !== b.category) {
        return (a.category || "").localeCompare(b.category || "");
      }
      
      // Then by bouquet
      if (a.bouquet && !b.bouquet) return -1;
      if (!a.bouquet && b.bouquet) return 1;
      if (a.bouquet !== b.bouquet) {
        return (a.bouquet || "").localeCompare(b.bouquet || "");
      }
      
      // Finally by channel number
      if (a.channel_number && !b.channel_number) return -1;
      if (!a.channel_number && b.channel_number) return 1;
      return (a.channel_number || 0) - (b.channel_number || 0);
    });

  const handleAddStream = async () => {
    if (!newStream.name || !newStream.input_url) return;

    await addStream({
      ...newStream,
      webvtt_url: newStream.webvtt_url || null,
      webvtt_language: newStream.webvtt_language || null,
      webvtt_label: newStream.webvtt_label || null,
    });

    setNewStream({
      name: "",
      input_type: "rtmp",
      input_url: "",
      output_formats: ["hls"],
      bitrate: 4500,
      resolution: "1920x1080",
      webvtt_enabled: false,
      webvtt_url: "",
      webvtt_language: "hr",
      webvtt_label: "Hrvatski",
      dvr_enabled: false,
      dvr_duration: 24,
      abr_enabled: false,
      category: null,
      bouquet: null,
      channel_number: null,
      stream_icon: null,
      epg_channel_id: null,
      proxy_mode: "direct",
      load_balancer_id: null,
    });
    setIsAddOpen(false);
  };

  const handleUpdateStream = async () => {
    if (!editingStream) return;
    await updateStream(editingStream.id, editingStream);
    setEditingStream(null);
  };

  const handleDownloadM3U8 = (stream: Stream) => {
    const url = getStreamUrl(stream.name, stream.input_type, stream.input_url);
    const content = `#EXTM3U\n#EXTINF:-1,${stream.name}\n${url}`;
    const blob = new Blob([content], { type: 'application/x-mpegurl' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${stream.name.toLowerCase().replace(/\s+/g, '-')}.m3u8`;
    link.click();
  };

  // Note: Viewers data is not tracked in real-time, removed fake numbers
  const liveStreams = streams.filter(s => s.status === "live").length;
  const webvttEnabled = streams.filter(s => s.webvtt_enabled).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <div className="lg:ml-64">
        <Header />
        
        <main className="p-4 lg:p-6">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-semibold text-foreground">Nimble Streamer</h2>
                <Badge variant="outline" className="text-xs">WebVTT Enabled</Badge>
              </div>
              <p className="text-muted-foreground">Upravljanje streamovima s podrškom za titlove</p>
              {!settings.serverDomain && (
                <p className="text-warning text-sm mt-1">⚠️ Postavi Domain u Settings za ispravne m3u8 linkove</p>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleSyncAll}
                disabled={syncing}
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sinkroniziram...' : 'Sync Backend'}
              </Button>
              
              <M3UImportDialog onImportComplete={refetch} />
              
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button variant="glow">
                    <Plus className="h-4 w-4" />
                    Dodaj Stream
                  </Button>
                </DialogTrigger>
              <DialogContent className="glass max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Dodaj novi stream</DialogTitle>
                </DialogHeader>
                
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="basic">Osnovno</TabsTrigger>
                    <TabsTrigger value="webvtt">WebVTT Titlovi</TabsTrigger>
                    <TabsTrigger value="advanced">Napredno</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="basic" className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Naziv streama</Label>
                        <Input
                          value={newStream.name}
                          onChange={(e) => setNewStream({ ...newStream, name: e.target.value })}
                          placeholder="npr. Sports HD"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Broj kanala</Label>
                        <Input
                          type="number"
                          value={newStream.channel_number || ""}
                          onChange={(e) => setNewStream({ ...newStream, channel_number: e.target.value ? parseInt(e.target.value) : null })}
                          placeholder="1"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Kategorija</Label>
                        <Input
                          value={newStream.category || ""}
                          onChange={(e) => setNewStream({ ...newStream, category: e.target.value || null })}
                          placeholder="Sport, Film, Vijesti..."
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Bouquet</Label>
                        <Input
                          value={newStream.bouquet || ""}
                          onChange={(e) => setNewStream({ ...newStream, bouquet: e.target.value || null })}
                          placeholder="Basic, Premium..."
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Tip ulaza</Label>
                      <Select 
                        value={newStream.input_type} 
                        onValueChange={(v) => setNewStream({ ...newStream, input_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rtmp">RTMP</SelectItem>
                          <SelectItem value="rtsp">RTSP</SelectItem>
                          <SelectItem value="srt">SRT (Secure Reliable Transport)</SelectItem>
                          <SelectItem value="hls">HLS Pull (.m3u8)</SelectItem>
                          <SelectItem value="mpd">MPD/DASH (.mpd)</SelectItem>
                          <SelectItem value="udp">UDP/Multicast</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>URL izvora</Label>
                      <Input
                        value={newStream.input_url}
                        onChange={(e) => {
                          const url = e.target.value;
                          const autoProxyMode = detectProxyMode(url);
                          setNewStream({ 
                            ...newStream, 
                            input_url: url,
                            proxy_mode: autoProxyMode
                          });
                        }}
                        placeholder={
                          newStream.input_type === "rtmp" ? "rtmp://server/app/stream" :
                          newStream.input_type === "srt" ? "srt://server:port?streamid=..." :
                          newStream.input_type === "hls" ? "http://server/live.m3u8" :
                          newStream.input_type === "mpd" ? "http://server/manifest.mpd" :
                          newStream.input_type === "udp" ? "udp://239.0.0.1:5000" :
                          "rtsp://server/stream"
                        }
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Izlazni formati</Label>
                      <div className="flex flex-wrap gap-2">
                        {["hls", "dash", "rtmp", "srt"].map((format) => (
                          <Button
                            key={format}
                            type="button"
                            variant={newStream.output_formats?.includes(format) ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              const formats = newStream.output_formats || [];
                              setNewStream({
                                ...newStream,
                                output_formats: formats.includes(format)
                                  ? formats.filter(f => f !== format)
                                  : [...formats, format]
                              });
                            }}
                          >
                            {format.toUpperCase()}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="webvtt" className="space-y-4 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Omogući WebVTT titlove</Label>
                        <p className="text-xs text-muted-foreground">Dodaj titlove u HLS/DASH stream</p>
                      </div>
                      <Switch
                        checked={newStream.webvtt_enabled}
                        onCheckedChange={(checked) => setNewStream({ ...newStream, webvtt_enabled: checked })}
                      />
                    </div>
                    
                    {newStream.webvtt_enabled && (
                      <>
                        <div className="space-y-2">
                          <Label>WebVTT URL</Label>
                          <Input
                            value={newStream.webvtt_url}
                            onChange={(e) => setNewStream({ ...newStream, webvtt_url: e.target.value })}
                            placeholder="http://subtitles.server/stream.vtt"
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Jezik (ISO 639-1)</Label>
                            <Select 
                              value={newStream.webvtt_language}
                              onValueChange={(v) => setNewStream({ ...newStream, webvtt_language: v })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="hr">Hrvatski (hr)</SelectItem>
                                <SelectItem value="en">English (en)</SelectItem>
                                <SelectItem value="de">Deutsch (de)</SelectItem>
                                <SelectItem value="sr">Srpski (sr)</SelectItem>
                                <SelectItem value="sl">Slovenščina (sl)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Oznaka titlova</Label>
                            <Input
                              value={newStream.webvtt_label}
                              onChange={(e) => setNewStream({ ...newStream, webvtt_label: e.target.value })}
                              placeholder="Hrvatski titlovi"
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="advanced" className="space-y-4 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>DVR (Timeshift)</Label>
                        <p className="text-xs text-muted-foreground">Omogući snimanje za vraćanje unatrag</p>
                      </div>
                      <Switch
                        checked={newStream.dvr_enabled}
                        onCheckedChange={(checked) => setNewStream({ ...newStream, dvr_enabled: checked })}
                      />
                    </div>
                    
                    {newStream.dvr_enabled && (
                      <div className="space-y-2">
                        <Label>DVR trajanje (sati)</Label>
                        <Input
                          type="number"
                          value={newStream.dvr_duration}
                          onChange={(e) => setNewStream({ ...newStream, dvr_duration: parseInt(e.target.value) || 24 })}
                        />
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>ABR (Adaptive Bitrate)</Label>
                        <p className="text-xs text-muted-foreground">Automatska prilagodba kvalitete</p>
                      </div>
                      <Switch
                        checked={newStream.abr_enabled}
                        onCheckedChange={(checked) => setNewStream({ ...newStream, abr_enabled: checked })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Rezolucija</Label>
                      <Select 
                        value={newStream.resolution}
                        onValueChange={(v) => setNewStream({ ...newStream, resolution: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3840x2160">4K (3840x2160)</SelectItem>
                          <SelectItem value="1920x1080">1080p (1920x1080)</SelectItem>
                          <SelectItem value="1280x720">720p (1280x720)</SelectItem>
                          <SelectItem value="854x480">480p (854x480)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Bitrate (kbps)</Label>
                      <Input
                        type="number"
                        value={newStream.bitrate}
                        onChange={(e) => setNewStream({ ...newStream, bitrate: parseInt(e.target.value) || 4500 })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label>Proxy Mode</Label>
                        {newStream.input_url && detectProxyMode(newStream.input_url) !== "direct" && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-xs bg-warning/20 text-warning border-warning/30 cursor-help">
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  Auto-detected
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-medium">Zaštićeni izvor detektiran</p>
                                <p className="text-xs text-muted-foreground">Pattern: {getDetectedPatternLabel(newStream.input_url)}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">Način preusmjeravanja streama</p>
                      <Select 
                        value={newStream.proxy_mode || "direct"}
                        onValueChange={(v) => setNewStream({ ...newStream, proxy_mode: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="direct">Direct (passthrough)</SelectItem>
                          <SelectItem value="hls">HLS Proxy (za zaštićene izvore)</SelectItem>
                          <SelectItem value="ffmpeg">FFmpeg Re-stream (za CDN zaštitu)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Load Balancer Selection */}
                    {loadBalancers.length > 0 && (
                      <div className="space-y-2">
                        <Label>Load Balancer</Label>
                        <p className="text-xs text-muted-foreground mb-2">Server koji će streamati ovaj kanal</p>
                        <Select 
                          value={newStream.load_balancer_id || "none"}
                          onValueChange={(v) => setNewStream({ ...newStream, load_balancer_id: v === "none" ? null : v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Odaberi Load Balancer" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Bez Load Balancera</SelectItem>
                            {loadBalancers.map((lb) => (
                              <SelectItem key={lb.id} value={lb.id}>
                                {lb.name} ({lb.ip_address}:{lb.port})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
                
                <Button onClick={handleAddStream} className="w-full" variant="glow">
                  Dodaj Stream
                </Button>
              </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Stats */}
          <div className="mb-6 grid gap-4 grid-cols-2 lg:grid-cols-3">
            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                  <Tv className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{streams.length}</p>
                  <p className="text-sm text-muted-foreground">Ukupno streamova</p>
                </div>
              </div>
            </div>
            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/20">
                  <Circle className="h-5 w-5 text-success fill-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{liveStreams}</p>
                  <p className="text-sm text-muted-foreground">Aktivnih</p>
                </div>
              </div>
            </div>
            <div className="glass rounded-xl p-4 col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20">
                  <Subtitles className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{webvttEnabled}</p>
                  <p className="text-sm text-muted-foreground">WebVTT aktivno</p>
                </div>
              </div>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="mb-6 flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Pretraži streamove..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {uniqueCategories.length > 0 && (
              <Select 
                value={filterCategory || "all"} 
                onValueChange={(v) => setFilterCategory(v === "all" ? null : v)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Kategorija" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Sve kategorije</SelectItem>
                  {uniqueCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {uniqueBouquets.length > 0 && (
              <Select 
                value={filterBouquet || "all"} 
                onValueChange={(v) => setFilterBouquet(v === "all" ? null : v)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Bouquet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Svi bouqueti</SelectItem>
                  {uniqueBouquets.map(bq => (
                    <SelectItem key={bq} value={bq}>{bq}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {(filterCategory || filterBouquet) && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setFilterCategory(null);
                  setFilterBouquet(null);
                }}
              >
                Očisti filtere
              </Button>
            )}
          </div>

          {/* Stream Cards */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {filteredStreams.map((stream) => {
              const status = statusConfig[stream.status as keyof typeof statusConfig] || statusConfig.inactive;
              return (
                <div key={stream.id} className="glass rounded-xl p-5">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{stream.name}</h3>
                      <p className="text-xs text-muted-foreground truncate">{stream.input_url}</p>
                    </div>
                    <span className={`ml-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.bg} ${status.color}`}>
                      <Circle className="h-2 w-2 fill-current" />
                      {status.label}
                    </span>
                  </div>
                  
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {stream.channel_number && (
                      <Badge variant="secondary" className="text-xs font-bold">#{stream.channel_number}</Badge>
                    )}
                    {stream.category && (
                      <Badge variant="outline" className="text-xs">{stream.category}</Badge>
                    )}
                    {stream.bouquet && (
                      <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">{stream.bouquet}</Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">{inputTypeLabels[stream.input_type] || stream.input_type}</Badge>
                    {stream.proxy_mode && stream.proxy_mode !== "direct" && (
                      <Badge variant="outline" className={`text-xs ${stream.proxy_mode === "hls" ? "bg-blue-500/10 text-blue-400 border-blue-500/30" : "bg-orange-500/10 text-orange-400 border-orange-500/30"}`}>
                        {stream.proxy_mode === "hls" ? "HLS Proxy" : "FFmpeg"}
                      </Badge>
                    )}
                    {stream.output_formats?.map((format: string) => (
                      <Badge key={format} variant="outline" className="text-xs">{format.toUpperCase()}</Badge>
                    ))}
                    {stream.webvtt_enabled && (
                      <Badge variant="outline" className="text-xs bg-accent/10 text-accent border-accent/30">
                        <Subtitles className="h-3 w-3 mr-1" />
                        {stream.webvtt_language?.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="text-center p-2 rounded bg-muted/50">
                      <p className="text-muted-foreground">Bitrate</p>
                      <p className="font-semibold text-foreground">{stream.bitrate} kbps</p>
                    </div>
                    <div className="text-center p-2 rounded bg-muted/50">
                      <p className="text-muted-foreground">Rezolucija</p>
                      <p className="font-semibold text-foreground">{stream.resolution}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant={stream.status === "live" ? "destructive" : "success"} 
                      size="sm" 
                      className="flex-1"
                      onClick={() => toggleStream(stream.id)}
                    >
                      {stream.status === "live" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      {stream.status === "live" ? "Stop" : "Start"}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setTestingStream(stream)}
                      title="Test Stream"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDownloadM3U8(stream)}
                      title="Download M3U8"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setEditingStream(stream)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-destructive"
                      onClick={() => deleteStream(stream.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {streams.length === 0 && (
            <div className="glass rounded-xl p-12 text-center">
              <Tv className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">Nema streamova</h3>
              <p className="text-muted-foreground">Dodaj prvi stream da započneš</p>
            </div>
          )}

          {/* Edit Dialog */}
          <Dialog open={!!editingStream} onOpenChange={(open) => !open && setEditingStream(null)}>
            <DialogContent className="glass max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Uredi stream: {editingStream?.name}</DialogTitle>
              </DialogHeader>
              
              {editingStream && (
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="basic">Osnovno</TabsTrigger>
                    <TabsTrigger value="webvtt">WebVTT</TabsTrigger>
                    <TabsTrigger value="advanced">Napredno</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="basic" className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Naziv</Label>
                        <Input
                          value={editingStream.name}
                          onChange={(e) => setEditingStream({ ...editingStream, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Broj kanala</Label>
                        <Input
                          type="number"
                          value={editingStream.channel_number || ""}
                          onChange={(e) => setEditingStream({ ...editingStream, channel_number: e.target.value ? parseInt(e.target.value) : null })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Kategorija</Label>
                        <Input
                          value={editingStream.category || ""}
                          onChange={(e) => setEditingStream({ ...editingStream, category: e.target.value || null })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Bouquet</Label>
                        <Input
                          value={editingStream.bouquet || ""}
                          onChange={(e) => setEditingStream({ ...editingStream, bouquet: e.target.value || null })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>URL izvora</Label>
                      <Input
                        value={editingStream.input_url}
                        onChange={(e) => setEditingStream({ ...editingStream, input_url: e.target.value })}
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="webvtt" className="space-y-4 py-4">
                    <div className="flex items-center justify-between">
                      <Label>WebVTT omogućen</Label>
                      <Switch
                        checked={editingStream.webvtt_enabled}
                        onCheckedChange={(checked) => setEditingStream({ ...editingStream, webvtt_enabled: checked })}
                      />
                    </div>
                    {editingStream.webvtt_enabled && (
                      <>
                        <div className="space-y-2">
                          <Label>WebVTT URL</Label>
                          <Input
                            value={editingStream.webvtt_url || ""}
                            onChange={(e) => setEditingStream({ ...editingStream, webvtt_url: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Jezik</Label>
                          <Input
                            value={editingStream.webvtt_language || ""}
                            onChange={(e) => setEditingStream({ ...editingStream, webvtt_language: e.target.value })}
                          />
                        </div>
                      </>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="advanced" className="space-y-4 py-4">
                    <div className="space-y-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <Label className="text-primary font-semibold">Proxy Mode</Label>
                      <p className="text-xs text-muted-foreground">Način preusmjeravanja streama za IPTV playlistu</p>
                      <Select 
                        value={editingStream.proxy_mode || "direct"}
                        onValueChange={(v) => setEditingStream({ ...editingStream, proxy_mode: v })}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="direct">Direct (passthrough)</SelectItem>
                          <SelectItem value="hls">HLS Proxy (za zaštićene izvore)</SelectItem>
                          <SelectItem value="ffmpeg">FFmpeg Re-stream (za CDN zaštitu)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <Label>DVR</Label>
                        <Switch
                          checked={editingStream.dvr_enabled}
                          onCheckedChange={(checked) => setEditingStream({ ...editingStream, dvr_enabled: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <Label>ABR</Label>
                        <Switch
                          checked={editingStream.abr_enabled}
                          onCheckedChange={(checked) => setEditingStream({ ...editingStream, abr_enabled: checked })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Bitrate (kbps)</Label>
                      <Input
                        type="number"
                        value={editingStream.bitrate}
                        onChange={(e) => setEditingStream({ ...editingStream, bitrate: parseInt(e.target.value) || 4500 })}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              )}
              
              <Button onClick={handleUpdateStream} className="w-full" variant="glow">
                Spremi promjene
              </Button>
            </DialogContent>
          </Dialog>

          {/* Stream Test Player */}
          <StreamTestPlayer 
            open={!!testingStream}
            onOpenChange={(open) => !open && setTestingStream(null)}
            streamUrl={testingStream ? getStreamUrl(testingStream.name, testingStream.input_type, testingStream.input_url) : ''}
            streamName={testingStream?.name || ''}
            inputType={testingStream?.input_type}
            webvttUrl={testingStream?.webvtt_enabled ? testingStream.webvtt_url : null}
            webvttLabel={testingStream?.webvtt_label}
            webvttLanguage={testingStream?.webvtt_language}
          />
        </main>
      </div>
    </div>
  );
};

export default Streams;
