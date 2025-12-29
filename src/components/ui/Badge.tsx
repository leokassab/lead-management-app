import type { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'danger'
  size?: 'sm' | 'md'
  className?: string
  color?: string
}

export default function Badge({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  color
}: BadgeProps) {
  const variants = {
    default: 'bg-blue-100 text-blue-800',
    secondary: 'bg-gray-100 text-gray-800',
    outline: 'border border-gray-300 text-gray-700 bg-white',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-orange-100 text-orange-800',
    danger: 'bg-red-100 text-red-800',
  }

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
  }

  const style = color ? { backgroundColor: `${color}20`, color } : undefined

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${!color ? variants[variant] : ''} ${sizes[size]} ${className}`}
      style={style}
    >
      {children}
    </span>
  )
}
