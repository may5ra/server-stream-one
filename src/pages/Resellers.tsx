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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Users, CreditCard, TrendingUp, Trash2, Edit, DollarSign, UserPlus, History } from "lucide-react";
import { format } from "date-fns";
import { hr } from "date-fns/locale";

interface Reseller {
  id: string;
  user_id: string;
  username: string;
  password: string;
  credits: number;
  max_connections: number;
  notes: string | null;
  status: string;
  created_at: string;
}

interface CreditHistory {
  id: string;
  reseller_id: string;
  amount: number;
  type: string;
  notes: string | null;
  created_at: string;
}

export default function Resellers() {
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [creditHistory, setCreditHistory] = useState<CreditHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCreditsDialogOpen, setIsCreditsDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [editingReseller, setEditingReseller] = useState<Reseller | null>(null);
  const [selectedReseller, setSelectedReseller] = useState<Reseller | null>(null);
  const { toast } = useToast();

  const [newReseller, setNewReseller] = useState({
    username: "",
    password: "",
    credits: 0,
    max_connections: 100,
    notes: "",
  });

  const [creditAction, setCreditAction] = useState({
    amount: 0,
    type: "add",
    notes: "",
  });

  useEffect(() => {
    fetchResellers();
  }, []);

  const fetchResellers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("resellers")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setResellers(data);
    setLoading(false);
  };

  const fetchCreditHistory = async (resellerId: string) => {
    const { data } = await supabase
      .from("reseller_credits")
      .select("*")
      .eq("reseller_id", resellerId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) setCreditHistory(data);
  };

  const handleAddReseller = async () => {
    if (!newReseller.username || !newReseller.password) {
      toast({ title: "Greška", description: "Popunite obavezna polja", variant: "destructive" });
      return;
    }

    // Generate a UUID for user_id (since this is a reseller-only account)
    const userId = crypto.randomUUID();

    const { error } = await supabase.from("resellers").insert([{
      ...newReseller,
      user_id: userId,
      status: "active",
    }]);

    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Uspješno", description: "Reseller dodan" });
      setNewReseller({ username: "", password: "", credits: 0, max_connections: 100, notes: "" });
      setIsAddDialogOpen(false);
      fetchResellers();
    }
  };

  const handleUpdateReseller = async () => {
    if (!editingReseller) return;

    const { error } = await supabase
      .from("resellers")
      .update({
        username: editingReseller.username,
        password: editingReseller.password,
        max_connections: editingReseller.max_connections,
        notes: editingReseller.notes,
        status: editingReseller.status,
      })
      .eq("id", editingReseller.id);

    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Uspješno", description: "Reseller ažuriran" });
      setEditingReseller(null);
      fetchResellers();
    }
  };

  const handleDeleteReseller = async (id: string) => {
    const { error } = await supabase.from("resellers").delete().eq("id", id);
    if (error) {
      toast({ title: "Greška", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Obrisano", description: "Reseller uklonjen" });
      fetchResellers();
    }
  };

  const handleCreditAction = async () => {
    if (!selectedReseller || creditAction.amount <= 0) return;

    const newCredits = creditAction.type === "add"
      ? selectedReseller.credits + creditAction.amount
      : selectedReseller.credits - creditAction.amount;

    if (newCredits < 0) {
      toast({ title: "Greška", description: "Nedovoljno kredita", variant: "destructive" });
      return;
    }

    // Update reseller credits
    const { error: updateError } = await supabase
      .from("resellers")
      .update({ credits: newCredits })
      .eq("id", selectedReseller.id);

    if (updateError) {
      toast({ title: "Greška", description: updateError.message, variant: "destructive" });
      return;
    }

    // Log credit history
    await supabase.from("reseller_credits").insert([{
      reseller_id: selectedReseller.id,
      amount: creditAction.type === "add" ? creditAction.amount : -creditAction.amount,
      type: creditAction.type,
      notes: creditAction.notes,
    }]);

    toast({
      title: "Uspješno",
      description: `Krediti ${creditAction.type === "add" ? "dodani" : "oduzeti"}`,
    });
    
    setCreditAction({ amount: 0, type: "add", notes: "" });
    setIsCreditsDialogOpen(false);
    setSelectedReseller(null);
    fetchResellers();
  };

  const openCreditsDialog = (reseller: Reseller) => {
    setSelectedReseller(reseller);
    setIsCreditsDialogOpen(true);
  };

  const openHistoryDialog = async (reseller: Reseller) => {
    setSelectedReseller(reseller);
    await fetchCreditHistory(reseller.id);
    setIsHistoryDialogOpen(true);
  };

  const getResellerUserCount = async (resellerId: string): Promise<number> => {
    // This would count users created by this reseller
    const { count } = await supabase
      .from("streaming_users")
      .select("*", { count: "exact", head: true })
      .eq("reseller_id", resellerId);
    return count || 0;
  };

  const totalCredits = resellers.reduce((sum, r) => sum + r.credits, 0);
  const activeResellers = resellers.filter(r => r.status === "active").length;

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
                <h1 className="text-3xl font-bold">Reseller Upravljanje</h1>
                <p className="text-muted-foreground">Upravljanje preprodavačima i kreditima</p>
              </div>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" />Novi reseller</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Novi Reseller</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Korisničko ime *</Label>
                      <Input 
                        value={newReseller.username} 
                        onChange={e => setNewReseller({ ...newReseller, username: e.target.value })} 
                      />
                    </div>
                    <div>
                      <Label>Lozinka *</Label>
                      <Input 
                        type="password"
                        value={newReseller.password} 
                        onChange={e => setNewReseller({ ...newReseller, password: e.target.value })} 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Početni krediti</Label>
                        <Input 
                          type="number"
                          value={newReseller.credits} 
                          onChange={e => setNewReseller({ ...newReseller, credits: parseInt(e.target.value) || 0 })} 
                        />
                      </div>
                      <div>
                        <Label>Max konekcija</Label>
                        <Input 
                          type="number"
                          value={newReseller.max_connections} 
                          onChange={e => setNewReseller({ ...newReseller, max_connections: parseInt(e.target.value) || 100 })} 
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Napomene</Label>
                      <Textarea 
                        value={newReseller.notes} 
                        onChange={e => setNewReseller({ ...newReseller, notes: e.target.value })} 
                      />
                    </div>
                    <Button onClick={handleAddReseller} className="w-full">Dodaj resellera</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Users className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{resellers.length}</p>
                      <p className="text-sm text-muted-foreground">Ukupno resellera</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-8 w-8 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold">{activeResellers}</p>
                      <p className="text-sm text-muted-foreground">Aktivnih</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-8 w-8 text-blue-500" />
                    <div>
                      <p className="text-2xl font-bold">{totalCredits}</p>
                      <p className="text-sm text-muted-foreground">Ukupno kredita</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-8 w-8 text-yellow-500" />
                    <div>
                      <p className="text-2xl font-bold">{resellers.length > 0 ? Math.round(totalCredits / resellers.length) : 0}</p>
                      <p className="text-sm text-muted-foreground">Prosječno kredita</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Resellers Table */}
            <Card>
              <CardHeader>
                <CardTitle>Reselleri</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Korisnik</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Krediti</TableHead>
                      <TableHead>Max konekcija</TableHead>
                      <TableHead>Kreiran</TableHead>
                      <TableHead className="text-right">Akcije</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resellers.map(reseller => (
                      <TableRow key={reseller.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{reseller.username}</p>
                            {reseller.notes && (
                              <p className="text-sm text-muted-foreground truncate max-w-[200px]">{reseller.notes}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={reseller.status === "active" ? "default" : "secondary"}>
                            {reseller.status === "active" ? "Aktivan" : "Neaktivan"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold">{reseller.credits}</span>
                        </TableCell>
                        <TableCell>{reseller.max_connections}</TableCell>
                        <TableCell>
                          {format(new Date(reseller.created_at), "dd.MM.yyyy", { locale: hr })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" onClick={() => openCreditsDialog(reseller)} title="Dodaj kredite">
                              <CreditCard className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openHistoryDialog(reseller)} title="Povijest">
                              <History className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingReseller(reseller)} title="Uredi">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteReseller(reseller.id)} title="Obriši">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Edit Reseller Dialog */}
      <Dialog open={!!editingReseller} onOpenChange={() => setEditingReseller(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uredi Resellera</DialogTitle>
          </DialogHeader>
          {editingReseller && (
            <div className="space-y-4">
              <div>
                <Label>Korisničko ime</Label>
                <Input 
                  value={editingReseller.username} 
                  onChange={e => setEditingReseller({ ...editingReseller, username: e.target.value })} 
                />
              </div>
              <div>
                <Label>Lozinka</Label>
                <Input 
                  type="password"
                  value={editingReseller.password} 
                  onChange={e => setEditingReseller({ ...editingReseller, password: e.target.value })} 
                />
              </div>
              <div>
                <Label>Max konekcija</Label>
                <Input 
                  type="number"
                  value={editingReseller.max_connections} 
                  onChange={e => setEditingReseller({ ...editingReseller, max_connections: parseInt(e.target.value) || 100 })} 
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editingReseller.status} onValueChange={v => setEditingReseller({ ...editingReseller, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktivan</SelectItem>
                    <SelectItem value="inactive">Neaktivan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Napomene</Label>
                <Textarea 
                  value={editingReseller.notes || ""} 
                  onChange={e => setEditingReseller({ ...editingReseller, notes: e.target.value })} 
                />
              </div>
              <Button onClick={handleUpdateReseller} className="w-full">Spremi promjene</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Credits Dialog */}
      <Dialog open={isCreditsDialogOpen} onOpenChange={setIsCreditsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upravljanje kreditima - {selectedReseller?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Trenutno stanje</p>
              <p className="text-3xl font-bold">{selectedReseller?.credits}</p>
            </div>
            <div>
              <Label>Akcija</Label>
              <Select value={creditAction.type} onValueChange={v => setCreditAction({ ...creditAction, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Dodaj kredite</SelectItem>
                  <SelectItem value="remove">Oduzmi kredite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Iznos</Label>
              <Input 
                type="number"
                value={creditAction.amount} 
                onChange={e => setCreditAction({ ...creditAction, amount: parseInt(e.target.value) || 0 })} 
              />
            </div>
            <div>
              <Label>Napomena</Label>
              <Input 
                value={creditAction.notes} 
                onChange={e => setCreditAction({ ...creditAction, notes: e.target.value })}
                placeholder="npr. Uplata, Promo..."
              />
            </div>
            <Button onClick={handleCreditAction} className="w-full">
              {creditAction.type === "add" ? "Dodaj" : "Oduzmi"} kredite
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Povijest kredita - {selectedReseller?.username}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {creditHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nema zapisa</p>
            ) : (
              <div className="space-y-2">
                {creditHistory.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">
                        <span className={entry.amount > 0 ? "text-green-500" : "text-red-500"}>
                          {entry.amount > 0 ? "+" : ""}{entry.amount}
                        </span>
                        {" "}kredita
                      </p>
                      {entry.notes && <p className="text-sm text-muted-foreground">{entry.notes}</p>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(entry.created_at), "dd.MM.yyyy HH:mm", { locale: hr })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
