import { Search, User, LogOut, Settings, Shield, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileNav } from "./MobileNav";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { mode, toggleMode } = useTheme();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-3 sm:px-4 lg:px-6">
      {/* Mobile Nav + Search */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
        <MobileNav />
        <div className="relative flex-1 max-w-xs sm:max-w-sm lg:max-w-md">
          <Search className="absolute left-2.5 sm:left-3 top-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Pretraži..."
            className="h-8 sm:h-10 w-full rounded-lg border border-border bg-muted/50 pl-8 sm:pl-10 pr-3 sm:pr-4 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Dark/Light Mode Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMode}
          className="h-9 w-9 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
          title={mode === "dark" ? "Prebaci na svijetlu temu" : "Prebaci na tamnu temu"}
        >
          {mode === "dark" ? (
            <Sun className="h-4 w-4 text-primary" />
          ) : (
            <Moon className="h-4 w-4 text-primary" />
          )}
        </Button>
        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-1.5 h-auto">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium text-foreground">
                  {user?.email?.split('@')[0] || 'Admin'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isAdmin ? 'Administrator' : 'Korisnik'}
                </p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.email}</p>
              <p className="text-xs text-muted-foreground">
                {isAdmin ? 'Administrator' : 'Korisnik'}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Postavke
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem onClick={() => navigate('/security')}>
                <Shield className="mr-2 h-4 w-4" />
                Sigurnost
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Odjava
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
