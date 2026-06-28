import clsx from 'clsx'

const variants = {
  primary:   'btn-forest',
  secondary: 'btn-glass',
  danger:    'bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-600/20 hover:shadow-red-600/30 transition-all duration-200',
  ghost:     'text-gray-600 hover:bg-forest-50 hover:text-forest-900 transition-colors duration-150',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2 text-sm rounded-xl',
  lg: 'px-6 py-3 text-sm rounded-xl',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  ...props
}) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 font-semibold tracking-tight',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-forest-600',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  )
}
