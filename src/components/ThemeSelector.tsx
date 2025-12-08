import { useTheme, ThemeTemplate } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { Check, Sparkles } from "lucide-react";

interface ThemeOption {
  id: ThemeTemplate;
  name: string;
  description: string;
  colors: string[];
}

const themes: ThemeOption[] = [
  {
    id: "cyber",
    name: "Cyber",
    description: "Cyan futuristic",
    colors: ["bg-cyan-500", "bg-cyan-700", "bg-slate-900"],
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Purple dark",
    colors: ["bg-violet-500", "bg-violet-700", "bg-slate-950"],
  },
  {
    id: "aurora",
    name: "Aurora",
    description: "Green nature",
    colors: ["bg-emerald-500", "bg-emerald-700", "bg-slate-900"],
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "Orange warm",
    colors: ["bg-orange-500", "bg-orange-700", "bg-stone-900"],
  },
];

export function ThemeSelector() {
  const { template, setTemplate } = useTheme();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">Theme</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {themes.map((theme) => (
          <button
            key={theme.id}
            onClick={() => setTemplate(theme.id)}
            className={cn(
              "relative flex flex-col items-start gap-1.5 rounded-lg border p-3 transition-all",
              template === theme.id
                ? "border-primary bg-primary/10"
                : "border-border bg-card hover:border-primary/50"
            )}
          >
            <div className="flex items-center gap-1.5">
              {theme.colors.map((color, i) => (
                <div
                  key={i}
                  className={cn("h-3 w-3 rounded-full", color)}
                />
              ))}
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">{theme.name}</p>
              <p className="text-xs text-muted-foreground">{theme.description}</p>
            </div>
            {template === theme.id && (
              <div className="absolute right-2 top-2">
                <Check className="h-4 w-4 text-primary" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
