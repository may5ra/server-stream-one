import { MoreHorizontal, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface User {
  id: string;
  username: string;
  status: "online" | "offline" | "expired";
  connections: number;
  maxConnections: number;
  expiry: string;
  lastActive: string;
}

const users: User[] = [
  { id: "1", username: "user_premium_01", status: "online", connections: 2, maxConnections: 3, expiry: "2025-02-15", lastActive: "Now" },
  { id: "2", username: "stream_user_42", status: "online", connections: 1, maxConnections: 2, expiry: "2025-01-30", lastActive: "2 min ago" },
  { id: "3", username: "client_vip_99", status: "offline", connections: 0, maxConnections: 5, expiry: "2025-03-10", lastActive: "1 hour ago" },
  { id: "4", username: "viewer_basic_15", status: "expired", connections: 0, maxConnections: 1, expiry: "2024-12-01", lastActive: "30 days ago" },
  { id: "5", username: "premium_stream_88", status: "online", connections: 3, maxConnections: 3, expiry: "2025-06-20", lastActive: "Now" },
];

const statusConfig = {
  online: { color: "text-success", bg: "bg-success/20", label: "Online" },
  offline: { color: "text-muted-foreground", bg: "bg-muted", label: "Offline" },
  expired: { color: "text-destructive", bg: "bg-destructive/20", label: "Expired" },
};

export function UsersTable() {
  return (
    <div className="glass rounded-xl p-5 animate-fade-up" style={{ animationDelay: '0.2s' }}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Zadnji korisnici</h3>
          <p className="text-sm text-muted-foreground">Aktivnost i status korisnika</p>
        </div>
        <Button variant="outline" size="sm">Prikaži sve</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">User</th>
              <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Connections</th>
              <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Expiry</th>
              <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Last Active</th>
              <th className="pb-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => {
              const status = statusConfig[user.status];
              return (
                <tr key={user.id} className="group transition-colors hover:bg-muted/30">
                  <td className="py-3">
                    <span className="font-mono text-sm text-foreground">{user.username}</span>
                  </td>
                  <td className="py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.bg} ${status.color}`}>
                      <Circle className="h-2 w-2 fill-current" />
                      {status.label}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className="text-sm text-foreground">
                      {user.connections}/{user.maxConnections}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className="font-mono text-sm text-muted-foreground">{user.expiry}</span>
                  </td>
                  <td className="py-3">
                    <span className="text-sm text-muted-foreground">{user.lastActive}</span>
                  </td>
                  <td className="py-3 text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
