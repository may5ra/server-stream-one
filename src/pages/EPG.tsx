import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Calendar, Tv, RefreshCw, Link2, Trash2, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { hr } from "date-fns/locale";

interface EPGSource {
  id: string;
  name: string;
  url: string;
  last_import: string | null;
  status: string;
}

interface EPGChannel {
  id: string;
  stream_id: string | null;
  epg_channel_id: string;
  name: string;
  icon_url: string | null;
}

interface EPGProgram {
  id: string;
  channel_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
}

export default function EPG() {
  const [sources, setSources] = useState<EPGSource[]>([]);
  const [channels, setChannels] = useState<EPGChannel[]>([]);
  const [programs, setPrograms] = useState<EPGProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const { toast } = useToast();

  const [newSource, setNewSource] = useState({ name: "", url: "" });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedChannel) {
      fetchPrograms(selectedChannel);
    }
  }, [selectedChannel]);

  const fetchData = async () => {
    setLoading(true);
    const [sourcesRes, channelsRes] = await Promise.all([
      supabase.from("epg_sources").select("*").order("created_at"),
      supabase.from("epg_channels").select("*").order("name"),
    ]);

    if (sourcesRes.data) setSources(sourcesRes.data);
    if (channelsRes.data) setChannels(channelsRes.data);
    setLoading(false);
  };

  const fetchPrograms = async (channelId: string) => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data } = await supabase
      .from("epg_programs")
      .select("*")
      .eq("channel_id", channelId)
      .gte("start_time", now.toISOString())
      .lte("start_time", tomorrow.toISOString())
      .order("start_time");

    if (data) setPrograms(data);
  };

  const handleAddSource = async () => {
    if (!newSource.name || !newSource.url) {
      toast({ title: "Greška", description: "Popunite sva polja", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("epg_sources").insert([{
      ...newSource,
      status: "active",
    }]);

    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Uspješno", description: "EPG izvor dodan" });
      setNewSource({ name: "", url: "" });
      setIsAddSourceOpen(false);
      fetchData();
    }
  };

  const handleDeleteSource = async (id: string) => {
    const { error } = await supabase.from("epg_sources").delete().eq("id", id);
    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Obrisano", description: "EPG izvor uklonjen" });
      fetchData();
    }
  };

  const handleImport = async (source: EPGSource) => {
    setImporting(source.id);
    try {
      const { data, error } = await supabase.functions.invoke("epg-import", {
        body: { url: source.url, sourceId: source.id },
      });

      if (error) throw error;

      toast({
        title: "Import završen",
        description: `Učitano ${data.channels_mapped} kanala i ${data.programs_imported} programa`,
      });
      fetchData();
    } catch (error: any) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    } finally {
      setImporting(null);
    }
  };

  const isCurrentProgram = (start: string, end: string) => {
    const now = new Date();
    return new Date(start) <= now && new Date(end) > now;
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">EPG Upravljanje</h1>
                <p className="text-muted-foreground">Elektronski programski vodič</p>
              </div>
              <Dialog open={isAddSourceOpen} onOpenChange={setIsAddSourceOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" />Dodaj EPG izvor</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Novi EPG izvor</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Naziv</Label>
                      <Input 
                        value={newSource.name} 
                        onChange={e => setNewSource({ ...newSource, name: e.target.value })} 
                        placeholder="npr. EPG Croatia"
                      />
                    </div>
                    <div>
                      <Label>XMLTV URL</Label>
                      <Input 
                        value={newSource.url} 
                        onChange={e => setNewSource({ ...newSource, url: e.target.value })} 
                        placeholder="http://example.com/epg.xml"
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Podržani formati: .xml, .xml.gz
                      </p>
                    </div>
                    <Button onClick={handleAddSource} className="w-full">Dodaj izvor</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Link2 className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{sources.length}</p>
                      <p className="text-sm text-muted-foreground">EPG izvori</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Tv className="h-8 w-8 text-blue-500" />
                    <div>
                      <p className="text-2xl font-bold">{channels.length}</p>
                      <p className="text-sm text-muted-foreground">Mapiranih kanala</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-8 w-8 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold">{programs.length}</p>
                      <p className="text-sm text-muted-foreground">Programa danas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* EPG Sources */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">EPG Izvori</h2>
                {sources.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                      <Link2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nema EPG izvora</p>
                      <p className="text-sm">Dodajte XMLTV izvor za učitavanje EPG podataka</p>
                    </CardContent>
                  </Card>
                ) : (
                  sources.map(source => (
                    <Card key={source.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-medium">{source.name}</h3>
                            <p className="text-sm text-muted-foreground truncate max-w-[200px]">{source.url}</p>
                            {source.last_import && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                Zadnji import: {format(new Date(source.last_import), "dd.MM.yyyy HH:mm", { locale: hr })}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleImport(source)}
                              disabled={importing === source.id}
                            >
                              <RefreshCw className={`h-4 w-4 ${importing === source.id ? "animate-spin" : ""}`} />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteSource(source.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {/* Channels */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Kanali ({channels.length})</h2>
                <div className="max-h-[600px] overflow-y-auto space-y-2">
                  {channels.map(channel => (
                    <Card 
                      key={channel.id}
                      className={`cursor-pointer transition-colors ${selectedChannel === channel.id ? "ring-2 ring-primary" : ""}`}
                      onClick={() => setSelectedChannel(channel.id)}
                    >
                      <CardContent className="p-3 flex items-center gap-3">
                        {channel.icon_url ? (
                          <img src={channel.icon_url} alt="" className="w-8 h-8 rounded object-contain bg-muted" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                            <Tv className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{channel.name}</p>
                          <p className="text-xs text-muted-foreground">{channel.epg_channel_id}</p>
                        </div>
                        {channel.stream_id && (
                          <Badge variant="outline" className="shrink-0">
                            <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                            Mapirano
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Programs */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">
                  Program {selectedChannel ? `- ${channels.find(c => c.id === selectedChannel)?.name}` : ""}
                </h2>
                {!selectedChannel ? (
                  <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                      <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Odaberite kanal za prikaz programa</p>
                    </CardContent>
                  </Card>
                ) : programs.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                      <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nema programa za ovaj kanal</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="max-h-[600px] overflow-y-auto space-y-2">
                    {programs.map(program => {
                      const isCurrent = isCurrentProgram(program.start_time, program.end_time);
                      return (
                        <Card key={program.id} className={isCurrent ? "ring-2 ring-primary bg-primary/5" : ""}>
                          <CardContent className="p-3">
                            <div className="flex items-start gap-3">
                              <div className="text-center min-w-[60px]">
                                <p className="text-sm font-medium">
                                  {format(new Date(program.start_time), "HH:mm")}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(program.end_time), "HH:mm")}
                                </p>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{program.title}</p>
                                  {isCurrent && (
                                    <Badge variant="default" className="text-xs">SADA</Badge>
                                  )}
                                </div>
                                {program.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                    {program.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
