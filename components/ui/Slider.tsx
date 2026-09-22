import type { CSSProperties } from "react"
import { cn } from "@/lib/utils"

interface SliderProps {
  min: number
  max: number
  value: number
  onChange: (value: number) => void
  step?: number
  className?: string
}

// Styled range input — see the `.slider` rules in App.css. The filled portion of the track
// is driven by `--fill` so the thumb's position reads as progress.
export function Slider({ min, max, value, onChange, step = 1, className }: SliderProps) {
  const fill = max === min ? 0 : ((value - min) / (max - min)) * 100

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className={cn("slider focus-ring", className)}
      style={{ "--fill": `${fill}%` } as CSSProperties}
    />
  )
}
