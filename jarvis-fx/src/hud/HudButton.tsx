import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { playBleep } from '@/lib/sound'

export interface HudButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode
  active?: boolean
  size?: 'sm' | 'md'
  aug?: string
}

/** augmented-ui clipped button with UI bleeps on hover/click. */
export function HudButton({ icon, active, size = 'md', aug = 'tl-clip br-clip border', className = '', children, onClick, onMouseEnter, ...rest }: HudButtonProps & { children?: ReactNode }) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-[0.68rem]' : 'px-3.5 py-1.5 text-[0.78rem]'
  return (
    <button
      type="button"
      data-augmented-ui={aug}
      data-active={active ? 'true' : undefined}
      aria-pressed={active === undefined ? undefined : active}
      className={`jx-aug-btn inline-flex items-center gap-1.5 ${pad} ${className}`}
      onMouseEnter={(e) => {
        playBleep('hover')
        onMouseEnter?.(e)
      }}
      onClick={(e) => {
        playBleep('click')
        onClick?.(e)
      }}
      {...rest}
    >
      {icon && <span className="[&>svg]:size-[1.1em] shrink-0">{icon}</span>}
      {children}
    </button>
  )
}
