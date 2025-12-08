import { useState } from "react";

import { Plus, Search, Circle, Edit, Trash2, Copy, Download, FileText, Loader2, Package } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useStreamingUsers, StreamingUser } from "@/hooks/useStreamingUsers";
import { useSettings } from "@/hooks/useSettings";
import { useStreams } from "@/hooks/useStreams";
import { useBouquets } from "@/hooks/useBouquets";

const statusConfig = {
  online: { color: "text-success", bg: "bg-success/20", label: "Online" },
  offline: { color: "text-muted-foreground", bg: "bg-muted", label: "Offline" },
  expired: { color: "text-destructive", bg: "bg-destructive/20", label: "Expired" },
};

const Users = () => {
  const { users, loading, addUser, updateUser, deleteUser } = useStreamingUsers();
  const { settings } = useSettings();
  const { streams } = useStreams();
  const { bouquets } = useBouquets();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<StreamingUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [outputFormat, setOutputFormat] = useState<"m3u8" | "ts">("m3u8");
  const { toast } = useToast();

  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    max_connections: "1",
    expiry_date: "",
    bouquets: [] as string[],
  });

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getServerUrl = () => {
    // For Docker deployment, use current origin (e.g., http://38.180.100.86)
    // Only use settings if explicitly configured
    if (settings.serverDomain && settings.serverDomain !== "") {
      const protocol = settings.enableSSL ? "https" : "http";
      return `${protocol}://${settings.serverDomain}`;
    }
    // Fallback to current browser URL origin
    return window.location.origin;
  };

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password || !newUser.expiry_date) {
      toast({ title: "Error", description: "Please fill all fields", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      await addUser({
        username: newUser.username,
        password: newUser.password,
        max_connections: parseInt(newUser.max_connections),
        expiry_date: newUser.expiry_date,
        bouquets: newUser.bouquets,
      });
      setNewUser({ username: "", password: "", max_connections: "1", expiry_date: "", bouquets: [] });
      setIsAddOpen(false);
      toast({ title: "Success", description: "User created successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await deleteUser(id);
      toast({ title: "Deleted", description: "User has been removed" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleEditUser = (user: StreamingUser) => {
    setEditingUser({ ...user, bouquets: user.bouquets || [] });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    
    setIsSubmitting(true);
    try {
      await updateUser(editingUser.id, {
        username: editingUser.username,
        password: editingUser.password,
        max_connections: editingUser.max_connections,
        expiry_date: editingUser.expiry_date,
        status: editingUser.status,
        bouquets: editingUser.bouquets || [],
      });
      setIsEditOpen(false);
      setEditingUser(null);
      toast({ title: "Updated", description: "User updated successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleBouquet = (bouquetName: string, isNew: boolean) => {
    if (isNew) {
      setNewUser((prev) => ({
        ...prev,
        bouquets: prev.bouquets.includes(bouquetName)
          ? prev.bouquets.filter((b) => b !== bouquetName)
          : [...prev.bouquets, bouquetName],
      }));
    } else if (editingUser) {
      const currentBouquets = editingUser.bouquets || [];
      setEditingUser({
        ...editingUser,
        bouquets: currentBouquets.includes(bouquetName)
          ? currentBouquets.filter((b) => b !== bouquetName)
          : [...currentBouquets, bouquetName],
      });
    }
  };

  const handleCopyCredentials = async (user: StreamingUser) => {
    const text = `Username: ${user.username}\nPassword: ${user.password}`;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Kopirano", description: "Kredencijali kopirani u clipboard" });
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast({ title: "Kopirano", description: "Kredencijali kopirani u clipboard" });
    }
  };

  const handleDownloadPlaylist = async (user: StreamingUser) => {
    try {
      // Use edge function to generate playlist with correct URLs and bouquet filtering
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const playlistUrl = `${supabaseUrl}/functions/v1/m3u-playlist?username=${user.username}&password=${user.password}&type=m3u_plus&output=${outputFormat}`;
      
      const playlistResponse = await fetch(playlistUrl);
      if (!playlistResponse.ok) {
        throw new Error('Failed to generate playlist');
      }
      
      const playlist = await playlistResponse.text();
      const blob = new Blob([playlist], { type: 'application/x-mpegurl' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${user.username}_${outputFormat}_playlist.m3u`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Preuzeto", description: `${outputFormat.toUpperCase()} playlist preuzet za ${user.username}` });
    } catch (error) {
      console.error('Error downloading playlist:', error);
      toast({ title: "Greška", description: "Nije moguće preuzeti playlist", variant: "destructive" });
    }
  };

  const handleCopyPlaylistUrl = async (user: StreamingUser) => {
    const serverUrl = getServerUrl();
    const url = `${serverUrl}/get.php?username=${user.username}&password=${user.password}&type=m3u_plus&output=${outputFormat}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Kopirano", description: `${outputFormat.toUpperCase()} playlist URL kopiran u clipboard` });
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast({ title: "Kopirano", description: `${outputFormat.toUpperCase()} playlist URL kopiran u clipboard` });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const formatLastActive = (lastActive: string | null) => {
    if (!lastActive) return "Never";
    return new Date(lastActive).toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
              <h2 className="text-2xl font-semibold text-foreground">Users</h2>
              <p className="text-muted-foreground">Upravljanje korisnicima ({users.length})</p>
            </div>
            
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button variant="glow">
                  <Plus className="h-4 w-4" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent className="glass">
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                  <DialogDescription>Add a new user to the streaming panel</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      placeholder="Enter username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      placeholder="Enter password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Connections</Label>
                    <Input
                      type="number"
                      value={newUser.max_connections}
                      onChange={(e) => setNewUser({ ...newUser, max_connections: e.target.value })}
                      min="1"
                      max="10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Expiry Date</Label>
                    <Input
                      type="date"
                      value={newUser.expiry_date}
                      onChange={(e) => setNewUser({ ...newUser, expiry_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Bouquets (prazno = svi)
                    </Label>
                    <div className="max-h-40 overflow-y-auto border border-input rounded-md p-3 space-y-2 bg-background/50">
                      {bouquets.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nema dostupnih bouquet-a. Dodajte kategorije.</p>
                      ) : (
                        <>
                          {["live", "vod", "series"].map((type) => {
                            const typeBouquets = bouquets.filter((b) => b.type === type);
                            if (typeBouquets.length === 0) return null;
                            return (
                              <div key={type} className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase">
                                  {type === "live" ? "📺 Live TV" : type === "vod" ? "🎬 Filmovi" : "📺 Serije"}
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {typeBouquets.map((b) => (
                                    <Badge
                                      key={`${type}-${b.name}`}
                                      variant={newUser.bouquets.includes(b.name) ? "default" : "outline"}
                                      className="cursor-pointer text-xs"
                                      onClick={() => toggleBouquet(b.name, true)}
                                    >
                                      {b.name} ({b.count})
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                    {newUser.bouquets.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Odabrano: {newUser.bouquets.join(", ")}
                      </p>
                    )}
                  </div>
                  <Button onClick={handleAddUser} className="w-full" variant="glow" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Create User
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit User Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
              <DialogContent className="glass">
                <DialogHeader>
                  <DialogTitle>Edit User</DialogTitle>
                  <DialogDescription>Modify user settings and credentials</DialogDescription>
                </DialogHeader>
                {editingUser && (
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input
                        value={editingUser.username}
                        onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                        placeholder="Enter username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input
                        value={editingUser.password}
                        onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                        placeholder="Enter password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Connections</Label>
                      <Input
                        type="number"
                        value={editingUser.max_connections}
                        onChange={(e) => setEditingUser({ ...editingUser, max_connections: parseInt(e.target.value) || 1 })}
                        min="1"
                        max="10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Expiry Date</Label>
                      <Input
                        type="date"
                        value={editingUser.expiry_date}
                        onChange={(e) => setEditingUser({ ...editingUser, expiry_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <select
                        value={editingUser.status}
                        onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value as StreamingUser['status'] })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="online">Online</option>
                        <option value="offline">Offline</option>
                        <option value="expired">Expired</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Bouquets (prazno = svi)
                      </Label>
                      <div className="max-h-40 overflow-y-auto border border-input rounded-md p-3 space-y-2 bg-background/50">
                        {bouquets.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nema dostupnih bouquet-a. Dodajte kategorije.</p>
                        ) : (
                          <>
                            {["live", "vod", "series"].map((type) => {
                              const typeBouquets = bouquets.filter((b) => b.type === type);
                              if (typeBouquets.length === 0) return null;
                              return (
                                <div key={type} className="space-y-1">
                                  <p className="text-xs font-medium text-muted-foreground uppercase">
                                    {type === "live" ? "📺 Live TV" : type === "vod" ? "🎬 Filmovi" : "📺 Serije"}
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {typeBouquets.map((b) => (
                                      <Badge
                                        key={`${type}-${b.name}`}
                                        variant={(editingUser.bouquets || []).includes(b.name) ? "default" : "outline"}
                                        className="cursor-pointer text-xs"
                                        onClick={() => toggleBouquet(b.name, false)}
                                      >
                                        {b.name} ({b.count})
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>
                      {(editingUser.bouquets || []).length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Odabrano: {(editingUser.bouquets || []).join(", ")}
                        </p>
                      )}
                    </div>
                    <Button onClick={handleSaveEdit} className="w-full" variant="glow" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Save Changes
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>

          {/* Search & Filters */}
          <div className="mb-6 flex gap-4 flex-wrap items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Output Format:</Label>
              <Select value={outputFormat} onValueChange={(v) => setOutputFormat(v as "m3u8" | "ts")}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="m3u8">HLS (M3U8)</SelectItem>
                  <SelectItem value="ts">TS Stream</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Users Table */}
          <div className="glass rounded-xl p-5">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">User</th>
                    <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Connections</th>
                    <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Expiry</th>
                    <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Created</th>
                    <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Last Active</th>
                    <th className="pb-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.map((user) => {
                    const status = statusConfig[user.status];
                    return (
                      <tr key={user.id} className="group transition-colors hover:bg-muted/30">
                        <td className="py-4">
                          <span className="font-mono text-sm text-foreground">{user.username}</span>
                        </td>
                        <td className="py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.bg} ${status.color}`}>
                            <Circle className="h-2 w-2 fill-current" />
                            {status.label}
                          </span>
                        </td>
                        <td className="py-4">
                          <span className="text-sm text-foreground">
                            {user.connections}/{user.max_connections}
                          </span>
                        </td>
                        <td className="py-4">
                          <span className="font-mono text-sm text-muted-foreground">{formatDate(user.expiry_date)}</span>
                        </td>
                        <td className="py-4">
                          <span className="font-mono text-sm text-muted-foreground">{formatDate(user.created_at)}</span>
                        </td>
                        <td className="py-4">
                          <span className="text-sm text-muted-foreground">{formatLastActive(user.last_active)}</span>
                        </td>
                        <td className="py-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Download M3U" onClick={() => handleDownloadPlaylist(user)}>
                              <Download className="h-4 w-4 text-primary" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Copy Playlist URL" onClick={() => handleCopyPlaylistUrl(user)}>
                              <FileText className="h-4 w-4 text-primary" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Copy Credentials" onClick={() => handleCopyCredentials(user)}>
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit User" onClick={() => handleEditUser(user)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Delete User" onClick={() => handleDeleteUser(user.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredUsers.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">No users found</p>
                <Button variant="outline" className="mt-4" onClick={() => setIsAddOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add your first user
                </Button>
              </div>
            )}
          </div>

          {/* Playlist Info */}
          <div className="mt-6 glass rounded-xl p-5">
            <h3 className="text-lg font-semibold text-foreground mb-3">Playlist Formats</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-muted/50 p-4">
                <Download className="h-6 w-6 text-primary mb-2" />
                <h4 className="font-medium text-foreground">M3U Download</h4>
                <p className="text-sm text-muted-foreground">Download playlist file directly</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <FileText className="h-6 w-6 text-primary mb-2" />
                <h4 className="font-medium text-foreground">M3U URL</h4>
                <p className="text-sm text-muted-foreground">Copy playlist URL for IPTV apps</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <Copy className="h-6 w-6 text-primary mb-2" />
                <h4 className="font-medium text-foreground">Credentials</h4>
                <p className="text-sm text-muted-foreground">Copy username and password</p>
              </div>
            </div>
            {settings.serverDomain && (
              <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-sm text-foreground">
                  <strong>Server URL:</strong> {getServerUrl()}
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Users;
