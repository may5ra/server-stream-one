import { Bell, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileNav } from "./MobileNav";

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-4 lg:px-6">
      {/* Mobile Nav + Search */}
      <div className="flex items-center gap-3">
        <MobileNav />
        <div className="relative w-48 sm:w-64 lg:w-96">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Pretraži..."
            className="h-10 w-full rounded-lg border border-border bg-muted/50 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
            3
          </span>
        </Button>

        {/* User - hidden on small screens */}
        <div className="hidden sm:flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-foreground">Admin</p>
            <p className="text-xs text-muted-foreground">Super Admin</p>
          </div>
        </div>
      </div>
    </header>
  );
}
