type DemoBannerProps = {
  className?: string
}

export function DemoBanner({ className = '' }: DemoBannerProps) {
  return (
    <div
      role="status"
      className={[
        'rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900',
        className,
      ].join(' ')}
    >
      Demo Mode — balances and payments are simulated
    </div>
  )
}
