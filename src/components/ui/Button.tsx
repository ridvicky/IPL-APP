import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-ipl-accent hover:bg-red-600 text-white border-transparent',
  secondary: 'bg-ipl-card hover:bg-ipl-border text-white border-ipl-border',
  danger: 'bg-red-700 hover:bg-red-800 text-white border-transparent',
  ghost: 'bg-transparent hover:bg-ipl-card text-gray-300 border-ipl-border',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-2 rounded border font-semibold',
        'transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ipl-accent',
        variantClasses[variant],
        sizeClasses[size],
        (disabled || loading) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        className,
      ].join(' ')}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  )
}
