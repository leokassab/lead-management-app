import { NavLink, useNavigate } from 'react-router-dom'
import { useLeads } from '../../hooks/useLeads'
import NotificationDropdown from './NotificationDropdown'
import UserMenu from './UserMenu'

export default function Header() {
  const navigate = useNavigate()
  const { leads } = useLeads()

  // Calculate leads requiring action (queue count)
  const getQueueCount = () => {
    const now = new Date()

    return leads.filter(lead => {
      // Exclude closed leads
      const status = lead.status?.toLowerCase() || ''
      if (status.includes('gagné') || status.includes('perdu') ||
          status.includes('won') || status.includes('lost')) {
        return false
      }

      // Exclude waiting/do not contact
      if (lead.current_action === 'waiting_response' ||
          lead.current_action === 'do_not_contact') {
        return false
      }

      // Has action scheduled for today or past
      if (lead.current_action_date) {
        const actionDate = new Date(lead.current_action_date)
        if (actionDate <= now) return true
      }

      // Has an active action (not none)
      if (lead.current_action && lead.current_action !== 'none') {
        return true
      }

      return false
    }).length
  }

  const queueCount = getQueueCount()

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'text-cyan-400 bg-white/10'
        : 'text-gray-300 hover:text-white hover:bg-white/10'
    }`

  return (
    <header className="h-20 bg-[#0f172a] sticky top-0 z-40">
      <div className="h-full max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <div
          onClick={() => navigate('/dashboard')}
          className="flex items-center cursor-pointer"
        >
          <img src="/logo.png" alt="Prospex" className="h-12 w-auto" />
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          <NavLink to="/dashboard" className={navLinkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/queue" className={navLinkClass}>
            <span className="flex items-center gap-2">
              À traiter
              {queueCount > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center font-medium">
                  {queueCount > 99 ? '99+' : queueCount}
                </span>
              )}
            </span>
          </NavLink>
          <NavLink to="/leads" className={navLinkClass}>
            Leads
          </NavLink>
          <NavLink to="/sequences" className={navLinkClass}>
            Séquences
          </NavLink>
          <NavLink to="/calendrier" className={navLinkClass}>
            Calendrier
          </NavLink>
          <NavLink to="/statistiques" className={navLinkClass}>
            Statistiques
          </NavLink>
          <NavLink to="/parametres" className={navLinkClass}>
            Paramètres
          </NavLink>
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <NotificationDropdown />
          <UserMenu />
        </div>
      </div>

      {/* Mobile navigation */}
      <nav className="md:hidden border-t border-gray-700 bg-[#0f172a] px-4 py-2 flex justify-around">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex flex-col items-center text-xs ${isActive ? 'text-cyan-400' : 'text-gray-400'}`
          }
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span>Dashboard</span>
        </NavLink>
        <NavLink
          to="/queue"
          className={({ isActive }) =>
            `flex flex-col items-center text-xs relative ${isActive ? 'text-cyan-400' : 'text-gray-400'}`
          }
        >
          <div className="relative">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            {queueCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] rounded-full min-w-[14px] h-3.5 px-1 flex items-center justify-center">
                {queueCount > 9 ? '9+' : queueCount}
              </span>
            )}
          </div>
          <span>À traiter</span>
        </NavLink>
        <NavLink
          to="/leads"
          className={({ isActive }) =>
            `flex flex-col items-center text-xs ${isActive ? 'text-cyan-400' : 'text-gray-400'}`
          }
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Leads</span>
        </NavLink>
        <NavLink
          to="/sequences"
          className={({ isActive }) =>
            `flex flex-col items-center text-xs ${isActive ? 'text-cyan-400' : 'text-gray-400'}`
          }
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Séquences</span>
        </NavLink>
        <NavLink
          to="/calendrier"
          className={({ isActive }) =>
            `flex flex-col items-center text-xs ${isActive ? 'text-cyan-400' : 'text-gray-400'}`
          }
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>Calendrier</span>
        </NavLink>
        <NavLink
          to="/statistiques"
          className={({ isActive }) =>
            `flex flex-col items-center text-xs ${isActive ? 'text-cyan-400' : 'text-gray-400'}`
          }
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span>Stats</span>
        </NavLink>
      </nav>
    </header>
  )
}
