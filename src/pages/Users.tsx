import { useState } from "react";
import { Plus, Search, Circle, Edit, Trash2, Copy, Download, FileText, Loader2 } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useStreamingUsers, StreamingUser } from "@/hooks/useStreamingUsers";
import { useSettings } from "@/hooks/useSettings";
import { useStreams } from "@/hooks/useStreams";

const statusConfig = {
  online: { color: "text-success", bg: "bg-success/20", label: "Online" },
  offline: { color: "text-muted-foreground", bg: "bg-muted", label: "Offline" },
  expired: { color: "text-destructive", bg: "bg-destructive/20", label: "Expired" },
};

const Users = () => {
  const { users, loading, addUser, updateUser, deleteUser } = useStreamingUsers();
  const { settings } = useSettings();
  const { streams } = useStreams();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<StreamingUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    max_connections: "1",
    expiry_date: "",
  });

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getServerUrl = () => {
    const domain = settings.serverDomain || "your-server.com";
    const protocol = settings.enableSSL ? "https" : "http";
    return `${protocol}://${domain}`;
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
      });
      setNewUser({ username: "", password: "", max_connections: "1", expiry_date: "" });
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
    setEditingUser(user);
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

  const handleCopyCredentials = (user: StreamingUser) => {
    navigator.clipboard.writeText(`Username: ${user.username}\nPassword: ${user.password}`);
    toast({ title: "Copied", description: "Credentials copied to clipboard" });
  };

  const generateM3UPlaylist = (user: StreamingUser) => {
    const serverUrl = getServerUrl();
    
    let playlist = `#EXTM3U\n`;
    playlist += `#EXTINF:-1 tvg-id="" tvg-name="${settings.serverName}" tvg-logo="" group-title="Info",${settings.serverName} - ${user.username}\n`;
    playlist += `#EXTVLCOPT:http-user-agent=${settings.serverName}/1.0\n`;
    playlist += `${serverUrl}/info\n\n`;
    
    streams.forEach((stream) => {
      playlist += `#EXTINF:-1 tvg-id="${stream.id}" tvg-name="${stream.name}" tvg-logo="" group-title="${stream.category || 'Live TV'}",${stream.name}\n`;
      
      // For HLS streams, use proxy URL format with auth
      if (stream.input_type === 'hls') {
        const encodedName = encodeURIComponent(stream.name);
        playlist += `${serverUrl}/proxy/${user.username}/${user.password}/${encodedName}/index.m3u8\n`;
      } else {
        // For RTMP/other streams, use traditional format
        playlist += `${serverUrl}/live/${user.username}/${user.password}/${stream.id}.m3u8\n`;
      }
    });

    return playlist;
  };

  const handleDownloadPlaylist = (user: StreamingUser) => {
    const playlist = generateM3UPlaylist(user);
    const blob = new Blob([playlist], { type: 'application/x-mpegurl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${user.username}_playlist.m3u`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: `Playlist downloaded for ${user.username}` });
  };

  const handleCopyPlaylistUrl = (user: StreamingUser) => {
    const serverUrl = getServerUrl();
    const url = `${serverUrl}/get.php?username=${user.username}&password=${user.password}&type=m3u_plus&output=ts`;
    navigator.clipboard.writeText(url);
    toast({ title: "Copied", description: "Playlist URL copied to clipboard" });
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
          <div className="mb-6 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
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
