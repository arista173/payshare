import { useNavigate } from 'react-router-dom'
import { Button } from './Button'
import type { ReminderBill } from '../lib/reminders'

type ReminderBannerProps = {
  bills: ReminderBill[]
  onDismiss: () => void
}

export function ReminderBanner({ bills, onDismiss }: ReminderBannerProps) {
  const navigate = useNavigate()

  const groupIds = Array.from(new Set(bills.map((bill) => bill.groupId)))
  const targetGroupId = groupIds.length === 1 ? groupIds[0] : null

  function handleReview() {
    navigate(targetGroupId ? `/groups/${targetGroupId}` : '/groups')
  }

  return (
    <div
      role="alert"
      className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-amber-900">
            You have {bills.length} unpaid bill{bills.length > 1 ? 's' : ''} older than 3 days
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-amber-800">
            {bills.map((bill) => (
              <li key={`${bill.groupId}-${bill.billId}`}>
                {bill.billTitle} — {bill.groupName} ({bill.ageInDays} days ago)
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss reminder"
          className="shrink-0 rounded px-2 text-amber-700 hover:bg-amber-100"
        >
          ×
        </button>
      </div>
      <div className="mt-3">
        <Button onClick={handleReview}>Review Bills</Button>
      </div>
    </div>
  )
}
