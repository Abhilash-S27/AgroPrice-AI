/**
 * DashPanel — Phase 3D enterprise dashboard card framework.
 *
 * Features:
 *   - Collapsible with smooth CSS grid-row animation (no layout shift)
 *   - Priority dot + chip (critical / high / medium)
 *   - Actions slot in header (buttons, badges, toggles)
 *   - compact mode: tighter padding for dense layouts
 *   - dark mode: executive dark-header variant
 *   - preview: one-line summary shown when collapsed
 *   - loading: shimmer skeleton state
 *   - Hover elevation via box-shadow transition
 */

import { useState, memo } from 'react'

const PRIORITY_CFG = {
  critical: {
    dot:  'bg-red-500',
    chip: 'bg-red-50 border-red-200 text-red-700',
    darkChip: 'bg-red-900/40 border-red-700/60 text-red-300',
    label: 'Alert',
  },
  high: {
    dot:  'bg-amber-500',
    chip: 'bg-amber-50 border-amber-200 text-amber-700',
    darkChip: 'bg-amber-900/40 border-amber-700/60 text-amber-300',
    label: 'Priority',
  },
  medium: {
    dot:  'bg-blue-400',
    chip: 'bg-blue-50 border-blue-200 text-blue-700',
    darkChip: 'bg-blue-900/40 border-blue-700/60 text-blue-300',
    label: 'Info',
  },
}

export const DashPanel = memo(function DashPanel({
  title,
  subtitle,
  children,
  priority,
  badge,
  actions,
  defaultOpen = true,
  compact     = false,
  className   = '',
  dark        = false,
  preview     = null,
  loading     = false,
  maxHeight   = null,   // e.g. "480px" — adds overflow-y-auto to body when set
}) {
  const [open, setOpen] = useState(defaultOpen)
  const pri = priority ? PRIORITY_CFG[priority] : null

  const borderCls   = dark ? 'border-white/[0.06]' : 'border-white/[0.09]'
  const bgCls       = dark ? 'card-dark'           : 'card-premium'
  const headerBgCls = dark
    ? (open ? 'bg-transparent' : 'bg-black/10')
    : (open ? 'bg-transparent' : 'bg-white/[0.04]')
  const titleCls    = dark ? 'text-gray-100' : 'text-gray-900'
  const subCls      = dark ? 'text-gray-500' : 'text-gray-400'
  const toggleCls   = dark ? 'text-gray-500' : 'text-gray-400'

  return (
    <div className={`
      rounded-2xl border overflow-hidden inner-glow
      transition-all duration-200 ease-in-out
      ${borderCls} ${bgCls} ${className}
    `}>

      {/* ── Panel header ──────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`
          w-full flex items-center justify-between gap-3 text-left
          ${open ? `border-b ${dark ? 'border-white/[0.06]' : 'border-white/[0.06]'}` : ''}
          ${compact ? 'px-4 py-2.5' : 'px-5 py-3.5'}
          ${headerBgCls}
          transition-all duration-150 ease-in-out
          ${dark ? '' : 'hover:bg-white/[0.04]'}
        `}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {pri && (
            <span className={`w-2 h-2 rounded-full shrink-0 ${pri.dot}`} />
          )}
          <div className="min-w-0 flex-1">
            <p className={`
              font-semibold truncate leading-tight
              ${compact ? 'text-xs' : 'text-sm'}
              ${titleCls}
            `}>
              {title}
            </p>
            {subtitle && !compact && open && (
              <p className={`text-[11px] truncate mt-0.5 leading-tight ${subCls}`}>
                {subtitle}
              </p>
            )}
            {/* Collapsed preview — shown only when closed */}
            {!open && preview && (
              <p className={`text-[10px] truncate mt-0.5 italic ${subCls}`}>
                {preview}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {badge && (
            <span className={`hidden sm:inline text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${
              dark
                ? 'bg-gray-800 border-gray-600 text-gray-400'
                : 'bg-gray-50 border-gray-200 text-gray-500'
            }`}>
              {badge}
            </span>
          )}
          {pri && (
            <span className={`hidden sm:inline text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
              dark ? pri.darkChip : pri.chip
            }`}>
              {pri.label}
            </span>
          )}
          {actions && open && (
            <div onClick={e => e.stopPropagation()}>{actions}</div>
          )}
          <span className={`
            text-xs transition-transform duration-150 ease-in-out select-none
            ${toggleCls} ${open ? '' : '-rotate-90'}
          `}>
            ▾
          </span>
        </div>
      </button>

      {/* ── Collapsible body — CSS grid-row trick for smooth animation ── */}
      <div
        className="grid transition-all duration-200 ease-in-out bg-transparent"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          {loading ? (
            <div className={`${compact ? 'px-4 py-3' : 'px-5 py-4'} space-y-2 animate-pulse`}>
              {[100, 85, 68].map((w, i) => (
                <div
                  key={i}
                  className={`h-2 rounded-full ${dark ? 'bg-white/10' : 'bg-forest-900/[0.06]'}`}
                  style={{ width: `${w}%` }}
                />
              ))}
              <div className={`h-2 rounded-full w-1/2 ${dark ? 'bg-white/05' : 'bg-forest-900/[0.04]'}`} />
            </div>
          ) : (
            <div
              className={compact ? 'px-4 py-3' : 'px-5 py-4'}
              style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
            >
              {children}
            </div>
          )}
        </div>
      </div>

    </div>
  )
})

export default DashPanel
