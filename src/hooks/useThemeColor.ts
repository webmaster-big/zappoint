import { useState, useEffect } from 'react';

export const useThemeColor = () => {
  // Load initial values from localStorage or use defaults
  const [themeColor, setThemeColor] = useState(() => {
    return localStorage.getItem('zapzone_theme_color') || 'blue';
  });
  const [themeShade, setThemeShade] = useState(() => {
    return localStorage.getItem('zapzone_theme_shade') || '800';
  });

  useEffect(() => {
    // Listen for color changes from Settings page
    const handleColorChange = (event: CustomEvent) => {
      setThemeColor(event.detail.color);
      setThemeShade(event.detail.shade);
    };

    window.addEventListener('zapzone_color_changed', handleColorChange as EventListener);
    
    return () => {
      window.removeEventListener('zapzone_color_changed', handleColorChange as EventListener);
    };
  }, []);

  const fullColor = `${themeColor}-${themeShade}`;

  return { themeColor, themeShade, fullColor, setThemeColor, setThemeShade };
};
