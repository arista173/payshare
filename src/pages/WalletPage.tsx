import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { Button } from '../components/Button'
import { TopUpModal } from '../components/TopUpModal'
import { useAuth } from '../context/auth-context'
import {
  getWallet,
  listTransactions,
  topUpWallet,
  transactionDirection,
  type Transaction,
} from '../lib/wallet'
import { formatMoney } from '../lib/money'

export function WalletPage() {
  const { user } = useAuth()
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showTopUp, setShowTopUp] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async (showSpinner = true) => {
    if (!user) return
    if (showSpinner) setLoading(true)
    try {
      const [wallet, txs] = await Promise.all([
        getWallet(user.id),
        listTransactions(),
      ])
      setBalance(wallet.balance)
      setTransactions(txs)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wallet.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- fetch on mount
    void load(false)
  }, [load])

  async function handleTopUp(amount: number) {
    setSubmitting(true)
    try {
      const newBalance = await topUpWallet(amount)
      setBalance(newBalance)
      setShowTopUp(false)
      await load(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to top up.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Wallet"
        description="Simulated balance and transaction history."
      />

      {error && (
        <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mb-6 flex items-center justify-between rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <p className="text-sm text-slate-500">Current balance</p>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <p className="text-2xl font-semibold text-slate-900">
              {formatMoney(balance)}
            </p>
          )}
        </div>
        <Button onClick={() => setShowTopUp(true)}>Top Up</Button>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-slate-900">Transaction history</h2>
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : transactions.length === 0 ? (
        <EmptyState message="No transactions yet." />
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {transactions.map((tx) => {
            const isIncoming = transactionDirection(tx) === 'in'
            return (
              <li key={tx.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={[
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-semibold',
                      isIncoming
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-red-50 text-red-700',
                    ].join(' ')}
                  >
                    {isIncoming ? '↓' : '↑'}
                  </span>
                  <div>
                    <p className="font-medium text-slate-900">
                      {isIncoming ? 'Money In' : 'Money Out'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {tx.description ?? '—'}
                      {' · '}
                      {new Date(tx.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <span
                  className={[
                    'shrink-0 text-sm font-semibold',
                    isIncoming ? 'text-emerald-700' : 'text-red-700',
                  ].join(' ')}
                >
                  {isIncoming ? '+' : '−'}
                  {formatMoney(tx.amount)}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {showTopUp && (
        <TopUpModal
          submitting={submitting}
          onSubmit={handleTopUp}
          onClose={() => setShowTopUp(false)}
        />
      )}
    </>
  )
}
