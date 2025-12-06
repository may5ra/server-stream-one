import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Tv2, Folder, Search, Trash2, Edit, Star, PlayCircle, ChevronRight } from "lucide-react";

interface SeriesCategory {
  id: string;
  name: string;
  sort_order: number;
}

interface Series {
  id: string;
  category_id: string | null;
  name: string;
  cover_url: string | null;
  plot: string | null;
  cast_names: string | null;
  director: string | null;
  genre: string | null;
  release_date: string | null;
  rating: number | null;
  status: string;
}

interface Episode {
  id: string;
  series_id: string;
  season_number: number;
  episode_number: number;
  title: string | null;
  plot: string | null;
  duration: number | null;
  stream_url: string;
  cover_url: string | null;
  container_extension: string;
}

export default function SeriesPage() {
  const [categories, setCategories] = useState<SeriesCategory[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isEpisodeDialogOpen, setIsEpisodeDialogOpen] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);
  const { toast } = useToast();

  const [newCategory, setNewCategory] = useState({ name: "", sort_order: 0 });
  const [newSeries, setNewSeries] = useState({
    name: "", category_id: "", cover_url: "", plot: "", cast_names: "",
    director: "", genre: "", release_date: "", rating: 0,
  });
  const [newEpisode, setNewEpisode] = useState({
    season_number: 1, episode_number: 1, title: "", plot: "",
    duration: 0, stream_url: "", cover_url: "", container_extension: "mp4",
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedSeries) {
      fetchEpisodes(selectedSeries.id);
    }
  }, [selectedSeries]);

  const fetchData = async () => {
    setLoading(true);
    const [catRes, seriesRes] = await Promise.all([
      supabase.from("series_categories").select("*").order("sort_order"),
      supabase.from("series").select("*").order("created_at", { ascending: false }),
    ]);

    if (catRes.data) setCategories(catRes.data);
    if (seriesRes.data) setSeriesList(seriesRes.data);
    setLoading(false);
  };

  const fetchEpisodes = async (seriesId: string) => {
    const { data } = await supabase
      .from("series_episodes")
      .select("*")
      .eq("series_id", seriesId)
      .order("season_number")
      .order("episode_number");
    if (data) setEpisodes(data);
  };

  const handleAddCategory = async () => {
    const { error } = await supabase.from("series_categories").insert([newCategory]);
    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Uspješno", description: "Kategorija dodana" });
      setNewCategory({ name: "", sort_order: 0 });
      setIsCategoryDialogOpen(false);
      fetchData();
    }
  };

  const handleAddSeries = async () => {
    const { error } = await supabase.from("series").insert([{
      ...newSeries,
      category_id: newSeries.category_id || null,
      status: "active",
    }]);
    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Uspješno", description: "Serija dodana" });
      setNewSeries({
        name: "", category_id: "", cover_url: "", plot: "",
        cast_names: "", director: "", genre: "", release_date: "", rating: 0,
      });
      setIsAddDialogOpen(false);
      fetchData();
    }
  };

  const handleAddEpisode = async () => {
    if (!selectedSeries) return;
    const { error } = await supabase.from("series_episodes").insert([{
      ...newEpisode,
      series_id: selectedSeries.id,
    }]);
    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Uspješno", description: "Epizoda dodana" });
      setNewEpisode({
        season_number: 1, episode_number: 1, title: "", plot: "",
        duration: 0, stream_url: "", cover_url: "", container_extension: "mp4",
      });
      setIsEpisodeDialogOpen(false);
      fetchEpisodes(selectedSeries.id);
    }
  };

  const handleDeleteSeries = async (id: string) => {
    const { error } = await supabase.from("series").delete().eq("id", id);
    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Obrisano", description: "Serija uklonjena" });
      if (selectedSeries?.id === id) setSelectedSeries(null);
      fetchData();
    }
  };

  const handleDeleteEpisode = async (id: string) => {
    const { error } = await supabase.from("series_episodes").delete().eq("id", id);
    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Obrisano", description: "Epizoda uklonjena" });
      if (selectedSeries) fetchEpisodes(selectedSeries.id);
    }
  };

  const filteredSeries = seriesList.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "all" || s.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedEpisodes = episodes.reduce((acc, ep) => {
    const season = ep.season_number;
    if (!acc[season]) acc[season] = [];
    acc[season].push(ep);
    return acc;
  }, {} as Record<number, Episode[]>);

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
                <h1 className="text-3xl font-bold">TV Serije</h1>
                <p className="text-muted-foreground">Upravljanje serijama i epizodama</p>
              </div>
              <div className="flex gap-2">
                <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline"><Folder className="mr-2 h-4 w-4" />Nova kategorija</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nova kategorija serija</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Naziv</Label>
                        <Input value={newCategory.name} onChange={e => setNewCategory({ ...newCategory, name: e.target.value })} />
                      </div>
                      <div>
                        <Label>Redoslijed</Label>
                        <Input type="number" value={newCategory.sort_order} onChange={e => setNewCategory({ ...newCategory, sort_order: parseInt(e.target.value) })} />
                      </div>
                      <Button onClick={handleAddCategory} className="w-full">Dodaj kategoriju</Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button><Plus className="mr-2 h-4 w-4" />Dodaj seriju</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Nova serija</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Label>Naziv *</Label>
                        <Input value={newSeries.name} onChange={e => setNewSeries({ ...newSeries, name: e.target.value })} />
                      </div>
                      <div>
                        <Label>Kategorija</Label>
                        <Select value={newSeries.category_id} onValueChange={v => setNewSeries({ ...newSeries, category_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Odaberi..." /></SelectTrigger>
                          <SelectContent>
                            {categories.map(cat => (
                              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Ocjena (0-10)</Label>
                        <Input type="number" step="0.1" value={newSeries.rating} onChange={e => setNewSeries({ ...newSeries, rating: parseFloat(e.target.value) })} />
                      </div>
                      <div className="col-span-2">
                        <Label>Cover URL</Label>
                        <Input value={newSeries.cover_url} onChange={e => setNewSeries({ ...newSeries, cover_url: e.target.value })} />
                      </div>
                      <div>
                        <Label>Žanr</Label>
                        <Input value={newSeries.genre} onChange={e => setNewSeries({ ...newSeries, genre: e.target.value })} />
                      </div>
                      <div>
                        <Label>Godina</Label>
                        <Input value={newSeries.release_date} onChange={e => setNewSeries({ ...newSeries, release_date: e.target.value })} placeholder="2024" />
                      </div>
                      <div className="col-span-2">
                        <Label>Opis</Label>
                        <Textarea value={newSeries.plot} onChange={e => setNewSeries({ ...newSeries, plot: e.target.value })} />
                      </div>
                      <div className="col-span-2">
                        <Button onClick={handleAddSeries} className="w-full">Dodaj seriju</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Tv2 className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{seriesList.length}</p>
                      <p className="text-sm text-muted-foreground">Ukupno serija</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Folder className="h-8 w-8 text-blue-500" />
                    <div>
                      <p className="text-2xl font-bold">{categories.length}</p>
                      <p className="text-sm text-muted-foreground">Kategorija</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <PlayCircle className="h-8 w-8 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold">{episodes.length}</p>
                      <p className="text-sm text-muted-foreground">Epizoda (odabrana)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Series List */}
              <div className="lg:col-span-1 space-y-4">
                {/* Filters */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Pretraži..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
                  </div>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger><SelectValue placeholder="Sve kategorije" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Sve kategorije</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Series Cards */}
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filteredSeries.map(series => (
                    <Card 
                      key={series.id}
                      className={`cursor-pointer transition-colors ${selectedSeries?.id === series.id ? "ring-2 ring-primary" : ""}`}
                      onClick={() => setSelectedSeries(series)}
                    >
                      <CardContent className="p-3 flex gap-3">
                        <div className="w-16 h-24 bg-muted rounded overflow-hidden flex-shrink-0">
                          {series.cover_url ? (
                            <img src={series.cover_url} alt={series.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Tv2 className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{series.name}</h3>
                          {series.genre && <p className="text-sm text-muted-foreground">{series.genre}</p>}
                          <div className="flex items-center gap-2 mt-1">
                            {series.rating && (
                              <Badge variant="secondary" className="text-xs">
                                <Star className="h-3 w-3 mr-1 text-yellow-500" />{series.rating}
                              </Badge>
                            )}
                            {series.release_date && (
                              <span className="text-xs text-muted-foreground">{series.release_date}</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground self-center" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Episodes */}
              <div className="lg:col-span-2">
                {!selectedSeries ? (
                  <Card>
                    <CardContent className="p-12 text-center text-muted-foreground">
                      <Tv2 className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg">Odaberite seriju za prikaz epizoda</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {/* Series Header */}
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h2 className="text-xl font-bold">{selectedSeries.name}</h2>
                            {selectedSeries.plot && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{selectedSeries.plot}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Dialog open={isEpisodeDialogOpen} onOpenChange={setIsEpisodeDialogOpen}>
                              <DialogTrigger asChild>
                                <Button size="sm"><Plus className="mr-2 h-4 w-4" />Epizoda</Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Nova epizoda</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label>Sezona</Label>
                                      <Input type="number" value={newEpisode.season_number} onChange={e => setNewEpisode({ ...newEpisode, season_number: parseInt(e.target.value) })} />
                                    </div>
                                    <div>
                                      <Label>Epizoda</Label>
                                      <Input type="number" value={newEpisode.episode_number} onChange={e => setNewEpisode({ ...newEpisode, episode_number: parseInt(e.target.value) })} />
                                    </div>
                                  </div>
                                  <div>
                                    <Label>Naslov</Label>
                                    <Input value={newEpisode.title} onChange={e => setNewEpisode({ ...newEpisode, title: e.target.value })} />
                                  </div>
                                  <div>
                                    <Label>Stream URL *</Label>
                                    <Input value={newEpisode.stream_url} onChange={e => setNewEpisode({ ...newEpisode, stream_url: e.target.value })} placeholder="http://..." />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label>Trajanje (min)</Label>
                                      <Input type="number" value={newEpisode.duration} onChange={e => setNewEpisode({ ...newEpisode, duration: parseInt(e.target.value) })} />
                                    </div>
                                    <div>
                                      <Label>Format</Label>
                                      <Select value={newEpisode.container_extension} onValueChange={v => setNewEpisode({ ...newEpisode, container_extension: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="mp4">MP4</SelectItem>
                                          <SelectItem value="mkv">MKV</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <Button onClick={handleAddEpisode} className="w-full">Dodaj epizodu</Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteSeries(selectedSeries.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Seasons & Episodes */}
                    {Object.entries(groupedEpisodes).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([season, eps]) => (
                      <Card key={season}>
                        <CardHeader className="py-3">
                          <CardTitle className="text-base">Sezona {season}</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-2">
                            {eps.map(ep => (
                              <div key={ep.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline">E{ep.episode_number}</Badge>
                                  <span className="font-medium">{ep.title || `Epizoda ${ep.episode_number}`}</span>
                                  {ep.duration && (
                                    <span className="text-sm text-muted-foreground">{ep.duration} min</span>
                                  )}
                                </div>
                                <Button size="sm" variant="ghost" onClick={() => handleDeleteEpisode(ep.id)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {Object.keys(groupedEpisodes).length === 0 && (
                      <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                          <PlayCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>Nema epizoda</p>
                          <p className="text-sm">Dodajte prvu epizodu za ovu seriju</p>
                        </CardContent>
                      </Card>
                    )}
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
