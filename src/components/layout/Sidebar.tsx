import { useLocation, useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { 
  LayoutDashboard, 
  Users, 
  Server, 
  Activity, 
  Settings, 
  Database,
  Shield,
  Tv,
  LogOut,
  Film,
  Calendar,
  Clapperboard,
  UserCog
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Users, label: "Users", href: "/users" },
  { icon: Tv, label: "Streams", href: "/streams" },
  { icon: Film, label: "VOD", href: "/vod" },
  { icon: Clapperboard, label: "Series", href: "/series" },
  { icon: Calendar, label: "EPG", href: "/epg" },
  { icon: UserCog, label: "Resellers", href: "/resellers" },
  { icon: Server, label: "Servers", href: "/servers" },
  { icon: Database, label: "Database", href: "/database" },
  { icon: Activity, label: "Activity", href: "/activity" },
  { icon: Shield, label: "Security", href: "/security" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-sidebar-border bg-sidebar hidden lg:block">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Server className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">StreamPanel</h1>
            <p className="text-xs text-muted-foreground">v2.1.0</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <NavLink
                key={item.label}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
                {isActive && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Server Status */}
        <div className="border-t border-sidebar-border p-4">
          <div className="rounded-lg bg-sidebar-accent p-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-success animate-pulse-glow" />
              <span className="text-xs font-medium text-foreground">Server Online</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Ubuntu 22.04 LTS</p>
            <p className="text-xs text-muted-foreground font-mono">192.168.1.100</p>
          </div>
        </div>

        {/* User Info & Logout */}
        <div className="border-t border-sidebar-border p-4 space-y-2">
          {user && (
            <div className="px-3 py-2">
              <p className="text-xs text-muted-foreground">Prijavljeni kao</p>
              <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
            </div>
          )}
          <button 
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-5 w-5" />
            Odjavi se
          </button>
        </div>
      </div>
    </aside>
  );
}
