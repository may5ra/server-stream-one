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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Film, Folder, Search, Trash2, Edit, Star, Clock, Eye } from "lucide-react";

interface VODCategory {
  id: string;
  name: string;
  sort_order: number;
}

interface VODContent {
  id: string;
  category_id: string | null;
  name: string;
  stream_url: string;
  cover_url: string | null;
  plot: string | null;
  cast_names: string | null;
  director: string | null;
  genre: string | null;
  release_date: string | null;
  duration: number | null;
  rating: number | null;
  tmdb_id: number | null;
  container_extension: string;
  status: string;
}

export default function VOD() {
  const [categories, setCategories] = useState<VODCategory[]>([]);
  const [content, setContent] = useState<VODContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingContent, setEditingContent] = useState<VODContent | null>(null);
  const { toast } = useToast();

  const [newCategory, setNewCategory] = useState({ name: "", sort_order: 0 });
  const [newContent, setNewContent] = useState({
    name: "",
    stream_url: "",
    category_id: "",
    cover_url: "",
    plot: "",
    cast_names: "",
    director: "",
    genre: "",
    release_date: "",
    duration: 0,
    rating: 0,
    container_extension: "mp4",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [catRes, contentRes] = await Promise.all([
      supabase.from("vod_categories").select("*").order("sort_order"),
      supabase.from("vod_content").select("*").order("created_at", { ascending: false }),
    ]);

    if (catRes.data) setCategories(catRes.data);
    if (contentRes.data) setContent(contentRes.data);
    setLoading(false);
  };

  const handleAddCategory = async () => {
    const { error } = await supabase.from("vod_categories").insert([newCategory]);
    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Uspješno", description: "Kategorija dodana" });
      setNewCategory({ name: "", sort_order: 0 });
      setIsCategoryDialogOpen(false);
      fetchData();
    }
  };

  const handleAddContent = async () => {
    const { error } = await supabase.from("vod_content").insert([{
      ...newContent,
      category_id: newContent.category_id || null,
      status: "active",
    }]);
    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Uspješno", description: "Film dodan" });
      setNewContent({
        name: "", stream_url: "", category_id: "", cover_url: "", plot: "",
        cast_names: "", director: "", genre: "", release_date: "", duration: 0, rating: 0, container_extension: "mp4",
      });
      setIsAddDialogOpen(false);
      fetchData();
    }
  };

  const handleUpdateContent = async () => {
    if (!editingContent) return;
    const { error } = await supabase.from("vod_content").update(editingContent).eq("id", editingContent.id);
    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Uspješno", description: "Film ažuriran" });
      setEditingContent(null);
      fetchData();
    }
  };

  const handleDeleteContent = async (id: string) => {
    const { error } = await supabase.from("vod_content").delete().eq("id", id);
    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Obrisano", description: "Film uklonjen" });
      fetchData();
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const { error } = await supabase.from("vod_categories").delete().eq("id", id);
    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Obrisano", description: "Kategorija uklonjena" });
      fetchData();
    }
  };

  const filteredContent = content.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "all" || c.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryName = (catId: string | null) => {
    if (!catId) return "Bez kategorije";
    return categories.find(c => c.id === catId)?.name || "Nepoznato";
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
                <h1 className="text-3xl font-bold">VOD Upravljanje</h1>
                <p className="text-muted-foreground">Filmovi i video sadržaj na zahtjev</p>
              </div>
              <div className="flex gap-2">
                <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline"><Folder className="mr-2 h-4 w-4" />Nova kategorija</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nova VOD kategorija</DialogTitle>
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
                    <Button><Plus className="mr-2 h-4 w-4" />Dodaj film</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Novi film</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Label>Naziv *</Label>
                        <Input value={newContent.name} onChange={e => setNewContent({ ...newContent, name: e.target.value })} />
                      </div>
                      <div className="col-span-2">
                        <Label>Stream URL *</Label>
                        <Input value={newContent.stream_url} onChange={e => setNewContent({ ...newContent, stream_url: e.target.value })} placeholder="http://..." />
                      </div>
                      <div>
                        <Label>Kategorija</Label>
                        <Select value={newContent.category_id} onValueChange={v => setNewContent({ ...newContent, category_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Odaberi..." /></SelectTrigger>
                          <SelectContent>
                            {categories.map(cat => (
                              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Format</Label>
                        <Select value={newContent.container_extension} onValueChange={v => setNewContent({ ...newContent, container_extension: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mp4">MP4</SelectItem>
                            <SelectItem value="mkv">MKV</SelectItem>
                            <SelectItem value="avi">AVI</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label>Cover URL</Label>
                        <Input value={newContent.cover_url} onChange={e => setNewContent({ ...newContent, cover_url: e.target.value })} />
                      </div>
                      <div>
                        <Label>Trajanje (min)</Label>
                        <Input type="number" value={newContent.duration} onChange={e => setNewContent({ ...newContent, duration: parseInt(e.target.value) })} />
                      </div>
                      <div>
                        <Label>Ocjena (0-10)</Label>
                        <Input type="number" step="0.1" value={newContent.rating} onChange={e => setNewContent({ ...newContent, rating: parseFloat(e.target.value) })} />
                      </div>
                      <div>
                        <Label>Žanr</Label>
                        <Input value={newContent.genre} onChange={e => setNewContent({ ...newContent, genre: e.target.value })} />
                      </div>
                      <div>
                        <Label>Godina</Label>
                        <Input value={newContent.release_date} onChange={e => setNewContent({ ...newContent, release_date: e.target.value })} placeholder="2024" />
                      </div>
                      <div>
                        <Label>Redatelj</Label>
                        <Input value={newContent.director} onChange={e => setNewContent({ ...newContent, director: e.target.value })} />
                      </div>
                      <div>
                        <Label>Glumci</Label>
                        <Input value={newContent.cast_names} onChange={e => setNewContent({ ...newContent, cast_names: e.target.value })} />
                      </div>
                      <div className="col-span-2">
                        <Label>Opis</Label>
                        <Textarea value={newContent.plot} onChange={e => setNewContent({ ...newContent, plot: e.target.value })} />
                      </div>
                      <div className="col-span-2">
                        <Button onClick={handleAddContent} className="w-full">Dodaj film</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Film className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{content.length}</p>
                      <p className="text-sm text-muted-foreground">Ukupno filmova</p>
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
                    <Eye className="h-8 w-8 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold">{content.filter(c => c.status === "active").length}</p>
                      <p className="text-sm text-muted-foreground">Aktivno</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Star className="h-8 w-8 text-yellow-500" />
                    <div>
                      <p className="text-2xl font-bold">
                        {content.length > 0 ? (content.reduce((acc, c) => acc + (c.rating || 0), 0) / content.length).toFixed(1) : "0"}
                      </p>
                      <p className="text-sm text-muted-foreground">Prosječna ocjena</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="content">
              <TabsList>
                <TabsTrigger value="content">Filmovi</TabsTrigger>
                <TabsTrigger value="categories">Kategorije</TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="space-y-4">
                {/* Filters */}
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Pretraži filmove..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
                  </div>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[200px]"><SelectValue placeholder="Sve kategorije" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Sve kategorije</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredContent.map(item => (
                    <Card key={item.id} className="overflow-hidden group">
                      <div className="aspect-[2/3] relative bg-muted">
                        {item.cover_url ? (
                          <img src={item.cover_url} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film className="h-12 w-12 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button size="sm" variant="secondary" onClick={() => setEditingContent(item)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteContent(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {item.rating && (
                          <Badge className="absolute top-2 right-2 bg-yellow-500">
                            <Star className="h-3 w-3 mr-1" />{item.rating}
                          </Badge>
                        )}
                      </div>
                      <CardContent className="p-3">
                        <h3 className="font-semibold truncate">{item.name}</h3>
                        <div className="flex items-center justify-between text-sm text-muted-foreground mt-1">
                          <span>{getCategoryName(item.category_id)}</span>
                          {item.duration && (
                            <span className="flex items-center"><Clock className="h-3 w-3 mr-1" />{item.duration}min</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="categories">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categories.map(cat => (
                    <Card key={cat.id}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Folder className="h-6 w-6 text-primary" />
                          <div>
                            <p className="font-medium">{cat.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {content.filter(c => c.category_id === cat.id).length} filmova
                            </p>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteCategory(cat.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingContent} onOpenChange={() => setEditingContent(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Uredi film</DialogTitle>
          </DialogHeader>
          {editingContent && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Naziv</Label>
                <Input value={editingContent.name} onChange={e => setEditingContent({ ...editingContent, name: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Stream URL</Label>
                <Input value={editingContent.stream_url} onChange={e => setEditingContent({ ...editingContent, stream_url: e.target.value })} />
              </div>
              <div>
                <Label>Kategorija</Label>
                <Select value={editingContent.category_id || ""} onValueChange={v => setEditingContent({ ...editingContent, category_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editingContent.status} onValueChange={v => setEditingContent({ ...editingContent, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktivan</SelectItem>
                    <SelectItem value="inactive">Neaktivan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Button onClick={handleUpdateContent} className="w-full">Spremi promjene</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
