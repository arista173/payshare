import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { useAuth } from '../context/auth-context'
import { listAllBills, type AllBillsRow } from '../lib/bills'
import { listGroupSettlements } from '../lib/settlements'
import { billStatusesForUser, type BillStatus } from '../lib/balance'
import { formatMoney } from '../lib/money'

type Filter = 'all' | 'unpaid' | 'paid'

type BillItem = AllBillsRow & {
  status: BillStatus
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'paid', label: 'Paid' },
]

export function BillsPage() {
  const { user } = useAuth()
  const [bills, setBills] = useState<BillItem[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    try {
      const all = await listAllBills()

      // Kelompokkan bill per grup untuk menghitung status per bill,
      // mengingat settlement adalah per grup.
      const byGroup = new Map<string, AllBillsRow[]>()
      for (const bill of all) {
        const groupBills = byGroup.get(bill.groupId) ?? []
        groupBills.push(bill)
        byGroup.set(bill.groupId, groupBills)
      }

      const statusByBill = new Map<string, BillStatus>()
      await Promise.all(
        Array.from(byGroup.entries()).map(async ([groupId, groupBills]) => {
          const settlements = await listGroupSettlements(groupId)
          const statuses = billStatusesForUser(
            groupBills.map((bill) => ({
              id: bill.id,
              createdAt: bill.createdAt,
              paidBy: bill.paidBy,
              amount: bill.amount,
              participants: bill.participants,
            })),
            settlements,
            user.id,
          )
          for (const [billId, status] of statuses) {
            statusByBill.set(billId, status)
          }
        }),
      )

      setBills(
        all.map((bill) => ({
          ...bill,
          status: statusByBill.get(bill.id) ?? 'paid',
        })),
      )
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bills.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- fetch on mount
    void load()
  }, [load])

  const visible = bills.filter((bill) =>
    filter === 'all' ? true : bill.status === filter,
  )

  return (
    <>
      <PageHeader
        title="Bills"
        description="All bills across the groups you belong to."
      />

      {error && (
        <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mb-4 flex gap-1">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={[
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              filter === item.key
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100',
            ].join(' ')}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : bills.length === 0 ? (
        <EmptyState message="No bills yet. Create a group to get started." />
      ) : visible.length === 0 ? (
        <EmptyState message={`No ${filter} bills.`} />
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {visible.map((bill) => (
            <li key={bill.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{bill.title}</p>
                <p className="text-xs text-slate-500">
                  <Link
                    to={`/groups/${bill.groupId}`}
                    className="hover:underline"
                  >
                    {bill.groupName}
                  </Link>
                  {' · '}
                  {new Date(bill.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm font-semibold text-slate-900">
                  {formatMoney(bill.amount)}
                </span>
                <StatusBadge status={bill.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function StatusBadge({ status }: { status: BillStatus }) {
  return status === 'paid' ? (
    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
      Paid
    </span>
  ) : (
    <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
      Unpaid
    </span>
  )
}
