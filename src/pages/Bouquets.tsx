import { useState, useEffect } from "react";
import { GripVertical, Plus, Trash2, RefreshCw, Tv, Film, PlaySquare, Save, ChevronDown, ChevronRight } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Category {
  id: string;
  name: string;
  sort_order: number;
  type: "live" | "vod" | "series";
}

const Bouquets = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({
    live: true,
    vod: true,
    series: true,
  });
  const [newCategory, setNewCategory] = useState({ name: "", type: "live" as "live" | "vod" | "series" });
  const [draggedItem, setDraggedItem] = useState<Category | null>(null);
  const { toast } = useToast();

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const [liveRes, vodRes, seriesRes] = await Promise.all([
        supabase.from("live_categories").select("*").order("sort_order"),
        supabase.from("vod_categories").select("*").order("sort_order"),
        supabase.from("series_categories").select("*").order("sort_order"),
      ]);

      const allCategories: Category[] = [
        ...(liveRes.data || []).map((c) => ({ ...c, type: "live" as const })),
        ...(vodRes.data || []).map((c) => ({ ...c, type: "vod" as const })),
        ...(seriesRes.data || []).map((c) => ({ ...c, type: "series" as const })),
      ];

      setCategories(allCategories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast({ title: "Greška", description: "Nije moguće učitati kategorije", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) {
      toast({ title: "Greška", description: "Unesite naziv kategorije", variant: "destructive" });
      return;
    }

    try {
      const table = newCategory.type === "live" ? "live_categories" : 
                    newCategory.type === "vod" ? "vod_categories" : "series_categories";
      
      const maxOrder = categories.filter(c => c.type === newCategory.type).length;
      
      const { error } = await supabase.from(table).insert({
        name: newCategory.name.trim(),
        sort_order: maxOrder,
      });

      if (error) throw error;

      toast({ title: "Uspješno", description: "Kategorija dodana" });
      setNewCategory({ name: "", type: "live" });
      setIsAddOpen(false);
      fetchCategories();
    } catch (error: any) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    if (!confirm(`Jeste li sigurni da želite obrisati "${category.name}"?`)) return;

    try {
      const table = category.type === "live" ? "live_categories" : 
                    category.type === "vod" ? "vod_categories" : "series_categories";
      
      const { error } = await supabase.from(table).delete().eq("id", category.id);
      if (error) throw error;

      toast({ title: "Obrisano", description: "Kategorija obrisana" });
      fetchCategories();
    } catch (error: any) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    }
  };

  const handleDragStart = (e: React.DragEvent, category: Category) => {
    setDraggedItem(category);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, targetCategory: Category) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.id === targetCategory.id || draggedItem.type !== targetCategory.type) return;
    
    setCategories(prev => {
      const newList = [...prev];
      const typeCategories = newList.filter(c => c.type === draggedItem.type);
      const otherCategories = newList.filter(c => c.type !== draggedItem.type);
      
      const dragIndex = typeCategories.findIndex(c => c.id === draggedItem.id);
      const dropIndex = typeCategories.findIndex(c => c.id === targetCategory.id);
      
      if (dragIndex === -1 || dropIndex === -1) return prev;
      
      const [removed] = typeCategories.splice(dragIndex, 1);
      typeCategories.splice(dropIndex, 0, removed);
      
      // Update sort orders
      typeCategories.forEach((cat, index) => {
        cat.sort_order = index;
      });
      
      return [...otherCategories, ...typeCategories];
    });
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const handleSaveOrder = async () => {
    setSaving(true);
    try {
      const updates = {
        live: categories.filter(c => c.type === "live").map((c, i) => ({ id: c.id, sort_order: i })),
        vod: categories.filter(c => c.type === "vod").map((c, i) => ({ id: c.id, sort_order: i })),
        series: categories.filter(c => c.type === "series").map((c, i) => ({ id: c.id, sort_order: i })),
      };

      const promises = [];
      
      for (const item of updates.live) {
        promises.push(supabase.from("live_categories").update({ sort_order: item.sort_order }).eq("id", item.id));
      }
      for (const item of updates.vod) {
        promises.push(supabase.from("vod_categories").update({ sort_order: item.sort_order }).eq("id", item.id));
      }
      for (const item of updates.series) {
        promises.push(supabase.from("series_categories").update({ sort_order: item.sort_order }).eq("id", item.id));
      }

      await Promise.all(promises);
      toast({ title: "Spremljeno", description: "Redoslijed kategorija ažuriran" });
    } catch (error: any) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleType = (type: string) => {
    setExpandedTypes(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const typeConfig = {
    live: { icon: Tv, label: "Live TV", color: "text-primary" },
    vod: { icon: Film, label: "Filmovi (VOD)", color: "text-accent" },
    series: { icon: PlaySquare, label: "Serije", color: "text-success" },
  };

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
              <h2 className="text-2xl font-semibold text-foreground">Bouquets / Kategorije</h2>
              <p className="text-muted-foreground">Sortiraj kategorije povlačenjem</p>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSaveOrder} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Spremam..." : "Spremi redoslijed"}
              </Button>
              
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button variant="glow">
                    <Plus className="h-4 w-4" />
                    Dodaj kategoriju
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass">
                  <DialogHeader>
                    <DialogTitle>Nova kategorija</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Naziv</Label>
                      <Input
                        value={newCategory.name}
                        onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                        placeholder="npr. Sport, Filmovi HD..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tip</Label>
                      <Select 
                        value={newCategory.type} 
                        onValueChange={(v) => setNewCategory({ ...newCategory, type: v as any })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="live">📺 Live TV</SelectItem>
                          <SelectItem value="vod">🎬 Filmovi (VOD)</SelectItem>
                          <SelectItem value="series">📺 Serije</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleAddCategory} className="w-full" variant="glow">
                      Dodaj
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="space-y-6">
            {(["live", "vod", "series"] as const).map((type) => {
              const config = typeConfig[type];
              const Icon = config.icon;
              const typeCategories = categories
                .filter(c => c.type === type)
                .sort((a, b) => a.sort_order - b.sort_order);
              
              return (
                <div key={type} className="glass rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleType(type)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-5 w-5 ${config.color}`} />
                      <span className="font-semibold text-foreground">{config.label}</span>
                      <Badge variant="secondary">{typeCategories.length}</Badge>
                    </div>
                    {expandedTypes[type] ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                  
                  {expandedTypes[type] && (
                    <div className="border-t border-border">
                      {typeCategories.length === 0 ? (
                        <p className="p-4 text-sm text-muted-foreground text-center">
                          Nema kategorija. Dodaj prvu!
                        </p>
                      ) : (
                        <div className="divide-y divide-border">
                          {typeCategories.map((category, index) => (
                            <div
                              key={category.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, category)}
                              onDragOver={(e) => handleDragOver(e, category)}
                              onDragEnd={handleDragEnd}
                              className={`flex items-center justify-between p-3 hover:bg-muted/30 transition-colors cursor-move ${
                                draggedItem?.id === category.id ? "opacity-50 bg-primary/10" : ""
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium text-muted-foreground w-6">
                                  {index + 1}.
                                </span>
                                <span className="text-foreground">{category.name}</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDeleteCategory(category)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Bouquets;
