
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const button = cva(
  "inline-flex items-center justify-center gap-2 font-mono text-xs tracking-wide transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:pointer-events-none select-none shrink-0",
  {
    variants: {
      variant: {
        flask:
  "bg-transparent text-[#888] border border-[#2a2a2a] border-b-2 hover:border-[#c8ff00]/40 hover:border-b-[#c8ff00] hover:text-[#c8ff00] transition-all duration-200 rounded-sm active:border-[#c8ff00] active:[background:linear-gradient(to_top,rgba(200,255,0,0.06),transparent)]",
        primary:
          "bg-[#c8ff00] text-[#141414] border border-[#c8ff00] hover:bg-[#d4ff33] hover:shadow-[0_0_12px_rgba(200,255,0,0.3)] active:scale-[0.98]",
        ghost:
          "bg-transparent text-[#f0f0f0] border border-[#2a2a2a] hover:border-[#3a3a3a] hover:bg-[#1e1e1e] active:scale-[0.98]",
        danger:
          "bg-transparent text-red-400 border border-[#2a2a2a] hover:border-red-500/50 hover:bg-red-500/10 active:scale-[0.98]",
        accent:
          "bg-transparent text-[#c8ff00] border border-[#c8ff00]/30 hover:border-[#c8ff00]/60 hover:bg-[rgba(200,255,0,0.06)] hover:shadow-[0_0_8px_rgba(200,255,0,0.15)] active:scale-[0.98]",
        muted:
          "bg-transparent text-[#888] border border-[#2a2a2a] hover:text-[#f0f0f0] hover:border-[#3a3a3a] active:scale-[0.98]",
      },
      size: {
        sm: "h-7 px-3 text-[10px] rounded-md",
        md: "h-8 px-4 text-[11px] rounded-md",
        lg: "h-9 px-5 text-[12px] rounded-lg",
        icon: "h-7 w-7 rounded-md",
      },
    },
    defaultVariants: {
      variant: "ghost",
      size: "md",
    },
  }
)

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button> & {
    className?: string
  }

export const Button = ({ variant, size, className, ...props }: ButtonProps) => (
  <button className={cn(button({ variant, size }), className)} {...props} />
)
