type BadgeVariant = 'default' | 'gold' | 'red' | 'green' | 'blue' | 'gray'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-ipl-border text-gray-200',
  gold: 'bg-ipl-gold text-black',
  red: 'bg-ipl-accent text-white',
  green: 'bg-green-700 text-white',
  blue: 'bg-blue-700 text-white',
  gray: 'bg-gray-700 text-gray-300',
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  )
}
