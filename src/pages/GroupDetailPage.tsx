import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { Button } from '../components/Button'
import { AddBillForm } from '../components/AddBillForm'
import { SettleUpModal } from '../components/SettleUpModal'
import { useAuth } from '../context/auth-context'
import {
  getGroup,
  listGroupMembers,
  type GroupMember,
  type GroupSummary,
} from '../lib/groups'
import {
  createBill,
  listGroupBills,
  listGroupBillsForBalance,
  type BillSummary,
} from '../lib/bills'
import { listGroupSettlements } from '../lib/settlements'
import { payWithWallet } from '../lib/wallet'
import { computeDebts, type Debt } from '../lib/balance'
import { formatMoney } from '../lib/money'

type PendingPayment = {
  to: string
  toName: string
  amount: number
}

export function GroupDetailPage() {
  const { groupId = '' } = useParams()
  const { user } = useAuth()

  const [group, setGroup] = useState<GroupSummary | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [bills, setBills] = useState<BillSummary[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [pending, setPending] = useState<PendingPayment | null>(null)
  const [paying, setPaying] = useState(false)

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true)
    try {
      const groupData = await getGroup(groupId)
      setGroup(groupData)
      if (!groupData) {
        setError(null)
        return
      }
      const [memberData, billData, balanceBills, settlements] = await Promise.all([
        listGroupMembers(groupId),
        listGroupBills(groupId),
        listGroupBillsForBalance(groupId),
        listGroupSettlements(groupId),
      ])
      setMembers(memberData)
      setBills(billData)
      setDebts(computeDebts(balanceBills, settlements))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load group.')
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- fetch on mount
    void load(false)
  }, [load])

  const memberNames = useMemo(
    () => new Map(members.map((member) => [member.userId, member.fullName])),
    [members],
  )

  const myDebts = useMemo(
    () => debts.filter((debt) => debt.from === user?.id),
    [debts, user],
  )

  async function handleCreateBill(input: {
    title: string
    amount: number
    paidBy: string
    participants: { userId: string; shareAmount: number }[]
  }) {
    setSubmitting(true)
    try {
      await createBill({ groupId, ...input })
      setShowForm(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save bill.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePay(amount: number) {
    if (!pending) return
    setPaying(true)
    try {
      await payWithWallet({ toUser: pending.to, groupId, amount })
      setPending(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pay.')
    } finally {
      setPaying(false)
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>

  if (!group) {
    return (
      <>
        <PageHeader title="Group not found" />
        {error && (
          <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <p className="mb-4 text-sm text-slate-500">
          This group may not exist, or you are not a member of it.
        </p>
        <Link to="/groups" className="text-sm font-medium text-slate-900 underline">
          Back to Groups
        </Link>
      </>
    )
  }

  return (
    <>
      <Link to="/groups" className="mb-2 inline-block text-xs text-slate-500 hover:underline">
        ← Groups
      </Link>
      <PageHeader
        title={group.name}
        description={`Invite code: ${group.inviteCode}`}
      />

      {error && (
        <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {myDebts.length > 0 && (
        <section className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-amber-900">Settle up</h2>
          <ul className="flex flex-col gap-2">
            {myDebts.map((debt, index) => {
              const name = memberNames.get(debt.to) ?? 'User'
              return (
                <li
                  key={`${debt.from}-${debt.to}-${index}`}
                  className="flex items-center justify-between gap-3 text-sm text-red-700"
                >
                  <span>
                    You owe {formatMoney(debt.amount)} to {name}
                  </span>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setPending({ to: debt.to, toName: name, amount: debt.amount })
                    }
                  >
                    Pay with Wallet
                  </Button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {showForm ? (
        <div className="mb-6">
          <AddBillForm
            members={members}
            submitting={submitting}
            onSubmit={handleCreateBill}
            onCancel={() => setShowForm(false)}
          />
        </div>
      ) : (
        <div className="mb-6">
          <Button onClick={() => setShowForm(true)}>Add Bill</Button>
        </div>
      )}

      {bills.length === 0 ? (
        <EmptyState message="No bills in this group yet." />
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {bills.map((bill) => (
            <li key={bill.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium text-slate-900">{bill.title}</p>
                <p className="text-xs text-slate-500">
                  Paid by {memberNames.get(bill.paidBy) ?? 'User'}
                </p>
              </div>
              <span className="text-sm font-semibold text-slate-900">
                {formatMoney(bill.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {pending && (
        <SettleUpModal
          toName={pending.toName}
          oweAmount={pending.amount}
          submitting={paying}
          onSubmit={handlePay}
          onClose={() => setPending(null)}
        />
      )}
    </>
  )
}
