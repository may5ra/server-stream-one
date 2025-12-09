import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NavLink } from "@/components/NavLink";
import { ThemeSelector } from "@/components/ThemeSelector";
import { cn } from "@/lib/utils";
import { 
  Menu,
  LayoutDashboard, 
  Users, 
  Server, 
  Activity, 
  Settings, 
  Database,
  Shield,
  Tv,
  LogOut,
  X,
  Film,
  Calendar,
  Clapperboard,
  UserCog,
  Wifi,
  Package,
  Network
} from "lucide-react";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Users, label: "Users", href: "/users" },
  { icon: Wifi, label: "Connections", href: "/connections" },
  { icon: Tv, label: "Streams", href: "/streams" },
  { icon: Film, label: "VOD", href: "/vod" },
  { icon: Clapperboard, label: "Series", href: "/series" },
  { icon: Package, label: "Bouquets", href: "/bouquets" },
  { icon: Calendar, label: "EPG", href: "/epg" },
  { icon: UserCog, label: "Resellers", href: "/resellers" },
  { icon: Server, label: "Servers", href: "/servers" },
  { icon: Network, label: "Load Balancers", href: "/load-balancers" },
  { icon: Database, label: "Database", href: "/database" },
  { icon: Activity, label: "Activity", href: "/activity" },
  { icon: Shield, label: "Security", href: "/security" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 p-0 bg-sidebar border-sidebar-border">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Server className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-base font-semibold text-foreground">StreamPanel</h1>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation - Scrollable */}
          <nav className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <NavLink
                    key={item.label}
                    to={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 rounded-lg px-2 py-3 text-center transition-all duration-200",
                      isActive
                        ? "bg-primary/15 text-primary border border-primary/30"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground border border-transparent"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </nav>

          {/* Theme Selector */}
          <div className="border-t border-sidebar-border p-3">
            <ThemeSelector />
          </div>

          {/* User Info & Logout */}
          <div className="border-t border-sidebar-border p-3 space-y-2">
            {user && (
              <div className="px-2 py-1.5 rounded-lg bg-sidebar-accent">
                <p className="text-xs text-muted-foreground">Prijavljeni kao</p>
                <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
              </div>
            )}
            <button 
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive bg-destructive/10 transition-all hover:bg-destructive/20"
            >
              <LogOut className="h-4 w-4" />
              Odjavi se
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}