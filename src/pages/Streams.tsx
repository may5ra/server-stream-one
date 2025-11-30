import { useState } from "react";
import { Plus, Search, Play, Pause, Trash2, Circle, Settings, Subtitles, Video, Tv, RefreshCw, Globe } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface WebVTTConfig {
  enabled: boolean;
  sourceUrl: string;
  language: string;
  label: string;
  default: boolean;
}

interface TranscodingProfile {
  resolution: string;
  bitrate: string;
  codec: string;
}

interface NimbleStream {
  id: string;
  name: string;
  inputType: "rtmp" | "rtsp" | "srt" | "hls" | "udp";
  inputUrl: string;
  outputFormats: ("hls" | "dash" | "rtmp" | "srt")[];
  status: "live" | "offline" | "error" | "transcoding";
  viewers: number;
  bitrate: string;
  uptime: string;
  webvtt: WebVTTConfig;
  transcoding: TranscodingProfile[];
  dvr: boolean;
  dvrDuration: number;
  abr: boolean;
}

const initialStreams: NimbleStream[] = [
  { 
    id: "1", 
    name: "Sports Channel HD", 
    inputType: "rtmp",
    inputUrl: "rtmp://source1.example.com/live/sports", 
    outputFormats: ["hls", "dash"],
    status: "live", 
    viewers: 145, 
    bitrate: "4500 kbps", 
    uptime: "5h 32m",
    webvtt: { enabled: true, sourceUrl: "http://subtitles.example.com/sports.vtt", language: "hr", label: "Hrvatski", default: true },
    transcoding: [
      { resolution: "1080p", bitrate: "4500", codec: "h264" },
      { resolution: "720p", bitrate: "2500", codec: "h264" },
      { resolution: "480p", bitrate: "1200", codec: "h264" }
    ],
    dvr: true,
    dvrDuration: 3600,
    abr: true
  },
  { 
    id: "2", 
    name: "News 24/7", 
    inputType: "srt",
    inputUrl: "srt://news.stream:9000?streamid=live/news", 
    outputFormats: ["hls"],
    status: "live", 
    viewers: 89, 
    bitrate: "2500 kbps", 
    uptime: "12h 15m",
    webvtt: { enabled: true, sourceUrl: "http://subtitles.example.com/news.vtt", language: "en", label: "English", default: true },
    transcoding: [
      { resolution: "720p", bitrate: "2500", codec: "h264" }
    ],
    dvr: false,
    dvrDuration: 0,
    abr: false
  },
  { 
    id: "3", 
    name: "Movies Premium", 
    inputType: "hls",
    inputUrl: "http://movies.server/live/movie.m3u8", 
    outputFormats: ["hls", "dash", "srt"],
    status: "offline", 
    viewers: 0, 
    bitrate: "6000 kbps", 
    uptime: "0m",
    webvtt: { enabled: true, sourceUrl: "http://subtitles.example.com/movie.vtt", language: "hr", label: "Hrvatski titlovi", default: true },
    transcoding: [
      { resolution: "1080p", bitrate: "6000", codec: "h265" }
    ],
    dvr: true,
    dvrDuration: 7200,
    abr: true
  },
  { 
    id: "4", 
    name: "Music Channel", 
    inputType: "udp",
    inputUrl: "udp://239.0.0.1:5000", 
    outputFormats: ["hls"],
    status: "live", 
    viewers: 67, 
    bitrate: "1500 kbps", 
    uptime: "3h 45m",
    webvtt: { enabled: false, sourceUrl: "", language: "", label: "", default: false },
    transcoding: [],
    dvr: false,
    dvrDuration: 0,
    abr: false
  },
  { 
    id: "5", 
    name: "Documentary HD", 
    inputType: "rtsp",
    inputUrl: "rtsp://docs.stream/live/doc1", 
    outputFormats: ["hls", "dash"],
    status: "error", 
    viewers: 0, 
    bitrate: "4000 kbps", 
    uptime: "0m",
    webvtt: { enabled: true, sourceUrl: "http://subtitles.example.com/doc.vtt", language: "hr", label: "Hrvatski", default: true },
    transcoding: [
      { resolution: "1080p", bitrate: "4000", codec: "h264" }
    ],
    dvr: true,
    dvrDuration: 3600,
    abr: false
  },
];

const statusConfig = {
  live: { color: "text-success", bg: "bg-success/20", label: "Live" },
  offline: { color: "text-muted-foreground", bg: "bg-muted", label: "Offline" },
  error: { color: "text-destructive", bg: "bg-destructive/20", label: "Error" },
  transcoding: { color: "text-warning", bg: "bg-warning/20", label: "Transcoding" },
};

const inputTypeLabels = {
  rtmp: "RTMP",
  rtsp: "RTSP",
  srt: "SRT",
  hls: "HLS Pull",
  udp: "UDP/Multicast"
};

const Streams = () => {
  const [streams, setStreams] = useState<NimbleStream[]>(initialStreams);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingStream, setEditingStream] = useState<NimbleStream | null>(null);
  const { toast } = useToast();

  const [newStream, setNewStream] = useState<Partial<NimbleStream>>({
    name: "",
    inputType: "rtmp",
    inputUrl: "",
    outputFormats: ["hls"],
    bitrate: "4500 kbps",
    webvtt: { enabled: false, sourceUrl: "", language: "hr", label: "Hrvatski", default: true },
    transcoding: [],
    dvr: false,
    dvrDuration: 3600,
    abr: false
  });

  const filteredStreams = streams.filter(stream =>
    stream.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddStream = () => {
    if (!newStream.name || !newStream.inputUrl) {
      toast({ title: "Greška", description: "Popunite sva obavezna polja", variant: "destructive" });
      return;
    }

    const stream: NimbleStream = {
      id: Date.now().toString(),
      name: newStream.name!,
      inputType: newStream.inputType || "rtmp",
      inputUrl: newStream.inputUrl!,
      outputFormats: newStream.outputFormats || ["hls"],
      status: "offline",
      viewers: 0,
      bitrate: newStream.bitrate || "4500 kbps",
      uptime: "0m",
      webvtt: newStream.webvtt || { enabled: false, sourceUrl: "", language: "", label: "", default: false },
      transcoding: newStream.transcoding || [],
      dvr: newStream.dvr || false,
      dvrDuration: newStream.dvrDuration || 3600,
      abr: newStream.abr || false
    };

    setStreams([...streams, stream]);
    setNewStream({
      name: "",
      inputType: "rtmp",
      inputUrl: "",
      outputFormats: ["hls"],
      bitrate: "4500 kbps",
      webvtt: { enabled: false, sourceUrl: "", language: "hr", label: "Hrvatski", default: true },
      transcoding: [],
      dvr: false,
      dvrDuration: 3600,
      abr: false
    });
    setIsAddOpen(false);
    toast({ title: "Uspješno", description: "Stream dodan u Nimble Streamer" });
  };

  const handleUpdateStream = () => {
    if (!editingStream) return;
    
    setStreams(streams.map(s => s.id === editingStream.id ? editingStream : s));
    setEditingStream(null);
    toast({ title: "Ažurirano", description: "Postavke streama spremljene" });
  };

  const toggleStream = (id: string) => {
    setStreams(streams.map(s => {
      if (s.id === id) {
        const newStatus = s.status === "live" ? "offline" : "live";
        return { ...s, status: newStatus, viewers: newStatus === "live" ? Math.floor(Math.random() * 100) : 0 };
      }
      return s;
    }));
    toast({ title: "Status ažuriran", description: "Stream status promijenjen" });
  };

  const deleteStream = (id: string) => {
    setStreams(streams.filter(s => s.id !== id));
    toast({ title: "Obrisano", description: "Stream uklonjen" });
  };

  const totalViewers = streams.reduce((sum, s) => sum + s.viewers, 0);
  const liveStreams = streams.filter(s => s.status === "live").length;
  const webvttEnabled = streams.filter(s => s.webvtt.enabled).length;

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
            </div>
            
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
                    <div className="space-y-2">
                      <Label>Naziv streama</Label>
                      <Input
                        value={newStream.name}
                        onChange={(e) => setNewStream({ ...newStream, name: e.target.value })}
                        placeholder="npr. Sports HD"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Tip ulaza</Label>
                      <Select 
                        value={newStream.inputType} 
                        onValueChange={(v) => setNewStream({ ...newStream, inputType: v as NimbleStream["inputType"] })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rtmp">RTMP</SelectItem>
                          <SelectItem value="rtsp">RTSP</SelectItem>
                          <SelectItem value="srt">SRT (Secure Reliable Transport)</SelectItem>
                          <SelectItem value="hls">HLS Pull</SelectItem>
                          <SelectItem value="udp">UDP/Multicast</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>URL izvora</Label>
                      <Input
                        value={newStream.inputUrl}
                        onChange={(e) => setNewStream({ ...newStream, inputUrl: e.target.value })}
                        placeholder={
                          newStream.inputType === "rtmp" ? "rtmp://server/app/stream" :
                          newStream.inputType === "srt" ? "srt://server:port?streamid=..." :
                          newStream.inputType === "hls" ? "http://server/live.m3u8" :
                          newStream.inputType === "udp" ? "udp://239.0.0.1:5000" :
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
                            variant={newStream.outputFormats?.includes(format as any) ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              const formats = newStream.outputFormats || [];
                              setNewStream({
                                ...newStream,
                                outputFormats: formats.includes(format as any)
                                  ? formats.filter(f => f !== format)
                                  : [...formats, format as any]
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
                        checked={newStream.webvtt?.enabled}
                        onCheckedChange={(checked) => setNewStream({
                          ...newStream,
                          webvtt: { ...newStream.webvtt!, enabled: checked }
                        })}
                      />
                    </div>
                    
                    {newStream.webvtt?.enabled && (
                      <>
                        <div className="space-y-2">
                          <Label>WebVTT URL</Label>
                          <Input
                            value={newStream.webvtt?.sourceUrl}
                            onChange={(e) => setNewStream({
                              ...newStream,
                              webvtt: { ...newStream.webvtt!, sourceUrl: e.target.value }
                            })}
                            placeholder="http://subtitles.server/stream.vtt"
                          />
                          <p className="text-xs text-muted-foreground">
                            URL do .vtt datoteke ili endpoint koji vraća WebVTT format
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Jezik (ISO 639-1)</Label>
                            <Select 
                              value={newStream.webvtt?.language}
                              onValueChange={(v) => setNewStream({
                                ...newStream,
                                webvtt: { ...newStream.webvtt!, language: v }
                              })}
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
                              value={newStream.webvtt?.label}
                              onChange={(e) => setNewStream({
                                ...newStream,
                                webvtt: { ...newStream.webvtt!, label: e.target.value }
                              })}
                              placeholder="Hrvatski titlovi"
                            />
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Zadani titlovi</Label>
                            <p className="text-xs text-muted-foreground">Prikaži titlove automatski</p>
                          </div>
                          <Switch
                            checked={newStream.webvtt?.default}
                            onCheckedChange={(checked) => setNewStream({
                              ...newStream,
                              webvtt: { ...newStream.webvtt!, default: checked }
                            })}
                          />
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
                        checked={newStream.dvr}
                        onCheckedChange={(checked) => setNewStream({ ...newStream, dvr: checked })}
                      />
                    </div>
                    
                    {newStream.dvr && (
                      <div className="space-y-2">
                        <Label>DVR trajanje (sekunde)</Label>
                        <Input
                          type="number"
                          value={newStream.dvrDuration}
                          onChange={(e) => setNewStream({ ...newStream, dvrDuration: parseInt(e.target.value) })}
                        />
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>ABR (Adaptive Bitrate)</Label>
                        <p className="text-xs text-muted-foreground">Automatsko prilagođavanje kvalitete</p>
                      </div>
                      <Switch
                        checked={newStream.abr}
                        onCheckedChange={(checked) => setNewStream({ ...newStream, abr: checked })}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
                
                <Button onClick={handleAddStream} className="w-full mt-4" variant="glow">
                  Dodaj Stream
                </Button>
              </DialogContent>
            </Dialog>
          </div>

          {/* Stats */}
          <div className="mb-6 grid grid-cols-4 gap-4">
            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Tv className="h-4 w-4" />
                <p className="text-sm">Ukupno streamova</p>
              </div>
              <p className="text-2xl font-semibold text-foreground">{streams.length}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Video className="h-4 w-4" />
                <p className="text-sm">Live streamovi</p>
              </div>
              <p className="text-2xl font-semibold text-success">{liveStreams}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Globe className="h-4 w-4" />
                <p className="text-sm">Ukupno gledatelja</p>
              </div>
              <p className="text-2xl font-semibold text-primary">{totalViewers}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Subtitles className="h-4 w-4" />
                <p className="text-sm">S titlovima</p>
              </div>
              <p className="text-2xl font-semibold text-warning">{webvttEnabled}</p>
            </div>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Pretraži streamove..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Streams Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredStreams.map((stream) => {
              const status = statusConfig[stream.status];
              return (
                <div key={stream.id} className="glass rounded-xl p-5 transition-all hover:border-primary/30">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{stream.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${status.bg} ${status.color}`}>
                          <Circle className="h-2 w-2 fill-current" />
                          {status.label}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {inputTypeLabels[stream.inputType]}
                        </Badge>
                        {stream.webvtt.enabled && (
                          <Badge variant="secondary" className="text-xs">
                            <Subtitles className="h-3 w-3 mr-1" />
                            WebVTT
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteStream(stream.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>

                  <div className="mb-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gledatelji</span>
                      <span className="text-foreground">{stream.viewers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bitrate</span>
                      <span className="font-mono text-foreground">{stream.bitrate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Uptime</span>
                      <span className="text-foreground">{stream.uptime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Izlaz</span>
                      <span className="text-foreground">{stream.outputFormats.map(f => f.toUpperCase()).join(", ")}</span>
                    </div>
                    {stream.webvtt.enabled && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Titlovi</span>
                        <span className="text-foreground">{stream.webvtt.label} ({stream.webvtt.language})</span>
                      </div>
                    )}
                  </div>

                  <p className="mb-4 truncate font-mono text-xs text-muted-foreground">{stream.inputUrl}</p>

                  <div className="flex gap-2">
                    <Button
                      variant={stream.status === "live" ? "outline" : "glow"}
                      size="sm"
                      className="flex-1"
                      onClick={() => toggleStream(stream.id)}
                    >
                      {stream.status === "live" ? (
                        <>
                          <Pause className="h-4 w-4" /> Stop
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" /> Start
                        </>
                      )}
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setEditingStream(stream)}>
                          <Settings className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="glass max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Postavke: {stream.name}</DialogTitle>
                        </DialogHeader>
                        {editingStream && editingStream.id === stream.id && (
                          <Tabs defaultValue="basic" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                              <TabsTrigger value="basic">Osnovno</TabsTrigger>
                              <TabsTrigger value="webvtt">WebVTT Titlovi</TabsTrigger>
                              <TabsTrigger value="advanced">Napredno</TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="basic" className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label>Naziv streama</Label>
                                <Input
                                  value={editingStream.name}
                                  onChange={(e) => setEditingStream({ ...editingStream, name: e.target.value })}
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label>Tip ulaza</Label>
                                <Select 
                                  value={editingStream.inputType} 
                                  onValueChange={(v) => setEditingStream({ ...editingStream, inputType: v as NimbleStream["inputType"] })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="rtmp">RTMP</SelectItem>
                                    <SelectItem value="rtsp">RTSP</SelectItem>
                                    <SelectItem value="srt">SRT</SelectItem>
                                    <SelectItem value="hls">HLS Pull</SelectItem>
                                    <SelectItem value="udp">UDP/Multicast</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div className="space-y-2">
                                <Label>URL izvora</Label>
                                <Input
                                  value={editingStream.inputUrl}
                                  onChange={(e) => setEditingStream({ ...editingStream, inputUrl: e.target.value })}
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label>Izlazni formati</Label>
                                <div className="flex flex-wrap gap-2">
                                  {["hls", "dash", "rtmp", "srt"].map((format) => (
                                    <Button
                                      key={format}
                                      type="button"
                                      variant={editingStream.outputFormats.includes(format as any) ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => {
                                        setEditingStream({
                                          ...editingStream,
                                          outputFormats: editingStream.outputFormats.includes(format as any)
                                            ? editingStream.outputFormats.filter(f => f !== format)
                                            : [...editingStream.outputFormats, format as any]
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
                                  checked={editingStream.webvtt.enabled}
                                  onCheckedChange={(checked) => setEditingStream({
                                    ...editingStream,
                                    webvtt: { ...editingStream.webvtt, enabled: checked }
                                  })}
                                />
                              </div>
                              
                              {editingStream.webvtt.enabled && (
                                <>
                                  <div className="space-y-2">
                                    <Label>WebVTT URL</Label>
                                    <Input
                                      value={editingStream.webvtt.sourceUrl}
                                      onChange={(e) => setEditingStream({
                                        ...editingStream,
                                        webvtt: { ...editingStream.webvtt, sourceUrl: e.target.value }
                                      })}
                                    />
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label>Jezik</Label>
                                      <Select 
                                        value={editingStream.webvtt.language}
                                        onValueChange={(v) => setEditingStream({
                                          ...editingStream,
                                          webvtt: { ...editingStream.webvtt, language: v }
                                        })}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="hr">Hrvatski</SelectItem>
                                          <SelectItem value="en">English</SelectItem>
                                          <SelectItem value="de">Deutsch</SelectItem>
                                          <SelectItem value="sr">Srpski</SelectItem>
                                          <SelectItem value="sl">Slovenščina</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <Label>Oznaka</Label>
                                      <Input
                                        value={editingStream.webvtt.label}
                                        onChange={(e) => setEditingStream({
                                          ...editingStream,
                                          webvtt: { ...editingStream.webvtt, label: e.target.value }
                                        })}
                                      />
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center justify-between">
                                    <Label>Zadani titlovi</Label>
                                    <Switch
                                      checked={editingStream.webvtt.default}
                                      onCheckedChange={(checked) => setEditingStream({
                                        ...editingStream,
                                        webvtt: { ...editingStream.webvtt, default: checked }
                                      })}
                                    />
                                  </div>
                                </>
                              )}
                            </TabsContent>
                            
                            <TabsContent value="advanced" className="space-y-4 py-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <Label>DVR (Timeshift)</Label>
                                  <p className="text-xs text-muted-foreground">Omogući vraćanje unatrag</p>
                                </div>
                                <Switch
                                  checked={editingStream.dvr}
                                  onCheckedChange={(checked) => setEditingStream({ ...editingStream, dvr: checked })}
                                />
                              </div>
                              
                              {editingStream.dvr && (
                                <div className="space-y-2">
                                  <Label>DVR trajanje (sekunde)</Label>
                                  <Input
                                    type="number"
                                    value={editingStream.dvrDuration}
                                    onChange={(e) => setEditingStream({ ...editingStream, dvrDuration: parseInt(e.target.value) })}
                                  />
                                </div>
                              )}
                              
                              <div className="flex items-center justify-between">
                                <div>
                                  <Label>ABR</Label>
                                  <p className="text-xs text-muted-foreground">Adaptive Bitrate Streaming</p>
                                </div>
                                <Switch
                                  checked={editingStream.abr}
                                  onCheckedChange={(checked) => setEditingStream({ ...editingStream, abr: checked })}
                                />
                              </div>
                            </TabsContent>
                          </Tabs>
                        )}
                        <Button onClick={handleUpdateStream} className="w-full mt-4" variant="glow">
                          Spremi promjene
                        </Button>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Streams;
