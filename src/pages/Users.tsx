import { useState } from "react";
import { Plus, Search, Circle, Edit, Trash2, Copy, Download, FileText } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  username: string;
  password: string;
  status: "online" | "offline" | "expired";
  connections: number;
  maxConnections: number;
  expiry: string;
  lastActive: string;
  createdAt: string;
}

const initialUsers: User[] = [
  { id: "1", username: "user_premium_01", password: "pass123", status: "online", connections: 2, maxConnections: 3, expiry: "2025-02-15", lastActive: "Now", createdAt: "2024-01-15" },
  { id: "2", username: "stream_user_42", password: "stream42", status: "online", connections: 1, maxConnections: 2, expiry: "2025-01-30", lastActive: "2 min ago", createdAt: "2024-02-20" },
  { id: "3", username: "client_vip_99", password: "vip99pass", status: "offline", connections: 0, maxConnections: 5, expiry: "2025-03-10", lastActive: "1 hour ago", createdAt: "2024-03-01" },
  { id: "4", username: "viewer_basic_15", password: "basic15", status: "expired", connections: 0, maxConnections: 1, expiry: "2024-12-01", lastActive: "30 days ago", createdAt: "2024-06-10" },
  { id: "5", username: "premium_stream_88", password: "prem88", status: "online", connections: 3, maxConnections: 3, expiry: "2025-06-20", lastActive: "Now", createdAt: "2024-04-05" },
  { id: "6", username: "test_account_01", password: "test123", status: "offline", connections: 0, maxConnections: 2, expiry: "2025-04-15", lastActive: "5 hours ago", createdAt: "2024-05-12" },
];

const statusConfig = {
  online: { color: "text-success", bg: "bg-success/20", label: "Online" },
  offline: { color: "text-muted-foreground", bg: "bg-muted", label: "Offline" },
  expired: { color: "text-destructive", bg: "bg-destructive/20", label: "Expired" },
};

// Sample channels for playlist
const channels = [
  { name: "Sport 1 HD", url: "http://stream.example.com/sport1/playlist.m3u8" },
  { name: "Sport 2 HD", url: "http://stream.example.com/sport2/playlist.m3u8" },
  { name: "News 24", url: "http://stream.example.com/news24/playlist.m3u8" },
  { name: "Movies HD", url: "http://stream.example.com/movies/playlist.m3u8" },
  { name: "Music Channel", url: "http://stream.example.com/music/playlist.m3u8" },
  { name: "Documentary", url: "http://stream.example.com/docs/playlist.m3u8" },
  { name: "Kids TV", url: "http://stream.example.com/kids/playlist.m3u8" },
  { name: "Series HD", url: "http://stream.example.com/series/playlist.m3u8" },
];

const Users = () => {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { toast } = useToast();

  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    maxConnections: "1",
    expiry: "",
  });

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddUser = () => {
    if (!newUser.username || !newUser.password || !newUser.expiry) {
      toast({ title: "Error", description: "Please fill all fields", variant: "destructive" });
      return;
    }

    const user: User = {
      id: Date.now().toString(),
      username: newUser.username,
      password: newUser.password,
      status: "offline",
      connections: 0,
      maxConnections: parseInt(newUser.maxConnections),
      expiry: newUser.expiry,
      lastActive: "Never",
      createdAt: new Date().toISOString().split('T')[0],
    };

    setUsers([...users, user]);
    setNewUser({ username: "", password: "", maxConnections: "1", expiry: "" });
    setIsAddOpen(false);
    toast({ title: "Success", description: "User created successfully" });
  };

  const handleDeleteUser = (id: string) => {
    setUsers(users.filter(u => u.id !== id));
    toast({ title: "Deleted", description: "User has been removed" });
  };

  const handleCopyCredentials = (user: User) => {
    navigator.clipboard.writeText(`Username: ${user.username}\nPassword: ${user.password}`);
    toast({ title: "Copied", description: "Credentials copied to clipboard" });
  };

  const generateM3UPlaylist = (user: User) => {
    const serverUrl = "http://panel.example.com";
    
    let playlist = `#EXTM3U\n`;
    playlist += `#EXTINF:-1 tvg-id="" tvg-name="StreamPanel" tvg-logo="" group-title="Info",StreamPanel - ${user.username}\n`;
    playlist += `#EXTVLCOPT:http-user-agent=StreamPanel/1.0\n`;
    playlist += `${serverUrl}/info\n\n`;
    
    channels.forEach((channel, index) => {
      playlist += `#EXTINF:-1 tvg-id="${index + 1}" tvg-name="${channel.name}" tvg-logo="" group-title="Live TV",${channel.name}\n`;
      playlist += `${serverUrl}/live/${user.username}/${user.password}/${index + 1}.m3u8\n`;
    });

    return playlist;
  };

  const handleDownloadPlaylist = (user: User, format: 'm3u' | 'm3u_plus') => {
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

  const handleCopyPlaylistUrl = (user: User) => {
    const url = `http://panel.example.com/get.php?username=${user.username}&password=${user.password}&type=m3u_plus&output=ts`;
    navigator.clipboard.writeText(url);
    toast({ title: "Copied", description: "Playlist URL copied to clipboard" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <div className="ml-64">
        <Header />
        
        <main className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Users</h2>
              <p className="text-muted-foreground">Manage user accounts and subscriptions</p>
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
                      value={newUser.maxConnections}
                      onChange={(e) => setNewUser({ ...newUser, maxConnections: e.target.value })}
                      min="1"
                      max="10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Expiry Date</Label>
                    <Input
                      type="date"
                      value={newUser.expiry}
                      onChange={(e) => setNewUser({ ...newUser, expiry: e.target.value })}
                    />
                  </div>
                  <Button onClick={handleAddUser} className="w-full" variant="glow">
                    Create User
                  </Button>
                </div>
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
                            {user.connections}/{user.maxConnections}
                          </span>
                        </td>
                        <td className="py-4">
                          <span className="font-mono text-sm text-muted-foreground">{user.expiry}</span>
                        </td>
                        <td className="py-4">
                          <span className="font-mono text-sm text-muted-foreground">{user.createdAt}</span>
                        </td>
                        <td className="py-4">
                          <span className="text-sm text-muted-foreground">{user.lastActive}</span>
                        </td>
                        <td className="py-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Download M3U" onClick={() => handleDownloadPlaylist(user, 'm3u')}>
                              <Download className="h-4 w-4 text-primary" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Copy Playlist URL" onClick={() => handleCopyPlaylistUrl(user)}>
                              <FileText className="h-4 w-4 text-primary" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Copy Credentials" onClick={() => handleCopyCredentials(user)}>
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit User">
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
                <p className="text-sm text-muted-foreground">Download playlist file directly to device</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <FileText className="h-6 w-6 text-primary mb-2" />
                <h4 className="font-medium text-foreground">M3U URL</h4>
                <p className="text-sm text-muted-foreground">Copy URL for IPTV apps and players</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <Copy className="h-6 w-6 text-primary mb-2" />
                <h4 className="font-medium text-foreground">Credentials</h4>
                <p className="text-sm text-muted-foreground">Copy username and password for manual setup</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Users;
