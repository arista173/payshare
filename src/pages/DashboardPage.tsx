import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { Button } from '../components/Button'
import { SettleUpModal } from '../components/SettleUpModal'
import { ReminderBanner } from '../components/ReminderBanner'
import { useAuth } from '../context/auth-context'
import { listMyGroups } from '../lib/groups'
import { listGroupBillsForReminder } from '../lib/bills'
import { listGroupSettlements } from '../lib/settlements'
import { payWithWallet } from '../lib/wallet'
import { computeDebts, type Debt } from '../lib/balance'
import { findOverdueBills, type ReminderBill } from '../lib/reminders'
import { formatMoney } from '../lib/money'
import { supabase } from '../lib/supabase'

type GroupDebt = {
  groupId: string
  groupName: string
  debts: Debt[]
}

type PendingPayment = {
  groupId: string
  to: string
  toName: string
  amount: number
}

export function DashboardPage() {
  const { user } = useAuth()
  const [groupDebts, setGroupDebts] = useState<GroupDebt[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingPayment | null>(null)
  const [paying, setPaying] = useState(false)
  const [reminders, setReminders] = useState<ReminderBill[]>([])
  const [reminderDismissed, setReminderDismissed] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    try {
      const groups = await listMyGroups()
      const perGroup = await Promise.all(
        groups.map(async (group) => {
          const [bills, settlements] = await Promise.all([
            listGroupBillsForReminder(group.id),
            listGroupSettlements(group.id),
          ])
          return {
            groupId: group.id,
            groupName: group.name,
            bills,
            settlements,
            debts: computeDebts(bills, settlements),
          }
        }),
      )

      const reminderResult = findOverdueBills(
        perGroup.map((group) => ({
          groupId: group.groupId,
          groupName: group.groupName,
          bills: group.bills,
          settlements: group.settlements,
        })),
        user.id,
      )

      const userIds = new Set<string>()
      for (const group of perGroup) {
        for (const debt of group.debts) {
          if (debt.from === user.id) userIds.add(debt.to)
          if (debt.to === user.id) userIds.add(debt.from)
        }
      }

      const nameMap = new Map<string, string>()
      if (userIds.size > 0) {
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', Array.from(userIds))
        if (profileError) throw new Error(profileError.message)
        for (const profile of data ?? []) {
          nameMap.set(profile.id, profile.full_name?.trim() || 'No name')
        }
      }

      setGroupDebts(
        perGroup.filter((group) =>
          group.debts.some((debt) => debt.from === user.id || debt.to === user.id),
        ),
      )
      setNames(nameMap)
      setReminders(reminderResult.bills)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load summary.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- fetch on mount
    void load()
  }, [load])

  async function handlePay(amount: number) {
    if (!pending) return
    setPaying(true)
    try {
      await payWithWallet({
        toUser: pending.to,
        groupId: pending.groupId,
        amount,
      })
      setPending(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pay.')
    } finally {
      setPaying(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your activity and balance overview."
      />

      {!loading && reminders.length > 0 && !reminderDismissed && (
        <ReminderBanner
          bills={reminders}
          onDismiss={() => setReminderDismissed(true)}
        />
      )}

      {error && (
        <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : groupDebts.length === 0 ? (
        <EmptyState message="No active debts. Everything is settled." />
      ) : (
        <div className="flex flex-col gap-4">
          {groupDebts.map((group) => (
            <section
              key={group.groupId}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <Link
                to={`/groups/${group.groupId}`}
                className="text-sm font-semibold text-slate-900 hover:underline"
              >
                {group.groupName}
              </Link>
              <ul className="mt-2 flex flex-col gap-2">
                {group.debts
                  .filter((debt) => debt.from === user?.id || debt.to === user?.id)
                  .map((debt, index) => {
                    const iOwe = debt.from === user?.id
                    const counterpart = iOwe ? debt.to : debt.from
                    const name = names.get(counterpart) ?? 'User'
                    return (
                      <li
                        key={`${debt.from}-${debt.to}-${index}`}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        {iOwe ? (
                          <span className="text-red-700">
                            You owe {formatMoney(debt.amount)} to {name}
                          </span>
                        ) : (
                          <span className="text-emerald-700">
                            {name} owes you {formatMoney(debt.amount)}
                          </span>
                        )}
                        {iOwe && (
                          <Button
                            variant="ghost"
                            onClick={() =>
                              setPending({
                                groupId: group.groupId,
                                to: debt.to,
                                toName: name,
                                amount: debt.amount,
                              })
                            }
                          >
                            Pay with Wallet
                          </Button>
                        )}
                      </li>
                    )
                  })}
              </ul>
            </section>
          ))}
        </div>
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
