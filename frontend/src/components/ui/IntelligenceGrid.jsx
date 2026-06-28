/**
 * IntelligenceGrid — Phase 3D responsive grid engine.
 *
 * Provides a density-aware, auto-fitting grid for the command center layout.
 * Supports explicit column counts or auto-fit based on minWidth.
 *
 * DensityContext propagates the current density setting to child components.
 */

import { memo, createContext, useContext } from 'react'

export const DensityContext = createContext('balanced')
export const useDensity = () => useContext(DensityContext)

export const DENSITY_CFG = {
  compact:  { gap: 'gap-2', outerPad: 'p-3',  innerGap: 'gap-1.5', text: 'text-xs',  label: 'text-[8px]'  },
  balanced: { gap: 'gap-4', outerPad: 'p-4',  innerGap: 'gap-3',   text: 'text-sm',  label: 'text-[9px]'  },
  expanded: { gap: 'gap-6', outerPad: 'p-5',  innerGap: 'gap-4',   text: 'text-sm',  label: 'text-[10px]' },
}

export const IntelligenceGrid = memo(function IntelligenceGrid({
  cols,
  minWidth = 260,
  density  = 'balanced',
  className = '',
  children,
}) {
  const { gap } = DENSITY_CFG[density] ?? DENSITY_CFG.balanced
  const gridStyle = cols
    ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }
    : { gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))` }

  return (
    <div className={`grid ${gap} ${className}`} style={gridStyle}>
      {children}
    </div>
  )
})

export default IntelligenceGrid
