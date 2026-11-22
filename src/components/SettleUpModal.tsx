import { useState, type FormEvent } from 'react'
import { Button } from './Button'
import { TextField } from './TextField'
import { formatMoney, round2 } from '../lib/money'

type SettleUpModalProps = {
  toName: string
  oweAmount: number
  submitting: boolean
  onSubmit: (amount: number) => Promise<void>
  onClose: () => void
}

export function SettleUpModal({
  toName,
  oweAmount,
  submitting,
  onSubmit,
  onClose,
}: SettleUpModalProps) {
  const [amount, setAmount] = useState(String(round2(oweAmount)))
  const [error, setError] = useState<string | null>(null)

  const amountValue = Number(amount) || 0

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (amountValue <= 0) {
      setError('Payment amount must be greater than 0.')
      return
    }
    if (round2(amountValue) > round2(oweAmount)) {
      setError('Payment cannot exceed the amount you owe.')
      return
    }
    await onSubmit(round2(amountValue))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settle-title"
    >
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
        <h2 id="settle-title" className="mb-1 text-lg font-semibold text-slate-900">
          Pay with Wallet
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Demo Mode — this is a simulated payment, no real money moves.
        </p>

        <p className="mb-4 text-sm text-slate-700">
          You owe {toName} {formatMoney(oweAmount)}.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <TextField
            id="settleAmount"
            label="Amount to pay"
            type="number"
            min="0"
            step="0.01"
            autoFocus
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />

          {error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Processing…' : 'Pay'}
            </Button>
            <Button variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
