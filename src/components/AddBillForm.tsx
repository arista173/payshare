import { useMemo, useState, type FormEvent } from 'react'
import { Button } from './Button'
import { TextField } from './TextField'
import type { GroupMember } from '../lib/groups'
import type { BillParticipant } from '../lib/balance'
import { formatMoney, round2, splitEqually } from '../lib/money'

type SplitMode = 'equal' | 'custom'

type AddBillFormProps = {
  members: GroupMember[]
  submitting: boolean
  onSubmit: (input: {
    title: string
    amount: number
    paidBy: string
    participants: BillParticipant[]
  }) => Promise<void>
  onCancel: () => void
}

const AMOUNT_TOLERANCE = 0.01

export function AddBillForm({
  members,
  submitting,
  onSubmit,
  onCancel,
}: AddBillFormProps) {
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [paidBy, setPaidBy] = useState(members[0]?.userId ?? '')
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(members.map((member) => member.userId)),
  )
  const [mode, setMode] = useState<SplitMode>('equal')
  const [custom, setCustom] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const amountValue = Number(amount) || 0
  const selectedMembers = useMemo(
    () => members.filter((member) => selected.has(member.userId)),
    [members, selected],
  )

  function toggleMember(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  function buildEqualShares(): BillParticipant[] {
    const shares = splitEqually(amountValue, selectedMembers.length)
    return selectedMembers.map((member, index) => ({
      userId: member.userId,
      shareAmount: shares[index],
    }))
  }

  function buildCustomShares(): BillParticipant[] | null {
    const participants = selectedMembers.map((member) => ({
      userId: member.userId,
      shareAmount: round2(Number(custom[member.userId]) || 0),
    }))
    const total = round2(
      participants.reduce((sum, participant) => sum + participant.shareAmount, 0),
    )
    if (Math.abs(total - round2(amountValue)) > AMOUNT_TOLERANCE) return null
    return participants
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!title.trim()) return setError('Bill title is required.')
    if (amountValue <= 0) return setError('Total must be greater than 0.')
    if (!paidBy) return setError('Select who paid.')
    if (selectedMembers.length === 0)
      return setError('Select at least one participant.')

    let participants: BillParticipant[] | null
    if (mode === 'equal') {
      participants = buildEqualShares()
    } else {
      participants = buildCustomShares()
      if (!participants) {
        return setError('Custom amounts must add up to the total.')
      }
    }

    await onSubmit({
      title,
      amount: round2(amountValue),
      paidBy,
      participants,
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5"
    >
      <h2 className="text-base font-semibold text-slate-900">Add Bill</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="billTitle"
          label="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <TextField
          id="billAmount"
          label="Total"
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="billPaidBy" className="text-sm font-medium text-slate-700">
          Paid by
        </label>
        <select
          id="billPaidBy"
          value={paidBy}
          onChange={(event) => setPaidBy(event.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-slate-400"
        >
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.fullName}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-slate-700">Participants</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {members.map((member) => (
            <label
              key={member.userId}
              className="flex items-center gap-2 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                checked={selected.has(member.userId)}
                onChange={() => toggleMember(member.userId)}
              />
              {member.fullName}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-slate-700">Split mode</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="splitMode"
              checked={mode === 'equal'}
              onChange={() => setMode('equal')}
            />
            Equal
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="splitMode"
              checked={mode === 'custom'}
              onChange={() => setMode('custom')}
            />
            Custom
          </label>
        </div>
      </fieldset>

      {mode === 'custom' && (
        <div className="grid gap-2 sm:grid-cols-2">
          {selectedMembers.map((member) => (
            <TextField
              key={member.userId}
              id={`share-${member.userId}`}
              label={member.fullName}
              type="number"
              min="0"
              step="0.01"
              value={custom[member.userId] ?? ''}
              onChange={(event) =>
                setCustom((prev) => ({ ...prev, [member.userId]: event.target.value }))
              }
            />
          ))}
        </div>
      )}

      {mode === 'equal' && selectedMembers.length > 0 && amountValue > 0 && (
        <p className="text-xs text-slate-500">
          Each participant owes{' '}
          {formatMoney(splitEqually(amountValue, selectedMembers.length)[0])}
          {selectedMembers.length > 1 ? ' (rounding adjusted).' : '.'}
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save Bill'}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
