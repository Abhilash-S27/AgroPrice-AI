import { NavLink } from 'react-router-dom'
import clsx from 'clsx'

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard',     icon: '📊' },
  { path: '/map',       label: 'Market Map',    icon: '🗺️' },
  { path: '/forecast',  label: 'Forecast',      icon: '📈' },
  { path: '/crops',     label: 'Crop Explorer', icon: '🌾' },
  { path: '/reports',   label: 'Reports',       icon: '📄' },
  { path: '/advisor',   label: 'AI Advisor',    icon: '🤖' },
]

export default function Sidebar() {
  return (
    <aside className="glass-sidebar w-56 shrink-0 min-h-screen flex flex-col relative z-10">

      {/* Brand */}
      <div className="px-5 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
            style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.28) 0%, rgba(20,120,255,0.18) 100%)', boxShadow: '0 2px 10px rgba(52,211,153,0.16)' }}>
            🌿
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm leading-tight tracking-tight">AgroPrice AI</p>
            <p className="text-[10px] text-gray-400 font-medium">South India Markets</p>
          </div>
        </div>
        {/* AI status indicator */}
        <div className="flex items-center gap-1.5 mt-3 px-1">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          <span className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: 'rgba(52,211,153,0.80)' }}>Intelligence Active</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ path, label, icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive ? 'nav-active' : 'nav-hover'
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={clsx('text-base leading-none transition-transform duration-200', isActive ? 'scale-110' : '')}>{icon}</span>
                <span className={clsx('font-semibold tracking-tight', isActive ? 'text-white' : 'text-gray-700')}>{label}</span>
                {isActive && (
                  <span className="ml-auto w-1 h-1 rounded-full bg-emerald-400 opacity-80" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/[0.06]">
        <div className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'rgba(255,255,255,0.32)' }}>AGMARKNET Dataset</p>
          <p className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.65)' }}>2015 – 2026</p>
          <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>MCA Research Project</p>
        </div>
      </div>

    </aside>
  )
}
