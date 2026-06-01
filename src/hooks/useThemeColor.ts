import { useState, useEffect } from 'react';

export const useThemeColor = () => {
  const [themeColor, setThemeColor] = useState(() => {
    return localStorage.getItem('zapzone_theme_color') || 'blue';
  });
  const [themeShade, setThemeShade] = useState(() => {
    return localStorage.getItem('zapzone_theme_shade') || '800';
  });

  useEffect(() => {
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
