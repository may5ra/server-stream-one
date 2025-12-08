import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type ThemeTemplate = "cyber" | "midnight" | "aurora" | "sunset";

interface ThemeContextType {
  template: ThemeTemplate;
  setTemplate: (template: ThemeTemplate) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = "streampanel_theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [template, setTemplateState] = useState<ThemeTemplate>("cyber");

  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY) as ThemeTemplate;
    if (saved && ["cyber", "midnight", "aurora", "sunset"].includes(saved)) {
      setTemplateState(saved);
      applyTheme(saved);
    }
  }, []);

  const setTemplate = (newTemplate: ThemeTemplate) => {
    setTemplateState(newTemplate);
    localStorage.setItem(THEME_KEY, newTemplate);
    applyTheme(newTemplate);
  };

  return (
    <ThemeContext.Provider value={{ template, setTemplate }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

function applyTheme(template: ThemeTemplate) {
  const root = document.documentElement;
  
  const themes: Record<ThemeTemplate, Record<string, string>> = {
    cyber: {
      "--background": "222 47% 6%",
      "--foreground": "210 40% 98%",
      "--card": "222 47% 8%",
      "--card-foreground": "210 40% 98%",
      "--primary": "187 92% 50%",
      "--primary-foreground": "222 47% 6%",
      "--secondary": "217 33% 17%",
      "--muted": "217 33% 12%",
      "--muted-foreground": "215 20% 55%",
      "--accent": "187 92% 50%",
      "--border": "217 33% 17%",
      "--sidebar-background": "222 47% 5%",
      "--sidebar-border": "217 33% 15%",
    },
    midnight: {
      "--background": "240 20% 4%",
      "--foreground": "0 0% 98%",
      "--card": "240 20% 7%",
      "--card-foreground": "0 0% 98%",
      "--primary": "262 83% 58%",
      "--primary-foreground": "0 0% 100%",
      "--secondary": "240 15% 15%",
      "--muted": "240 15% 12%",
      "--muted-foreground": "240 10% 55%",
      "--accent": "262 83% 58%",
      "--border": "240 15% 18%",
      "--sidebar-background": "240 20% 3%",
      "--sidebar-border": "240 15% 12%",
    },
    aurora: {
      "--background": "160 30% 4%",
      "--foreground": "160 20% 98%",
      "--card": "160 25% 7%",
      "--card-foreground": "160 20% 98%",
      "--primary": "160 84% 45%",
      "--primary-foreground": "160 30% 4%",
      "--secondary": "160 20% 15%",
      "--muted": "160 15% 12%",
      "--muted-foreground": "160 10% 55%",
      "--accent": "160 84% 45%",
      "--border": "160 20% 18%",
      "--sidebar-background": "160 30% 3%",
      "--sidebar-border": "160 15% 12%",
    },
    sunset: {
      "--background": "15 25% 5%",
      "--foreground": "35 30% 98%",
      "--card": "15 22% 8%",
      "--card-foreground": "35 30% 98%",
      "--primary": "25 95% 55%",
      "--primary-foreground": "15 25% 5%",
      "--secondary": "15 18% 16%",
      "--muted": "15 15% 12%",
      "--muted-foreground": "25 15% 55%",
      "--accent": "25 95% 55%",
      "--border": "15 18% 18%",
      "--sidebar-background": "15 25% 4%",
      "--sidebar-border": "15 15% 12%",
    },
  };

  const selectedTheme = themes[template];
  Object.entries(selectedTheme).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}
