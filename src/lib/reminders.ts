import {
  billStatusesForUser,
  type BillForBalance,
  type SettlementForBalance,
} from './balance'

export type ReminderBillInput = BillForBalance & {
  id: string
  title: string
  createdAt: string
}

export type GroupReminderInput = {
  groupId: string
  groupName: string
  bills: ReminderBillInput[]
  settlements: SettlementForBalance[]
}

export type ReminderBill = {
  billId: string
  billTitle: string
  groupId: string
  groupName: string
  ageInDays: number
}

export type ReminderResult = {
  count: number
  bills: ReminderBill[]
  /** Grup unik yang memiliki bill menunggak. */
  groupIds: string[]
}

const HOUR_MS = 60 * 60 * 1000
const MIN_AGE_HOURS = 72

/**
 * Parse tanggal ISO dari Supabase menjadi timestamp (epoch ms, UTC).
 *
 * Supabase menyimpan `timestamptz` dan mengembalikannya dalam ISO dengan
 * penanda `Z`/offset. Bila suatu saat string tanpa zona waktu (mis.
 * "2026-11-22 08:00:00"), JS akan menganggapnya waktu LOKAL, bukan UTC.
 * Untuk mencegah bug zona waktu, string tanpa offset dipaksa dianggap UTC.
 *
 * Mengembalikan `null` bila tanggal tidak valid, agar bill yang datanya
 * bermasalah TIDAK dianggap overdue.
 */
function parseUtcTimestamp(value: string): number | null {
  if (!value) return null

  const hasTimezone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(value)
  const normalized = hasTimezone ? value : `${value.replace(' ', 'T')}Z`
  const time = new Date(normalized).getTime()

  return Number.isNaN(time) ? null : time
}

/**
 * Deteksi bill lama yang masih membuat `userId` berutang.
 *
 * Aturan (fungsi murni, tanpa Supabase):
 * - Status per bill dihitung dengan `billStatusesForUser` (FIFO settlement),
 *   sehingga hanya bill yang bagian user-nya BELUM lunas yang dipertimbangkan.
 * - Bill dianggap overdue hanya bila status-nya 'unpaid' DAN umurnya LEBIH DARI
 *   72 jam (3 hari penuh) sejak `created_at` (UTC).
 * - Bill yang baru dibuat hari ini (selisih < 72 jam) TIDAK pernah ditandai.
 *
 * `now` bisa diinjeksi untuk testing.
 */
export function findOverdueBills(
  groups: GroupReminderInput[],
  userId: string,
  now: Date = new Date(),
): ReminderResult {
  const bills: ReminderBill[] = []
  const nowMs = now.getTime()

  for (const group of groups) {
    const statuses = billStatusesForUser(
      group.bills.map((bill) => ({
        id: bill.id,
        createdAt: bill.createdAt,
        paidBy: bill.paidBy,
        amount: bill.amount,
        participants: bill.participants,
      })),
      group.settlements,
      userId,
    )

    for (const bill of group.bills) {
      if (statuses.get(bill.id) !== 'unpaid') continue

      const createdMs = parseUtcTimestamp(bill.createdAt)
      if (createdMs === null) continue

      const ageMs = nowMs - createdMs
      // Overdue hanya bila LEBIH DARI 72 jam; bill hari ini (ageMs kecil) tidak.
      if (ageMs <= MIN_AGE_HOURS * HOUR_MS) continue

      bills.push({
        billId: bill.id,
        billTitle: bill.title,
        groupId: group.groupId,
        groupName: group.groupName,
        ageInDays: Math.floor(ageMs / (24 * HOUR_MS)),
      })
    }
  }

  bills.sort((a, b) => b.ageInDays - a.ageInDays)

  const groupIds = Array.from(new Set(bills.map((bill) => bill.groupId)))

  return { count: bills.length, bills, groupIds }
}
