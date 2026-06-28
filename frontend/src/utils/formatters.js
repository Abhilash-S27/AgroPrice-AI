import { format, parseISO } from 'date-fns'

/** Format a price value as ₹1,234 */
export function formatPrice(value) {
  if (value == null) return '—'
  return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

/** Format a price with /quintal suffix */
export function formatPricePerQuintal(value) {
  return `${formatPrice(value)}/qtl`
}

/** Short date: "Jan 24" */
export function formatDateShort(dateStr) {
  if (!dateStr) return ''
  try {
    return format(typeof dateStr === 'string' ? parseISO(dateStr) : dateStr, 'MMM yy')
  } catch { return dateStr }
}

/** Long date: "15 Jan 2024" */
export function formatDateLong(dateStr) {
  if (!dateStr) return ''
  try {
    return format(typeof dateStr === 'string' ? parseISO(dateStr) : dateStr, 'd MMM yyyy')
  } catch { return dateStr }
}

/** Percentage change with sign: "+12.3%" or "-4.1%" */
export function formatPctChange(value) {
  if (value == null) return '—'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${Number(value).toFixed(1)}%`
}
