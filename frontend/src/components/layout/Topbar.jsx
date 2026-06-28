import { useLocation } from 'react-router-dom'

const PAGE_META = {
  '/dashboard': { title: 'Dashboard',      icon: '📊', desc: 'Real-time market intelligence'    },
  '/map':       { title: 'Market Map',     icon: '🗺️', desc: 'Geographic price intelligence'    },
  '/forecast':  { title: 'Price Forecast', icon: '📈', desc: 'AI-powered price forecasting'     },
  '/crops':     { title: 'Crop Explorer',  icon: '🌾', desc: 'Crop market analytics'            },
  '/reports':   { title: 'Reports',        icon: '📄', desc: 'Export intelligence'               },
  '/advisor':   { title: 'AI Advisor',     icon: '🤖', desc: 'Agricultural intelligence copilot'},
}

export default function Topbar() {
  const { pathname } = useLocation()
  const meta = PAGE_META[pathname] ?? { title: 'AgroPrice AI', icon: '🌿', desc: 'Intelligence Platform' }

  return (
    <header className="glass-topbar h-14 flex items-center px-6 gap-4 shrink-0 relative z-10">
      {/* Page identity */}
      <div className="flex items-center gap-2.5">
        <span className="text-base leading-none">{meta.icon}</span>
        <div>
          <h1 className="text-sm font-bold text-gray-900 leading-tight tracking-tight">{meta.title}</h1>
          <p className="text-[9px] text-gray-400 leading-tight hidden sm:block">{meta.desc}</p>
        </div>
      </div>

      <div className="flex-1" />

      {/* Status badges */}
      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.26)' }}>
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          <span className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: 'rgba(52,211,153,0.88)' }}>Live</span>
        </div>
        <span className="text-[10px] font-medium px-2.5 py-1 rounded-full hidden sm:block"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.40)' }}>
          South India · 2015–2026
        </span>
      </div>
    </header>
  )
}
