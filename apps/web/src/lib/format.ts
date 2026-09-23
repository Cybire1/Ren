/** "1234.5" → "$1,234.50". Amounts arrive as decimal strings; never round-trip them through floats for maths. */
export function usd(amount: string | number) {
  const n = typeof amount === 'number' ? amount : Number(amount)
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
}

export function ago(iso: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' })
}
