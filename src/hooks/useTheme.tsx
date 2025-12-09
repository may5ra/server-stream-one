import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type ThemeTemplate = "cyber" | "midnight" | "aurora" | "sunset";
export type ThemeMode = "dark" | "light";

interface ThemeContextType {
  template: ThemeTemplate;
  mode: ThemeMode;
  setTemplate: (template: ThemeTemplate) => void;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = "streampanel_theme";
const MODE_KEY = "streampanel_mode";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [template, setTemplateState] = useState<ThemeTemplate>("cyber");
  const [mode, setModeState] = useState<ThemeMode>("dark");

  useEffect(() => {
    const savedTemplate = localStorage.getItem(THEME_KEY) as ThemeTemplate;
    const savedMode = localStorage.getItem(MODE_KEY) as ThemeMode;
    
    if (savedTemplate && ["cyber", "midnight", "aurora", "sunset"].includes(savedTemplate)) {
      setTemplateState(savedTemplate);
    }
    if (savedMode && ["dark", "light"].includes(savedMode)) {
      setModeState(savedMode);
    }
    
    applyTheme(savedTemplate || "cyber", savedMode || "dark");
  }, []);

  const setTemplate = (newTemplate: ThemeTemplate) => {
    setTemplateState(newTemplate);
    localStorage.setItem(THEME_KEY, newTemplate);
    applyTheme(newTemplate, mode);
  };

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(MODE_KEY, newMode);
    applyTheme(template, newMode);
  };

  const toggleMode = () => {
    const newMode = mode === "dark" ? "light" : "dark";
    setMode(newMode);
  };

  return (
    <ThemeContext.Provider value={{ template, mode, setTemplate, setMode, toggleMode }}>
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

function applyTheme(template: ThemeTemplate, mode: ThemeMode) {
  const root = document.documentElement;
  
  // Light mode base colors
  const lightBase = {
    "--background": "0 0% 98%",
    "--foreground": "222 47% 11%",
    "--card": "0 0% 100%",
    "--card-foreground": "222 47% 11%",
    "--popover": "0 0% 100%",
    "--popover-foreground": "222 47% 11%",
    "--secondary": "220 14% 96%",
    "--secondary-foreground": "222 47% 11%",
    "--muted": "220 14% 96%",
    "--muted-foreground": "220 9% 46%",
    "--border": "220 13% 91%",
    "--input": "220 13% 91%",
    "--sidebar-background": "0 0% 100%",
    "--sidebar-foreground": "222 47% 11%",
    "--sidebar-accent": "220 14% 96%",
    "--sidebar-accent-foreground": "222 47% 11%",
    "--sidebar-border": "220 13% 91%",
  };

  const darkThemes: Record<ThemeTemplate, Record<string, string>> = {
    cyber: {
      "--background": "222 47% 6%",
      "--foreground": "210 40% 98%",
      "--card": "222 47% 8%",
      "--card-foreground": "210 40% 98%",
      "--popover": "222 47% 8%",
      "--popover-foreground": "210 40% 98%",
      "--primary": "187 92% 50%",
      "--primary-foreground": "222 47% 6%",
      "--secondary": "217 33% 17%",
      "--secondary-foreground": "210 40% 98%",
      "--muted": "217 33% 12%",
      "--muted-foreground": "215 20% 55%",
      "--accent": "187 92% 50%",
      "--accent-foreground": "222 47% 6%",
      "--border": "217 33% 17%",
      "--input": "217 33% 17%",
      "--ring": "187 92% 50%",
      "--sidebar-background": "222 47% 5%",
      "--sidebar-foreground": "210 40% 98%",
      "--sidebar-primary": "187 92% 50%",
      "--sidebar-primary-foreground": "222 47% 6%",
      "--sidebar-accent": "217 33% 12%",
      "--sidebar-accent-foreground": "210 40% 98%",
      "--sidebar-border": "217 33% 15%",
      "--sidebar-ring": "187 92% 50%",
    },
    midnight: {
      "--background": "240 20% 4%",
      "--foreground": "0 0% 98%",
      "--card": "240 20% 7%",
      "--card-foreground": "0 0% 98%",
      "--popover": "240 20% 7%",
      "--popover-foreground": "0 0% 98%",
      "--primary": "262 83% 58%",
      "--primary-foreground": "0 0% 100%",
      "--secondary": "240 15% 15%",
      "--secondary-foreground": "0 0% 98%",
      "--muted": "240 15% 12%",
      "--muted-foreground": "240 10% 55%",
      "--accent": "262 83% 58%",
      "--accent-foreground": "0 0% 100%",
      "--border": "240 15% 18%",
      "--input": "240 15% 18%",
      "--ring": "262 83% 58%",
      "--sidebar-background": "240 20% 3%",
      "--sidebar-foreground": "0 0% 98%",
      "--sidebar-primary": "262 83% 58%",
      "--sidebar-primary-foreground": "0 0% 100%",
      "--sidebar-accent": "240 15% 12%",
      "--sidebar-accent-foreground": "0 0% 98%",
      "--sidebar-border": "240 15% 12%",
      "--sidebar-ring": "262 83% 58%",
    },
    aurora: {
      "--background": "160 30% 4%",
      "--foreground": "160 20% 98%",
      "--card": "160 25% 7%",
      "--card-foreground": "160 20% 98%",
      "--popover": "160 25% 7%",
      "--popover-foreground": "160 20% 98%",
      "--primary": "160 84% 45%",
      "--primary-foreground": "160 30% 4%",
      "--secondary": "160 20% 15%",
      "--secondary-foreground": "160 20% 98%",
      "--muted": "160 15% 12%",
      "--muted-foreground": "160 10% 55%",
      "--accent": "160 84% 45%",
      "--accent-foreground": "160 30% 4%",
      "--border": "160 20% 18%",
      "--input": "160 20% 18%",
      "--ring": "160 84% 45%",
      "--sidebar-background": "160 30% 3%",
      "--sidebar-foreground": "160 20% 98%",
      "--sidebar-primary": "160 84% 45%",
      "--sidebar-primary-foreground": "160 30% 4%",
      "--sidebar-accent": "160 15% 12%",
      "--sidebar-accent-foreground": "160 20% 98%",
      "--sidebar-border": "160 15% 12%",
      "--sidebar-ring": "160 84% 45%",
    },
    sunset: {
      "--background": "15 25% 5%",
      "--foreground": "35 30% 98%",
      "--card": "15 22% 8%",
      "--card-foreground": "35 30% 98%",
      "--popover": "15 22% 8%",
      "--popover-foreground": "35 30% 98%",
      "--primary": "25 95% 55%",
      "--primary-foreground": "15 25% 5%",
      "--secondary": "15 18% 16%",
      "--secondary-foreground": "35 30% 98%",
      "--muted": "15 15% 12%",
      "--muted-foreground": "25 15% 55%",
      "--accent": "25 95% 55%",
      "--accent-foreground": "15 25% 5%",
      "--border": "15 18% 18%",
      "--input": "15 18% 18%",
      "--ring": "25 95% 55%",
      "--sidebar-background": "15 25% 4%",
      "--sidebar-foreground": "35 30% 98%",
      "--sidebar-primary": "25 95% 55%",
      "--sidebar-primary-foreground": "15 25% 5%",
      "--sidebar-accent": "15 15% 12%",
      "--sidebar-accent-foreground": "35 30% 98%",
      "--sidebar-border": "15 15% 12%",
      "--sidebar-ring": "25 95% 55%",
    },
  };

  // Light mode uses primary colors from template but light backgrounds
  const lightThemes: Record<ThemeTemplate, Record<string, string>> = {
    cyber: {
      ...lightBase,
      "--primary": "187 92% 40%",
      "--primary-foreground": "0 0% 100%",
      "--accent": "187 92% 40%",
      "--accent-foreground": "0 0% 100%",
      "--ring": "187 92% 40%",
      "--sidebar-primary": "187 92% 40%",
      "--sidebar-primary-foreground": "0 0% 100%",
      "--sidebar-ring": "187 92% 40%",
    },
    midnight: {
      ...lightBase,
      "--primary": "262 83% 58%",
      "--primary-foreground": "0 0% 100%",
      "--accent": "262 83% 58%",
      "--accent-foreground": "0 0% 100%",
      "--ring": "262 83% 58%",
      "--sidebar-primary": "262 83% 58%",
      "--sidebar-primary-foreground": "0 0% 100%",
      "--sidebar-ring": "262 83% 58%",
    },
    aurora: {
      ...lightBase,
      "--primary": "160 84% 35%",
      "--primary-foreground": "0 0% 100%",
      "--accent": "160 84% 35%",
      "--accent-foreground": "0 0% 100%",
      "--ring": "160 84% 35%",
      "--sidebar-primary": "160 84% 35%",
      "--sidebar-primary-foreground": "0 0% 100%",
      "--sidebar-ring": "160 84% 35%",
    },
    sunset: {
      ...lightBase,
      "--primary": "25 95% 50%",
      "--primary-foreground": "0 0% 100%",
      "--accent": "25 95% 50%",
      "--accent-foreground": "0 0% 100%",
      "--ring": "25 95% 50%",
      "--sidebar-primary": "25 95% 50%",
      "--sidebar-primary-foreground": "0 0% 100%",
      "--sidebar-ring": "25 95% 50%",
    },
  };

  const selectedTheme = mode === "dark" ? darkThemes[template] : lightThemes[template];
  
  Object.entries(selectedTheme).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  // Update body class for potential CSS selectors
  if (mode === "dark") {
    document.body.classList.add("dark");
    document.body.classList.remove("light");
  } else {
    document.body.classList.add("light");
    document.body.classList.remove("dark");
  }
}
