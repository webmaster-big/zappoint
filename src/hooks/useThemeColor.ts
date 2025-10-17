import { useState, useEffect } from 'react';

export const useThemeColor = () => {
  const [themeColor, setThemeColor] = useState('blue');
  const [themeShade, setThemeShade] = useState('800');

  useEffect(() => {
    // Load initial color and shade from localStorage
    const savedColor = localStorage.getItem('zapzone_theme_color') || 'blue';
    const savedShade = localStorage.getItem('zapzone_theme_shade') || '800';
    
    setThemeColor(savedColor);
    setThemeShade(savedShade);

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

  console.log(`Current theme color: ${fullColor}`);
  console.log(`Theme color: ${themeColor}, Theme shade: ${themeShade}`);

  return { themeColor, themeShade, fullColor, setThemeColor, setThemeShade };
};
