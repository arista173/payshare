export function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-HK', {
    style: 'currency',
    currency: 'HKD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Bagi rata dengan pembulatan sen supaya total tetap sama persis. */
export function splitEqually(amount: number, count: number): number[] {
  if (count <= 0) return []
  const total = Math.round(amount * 100)
  const base = Math.floor(total / count)
  const remainder = total - base * count
  return Array.from({ length: count }, (_, index) =>
    (base + (index < remainder ? 1 : 0)) / 100,
  )
}
