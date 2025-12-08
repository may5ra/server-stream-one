import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  iconColor?: string;
}

export function StatsCard({ 
  title, 
  value, 
  change, 
  changeType = "neutral", 
  icon: Icon,
  iconColor = "text-primary"
}: StatsCardProps) {
  return (
    <div className="group glass rounded-xl p-3 sm:p-5 transition-all duration-300 hover:border-primary/30 animate-fade-up h-full">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{title}</p>
          <p className="mt-1 sm:mt-2 text-xl sm:text-3xl font-semibold text-foreground">{value}</p>
          {change && (
            <p className={cn(
              "mt-0.5 sm:mt-1 text-[10px] sm:text-xs font-medium truncate",
              changeType === "positive" && "text-success",
              changeType === "negative" && "text-destructive",
              changeType === "neutral" && "text-muted-foreground"
            )}>
              {change}
            </p>
          )}
        </div>
        <div className={cn(
          "flex h-8 w-8 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl bg-muted transition-all duration-300 group-hover:scale-110 flex-shrink-0",
          iconColor === "text-primary" && "group-hover:bg-primary/20",
          iconColor === "text-success" && "group-hover:bg-success/20",
          iconColor === "text-warning" && "group-hover:bg-warning/20",
          iconColor === "text-destructive" && "group-hover:bg-destructive/20",
        )}>
          <Icon className={cn("h-4 w-4 sm:h-6 sm:w-6", iconColor)} />
        </div>
      </div>
    </div>
  );
}
