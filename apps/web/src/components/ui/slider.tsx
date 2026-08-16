import React from 'react';
import { cn } from '../../lib/utils';

export interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange: (value: number) => void;
  className?: string;
  disabled?: boolean;
}

export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  className,
  disabled = false,
}: SliderProps) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onValueChange(Number(e.target.value))}
      className={cn(
        'w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500 disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
    />
  );
}
