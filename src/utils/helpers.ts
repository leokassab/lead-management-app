export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}

export function isTomorrow(date: Date): boolean {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return isSameDay(date, tomorrow)
}

export function isThisWeek(date: Date): boolean {
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay() + 1) // Monday
  startOfWeek.setHours(0, 0, 0, 0)

  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)

  return date >= startOfWeek && date <= endOfWeek
}

export function daysSince(dateString: string): number {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

export function getDateRange(period: string): { start: Date; end: Date } {
  const now = new Date()
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  const start = new Date(now)
  start.setHours(0, 0, 0, 0)

  switch (period) {
    case 'today':
      break
    case 'week':
      start.setDate(now.getDate() - 7)
      break
    case 'month':
      start.setDate(1)
      break
    case 'last_month':
      start.setMonth(now.getMonth() - 1)
      start.setDate(1)
      end.setDate(0) // Last day of previous month
      break
    default:
      start.setDate(1)
  }

  return { start, end }
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'urgent':
      return '#EF4444'
    case 'hot':
      return '#F59E0B'
    case 'warm':
      return '#10B981'
    case 'cold':
    default:
      return '#9CA3AF'
  }
}

export function getPriorityLabel(priority: string): string {
  switch (priority) {
    case 'urgent':
      return '🔴 Urgent'
    case 'hot':
      return '🟠 Hot'
    case 'warm':
      return '🟢 Warm'
    case 'cold':
    default:
      return '⚪ Cold'
  }
}

export function getNextActionLabel(action: string | undefined): string {
  switch (action) {
    case 'call_back':
      return '📞 Rappeler'
    case 'follow_up':
      return '⏰ Relancer'
    case 'send_proposal':
      return '📄 Envoyer devis'
    case 'meeting':
      return '📅 RDV'
    default:
      return ''
  }
}
