import React, { createContext, useContext, useEffect, useState } from "react";

export type ColorTheme = "teal" | "indigo" | "gold" | "purple";

interface ColorThemeContextType {
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
}

const ColorThemeContext = createContext<ColorThemeContextType | undefined>(undefined);

export function ColorThemeProvider({ children }: { children: React.ReactNode }) {
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(() => {
    // Read from localStorage on mount
    const saved = localStorage.getItem("colorTheme") as ColorTheme;
    return saved && ["teal", "indigo", "gold", "purple"].includes(saved) ? saved : "teal";
  });

  const setColorTheme = (theme: ColorTheme) => {
    localStorage.setItem("colorTheme", theme);
    setColorThemeState(theme);
  };

  useEffect(() => {
    // Apply data-color to html element
    const root = document.documentElement;
    root.setAttribute("data-color", colorTheme);
  }, [colorTheme]);

  return (
    <ColorThemeContext.Provider value={{ colorTheme, setColorTheme }}>
      {children}
    </ColorThemeContext.Provider>
  );
}

export function useColorTheme() {
  const context = useContext(ColorThemeContext);
  if (!context) {
    throw new Error("useColorTheme must be used within a ColorThemeProvider");
  }
  return context;
}
