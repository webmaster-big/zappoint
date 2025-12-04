import { useEffect, useRef, useState } from 'react';

interface CounterAnimationProps {
  value: string | number;
  duration?: number;
  className?: string;
}

const CounterAnimation: React.FC<CounterAnimationProps> = ({ 
  value, 
  duration = 1000,
  className = ''
}) => {
  const [displayValue, setDisplayValue] = useState<string>('0');
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    // Check if value is a number or contains a number
    const numericMatch = String(value).match(/[\d,\.]+/);
    if (!numericMatch) {
      setDisplayValue(String(value));
      return;
    }

    const prefix = String(value).substring(0, numericMatch.index);
    const suffix = String(value).substring((numericMatch.index || 0) + numericMatch[0].length);
    const targetNumber = parseFloat(numericMatch[0].replace(/,/g, ''));
    
    if (isNaN(targetNumber)) {
      setDisplayValue(String(value));
      return;
    }

    const startValue = 0;
    startTimeRef.current = null;

    const animate = (currentTime: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = startValue + (targetNumber - startValue) * easeOutQuart;

      // Format the number with commas if original had them
      const formattedValue = numericMatch[0].includes(',') 
        ? currentValue.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        : currentValue.toFixed(numericMatch[0].includes('.') ? 2 : 0);

      setDisplayValue(prefix + formattedValue + suffix);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(String(value));
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  return <span className={className}>{displayValue}</span>;
};

export default CounterAnimation;
