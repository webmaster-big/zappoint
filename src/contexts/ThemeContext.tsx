import React, { createContext, useState, useEffect } from 'react';

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    // Check localStorage for saved theme preference
    try {
      const saved = localStorage.getItem('admin-theme');
      return saved ? JSON.parse(saved) : false;
    } catch {
      // If parsing fails, clear the invalid data and return default
      localStorage.removeItem('admin-theme');
      return false;
    }
  });

  useEffect(() => {
    // Save theme preference
    localStorage.setItem('admin-theme', JSON.stringify(isDark));
    
    // Apply theme to document
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
