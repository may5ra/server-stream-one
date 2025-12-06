import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NavLink } from "@/components/NavLink";
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
  Wifi
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
  { icon: Calendar, label: "EPG", href: "/epg" },
  { icon: UserCog, label: "Resellers", href: "/resellers" },
  { icon: Server, label: "Servers", href: "/servers" },
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
      <SheetContent side="left" className="w-72 p-0 bg-sidebar border-sidebar-border">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <Server className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">StreamPanel</h1>
                <p className="text-xs text-muted-foreground">v2.1.0</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <NavLink
                  key={item.label}
                  to={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

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
      </SheetContent>
    </Sheet>
  );
}