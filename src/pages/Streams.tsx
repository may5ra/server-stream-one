import { useState } from "react";
import { Plus, Search, Play, Pause, Trash2, Circle, Settings, ExternalLink } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface Stream {
  id: string;
  name: string;
  source: string;
  status: "active" | "stopped" | "error";
  viewers: number;
  bitrate: string;
  uptime: string;
}

const initialStreams: Stream[] = [
  { id: "1", name: "Sports Channel HD", source: "rtmp://source1.example.com/live", status: "active", viewers: 145, bitrate: "4500 kbps", uptime: "5h 32m" },
  { id: "2", name: "News 24/7", source: "http://news.stream/hls/live.m3u8", status: "active", viewers: 89, bitrate: "2500 kbps", uptime: "12h 15m" },
  { id: "3", name: "Movies Premium", source: "rtmp://movies.server/stream", status: "stopped", viewers: 0, bitrate: "6000 kbps", uptime: "0m" },
  { id: "4", name: "Music Channel", source: "http://music.live/stream.m3u8", status: "active", viewers: 67, bitrate: "1500 kbps", uptime: "3h 45m" },
  { id: "5", name: "Documentary HD", source: "rtmp://docs.stream/live", status: "error", viewers: 0, bitrate: "4000 kbps", uptime: "0m" },
];

const statusConfig = {
  active: { color: "text-success", bg: "bg-success/20", label: "Active" },
  stopped: { color: "text-muted-foreground", bg: "bg-muted", label: "Stopped" },
  error: { color: "text-destructive", bg: "bg-destructive/20", label: "Error" },
};

const Streams = () => {
  const [streams, setStreams] = useState<Stream[]>(initialStreams);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { toast } = useToast();

  const [newStream, setNewStream] = useState({
    name: "",
    source: "",
    bitrate: "4500",
  });

  const filteredStreams = streams.filter(stream =>
    stream.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddStream = () => {
    if (!newStream.name || !newStream.source) {
      toast({ title: "Error", description: "Please fill all fields", variant: "destructive" });
      return;
    }

    const stream: Stream = {
      id: Date.now().toString(),
      name: newStream.name,
      source: newStream.source,
      status: "stopped",
      viewers: 0,
      bitrate: `${newStream.bitrate} kbps`,
      uptime: "0m",
    };

    setStreams([...streams, stream]);
    setNewStream({ name: "", source: "", bitrate: "4500" });
    setIsAddOpen(false);
    toast({ title: "Success", description: "Stream added successfully" });
  };

  const toggleStream = (id: string) => {
    setStreams(streams.map(s => {
      if (s.id === id) {
        const newStatus = s.status === "active" ? "stopped" : "active";
        return { ...s, status: newStatus, viewers: newStatus === "active" ? Math.floor(Math.random() * 100) : 0 };
      }
      return s;
    }));
    toast({ title: "Stream Updated", description: "Stream status changed" });
  };

  const deleteStream = (id: string) => {
    setStreams(streams.filter(s => s.id !== id));
    toast({ title: "Deleted", description: "Stream removed" });
  };

  const totalViewers = streams.reduce((sum, s) => sum + s.viewers, 0);
  const activeStreams = streams.filter(s => s.status === "active").length;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <div className="ml-64">
        <Header />
        
        <main className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Streams</h2>
              <p className="text-muted-foreground">Manage live streams and channels</p>
            </div>
            
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button variant="glow">
                  <Plus className="h-4 w-4" />
                  Add Stream
                </Button>
              </DialogTrigger>
              <DialogContent className="glass">
                <DialogHeader>
                  <DialogTitle>Add New Stream</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Stream Name</Label>
                    <Input
                      value={newStream.name}
                      onChange={(e) => setNewStream({ ...newStream, name: e.target.value })}
                      placeholder="e.g., Sports HD"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Source URL</Label>
                    <Input
                      value={newStream.source}
                      onChange={(e) => setNewStream({ ...newStream, source: e.target.value })}
                      placeholder="rtmp:// or http://"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bitrate (kbps)</Label>
                    <Input
                      type="number"
                      value={newStream.bitrate}
                      onChange={(e) => setNewStream({ ...newStream, bitrate: e.target.value })}
                    />
                  </div>
                  <Button onClick={handleAddStream} className="w-full" variant="glow">
                    Add Stream
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Stats */}
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="glass rounded-xl p-4">
              <p className="text-sm text-muted-foreground">Total Streams</p>
              <p className="text-2xl font-semibold text-foreground">{streams.length}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-sm text-muted-foreground">Active Streams</p>
              <p className="text-2xl font-semibold text-success">{activeStreams}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-sm text-muted-foreground">Total Viewers</p>
              <p className="text-2xl font-semibold text-primary">{totalViewers}</p>
            </div>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search streams..."
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
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${status.bg} ${status.color}`}>
                        <Circle className="h-2 w-2 fill-current" />
                        {status.label}
                      </span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteStream(stream.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>

                  <div className="mb-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Viewers</span>
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
                  </div>

                  <p className="mb-4 truncate font-mono text-xs text-muted-foreground">{stream.source}</p>

                  <div className="flex gap-2">
                    <Button
                      variant={stream.status === "active" ? "outline" : "glow"}
                      size="sm"
                      className="flex-1"
                      onClick={() => toggleStream(stream.id)}
                    >
                      {stream.status === "active" ? (
                        <>
                          <Pause className="h-4 w-4" /> Stop
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" /> Start
                        </>
                      )}
                    </Button>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
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
