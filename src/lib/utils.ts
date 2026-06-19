import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns'

// ─── Class Name Merger ────────────────────────────────────────────────────────
// Lightweight alternative to clsx — merges class strings, filtering falsy values
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

// ─── Date Formatting ──────────────────────────────────────────────────────────

/**
 * Format a date for display in the UI.
 * @param date - Date object, ISO string, or Firestore Timestamp
 * @param fmt - date-fns format string (default: 'dd MMM yyyy')
 */
export function formatDate(
  date: Date | string | { toDate(): Date } | null | undefined,
  fmt = 'dd MMM yyyy',
): string {
  if (!date) return '—'

  let d: Date

  if (typeof date === 'string') {
    d = parseISO(date)
  } else if (date instanceof Date) {
    d = date
  } else if (typeof (date as { toDate(): Date }).toDate === 'function') {
    // Firestore Timestamp
    d = (date as { toDate(): Date }).toDate()
  } else {
    return '—'
  }

  return isValid(d) ? format(d, fmt) : '—'
}

/**
 * Returns a relative time string (e.g., "3 days ago").
 */
export function timeAgo(
  date: Date | string | { toDate(): Date } | null | undefined,
): string {
  if (!date) return '—'

  let d: Date

  if (typeof date === 'string') {
    d = parseISO(date)
  } else if (date instanceof Date) {
    d = date
  } else if (typeof (date as { toDate(): Date }).toDate === 'function') {
    d = (date as { toDate(): Date }).toDate()
  } else {
    return '—'
  }

  return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : '—'
}

// ─── String Utilities ─────────────────────────────────────────────────────────

/** Capitalize the first letter of a string */
export function capitalize(str: string): string {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/** Truncate a string to a max length with ellipsis */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

// ─── Number Utilities ─────────────────────────────────────────────────────────

/** Format a number with locale-aware separators */
export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
