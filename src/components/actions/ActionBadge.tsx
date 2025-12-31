import { getActionConfig, type LeadAction } from '../../types'

interface ActionBadgeProps {
  action: LeadAction | undefined | null
  actionDate?: string | null
  size?: 'sm' | 'md' | 'lg'
  showDate?: boolean
  className?: string
}

export default function ActionBadge({
  action,
  actionDate,
  size = 'md',
  showDate = false,
  className = '',
}: ActionBadgeProps) {
  const config = getActionConfig(action)

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  }

  const formatActionDate = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const actionDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())

    if (actionDay.getTime() === today.getTime()) {
      return "Aujourd'hui"
    }
    if (actionDay.getTime() === tomorrow.getTime()) {
      return 'Demain'
    }
    if (actionDay < today) {
      const diffDays = Math.floor((today.getTime() - actionDay.getTime()) / (1000 * 60 * 60 * 24))
      return `En retard (${diffDays}j)`
    }
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  const isOverdue = actionDate && new Date(actionDate) < new Date()

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full font-medium
        ${config.bgColor} ${config.color}
        ${sizeClasses[size]}
        ${isOverdue ? 'ring-2 ring-red-300' : ''}
        ${className}
      `}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
      {showDate && actionDate && (
        <span className={`text-xs ${isOverdue ? 'text-red-600 font-semibold' : 'opacity-75'}`}>
          • {formatActionDate(actionDate)}
        </span>
      )}
    </span>
  )
}
