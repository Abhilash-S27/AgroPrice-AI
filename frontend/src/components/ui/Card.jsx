import clsx from 'clsx'

export default function Card({ children, className = '', padding = true, hover = false }) {
  return (
    <div
      className={clsx(
        'card-premium rounded-2xl inner-glow',
        padding && 'p-5',
        hover && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-sm font-bold text-gray-900 tracking-tight">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5 font-medium">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
