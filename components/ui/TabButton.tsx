import { cn } from "@/lib/utils"

type TabButtonProps = {

    isActive: boolean
    onClick: () => void
    icon?: React.ReactNode
    children?: React.ReactNode
    width?: number
    collapsedWidth?: number
    height?: number
    cornerRadius?: number
    flare?: number
    className?: string
}

export const TabButton = ({

    isActive,
    onClick,
    icon,
    width = 120,
    collapsedWidth = 36,
    height = 32,
    cornerRadius = 10,
    flare = 8,
    children,
    className
}: TabButtonProps) => {
    const w = isActive ? width : collapsedWidth
    const h = height
    const r = cornerRadius

    const path = `
    M ${-flare} ${h}
    C ${-flare + 4} ${h} ${0} ${h - 4} ${0} ${h - flare}
    L 0 ${r}
    Q 0 0 ${r} 0
    L ${w - r} 0
    Q ${w} 0 ${w} ${r}
    L ${w} ${h - flare}
    C ${w} ${h - 4} ${w + flare - 4} ${h} ${w + flare} ${h}
  `

    return (
        <button
            onClick={onClick}
            className={cn("relative cursor-pointer shrink-0 bg-transparent border-none p-0 transition-[width] duration-150 ease-in-out", className)}
            style={{ width: w, height: h, zIndex: isActive ? 1 : 0 }}
        >
            <svg
                width={w + flare * 2}
                height={h}
                viewBox={`${-flare} 0 ${w + flare * 2} ${h}`}
                className="absolute top-0 overflow-visible"
                style={{ left: -flare }}
            >
                <path
                    d={path}
                    fill={isActive ? "var(--color-background)" : "var(--color-surface)"}
                    stroke="var(--color-border-secondary)"
                    strokeWidth="0.5"
                />
                {isActive && (
                    <line
                        x1={-flare + 1} y1={h}
                        x2={w + flare - 1} y2={h}
                        stroke="var(--color-background-primary)"
                        strokeWidth="1.5"
                    />
                )}
            </svg>

            <span className={cn(
                "relative z-10 flex items-center justify-center h-full whitespace-nowrap overflow-hidden transition-all duration-150 font-sans text-[11px]",
                isActive ? "text-primary" : "text-secondary"
            )}>
                {children}
            </span>
        </button>
    )
}