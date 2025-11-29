import { useState } from "react";
import { Plus, Search, MoreHorizontal, Circle, Edit, Trash2, Eye, Copy } from "lucide-react";
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

const Users = () => {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
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
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopyCredentials(user)}>
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteUser(user.id)}>
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
        </main>
      </div>
    </div>
  );
};

export default Users;
