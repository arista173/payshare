import { describe, expect, it } from 'vitest'
import { findOverdueBills, type GroupReminderInput } from './reminders'

const NOW = new Date('2026-01-10T12:00:00Z')

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

describe('findOverdueBills', () => {
  it('mendeteksi bill >3 hari yang masih membuat user berutang', () => {
    const groups: GroupReminderInput[] = [
      {
        groupId: 'g1',
        groupName: 'Trip',
        bills: [
          {
            id: 'b1',
            title: 'Dinner',
            createdAt: daysAgo(4),
            paidBy: 'B',
            amount: 100,
            participants: [{ userId: 'A', shareAmount: 100 }],
          },
        ],
        settlements: [],
      },
    ]

    const result = findOverdueBills(groups, 'A', NOW)

    expect(result.count).toBe(1)
    expect(result.bills[0].billTitle).toBe('Dinner')
    expect(result.bills[0].ageInDays).toBe(4)
    expect(result.groupIds).toEqual(['g1'])
  })

  it('mengabaikan bill yang umurnya <= 3 hari', () => {
    const groups: GroupReminderInput[] = [
      {
        groupId: 'g1',
        groupName: 'Trip',
        bills: [
          {
            id: 'b1',
            title: 'Lunch',
            createdAt: daysAgo(2),
            paidBy: 'B',
            amount: 100,
            participants: [{ userId: 'A', shareAmount: 100 }],
          },
        ],
        settlements: [],
      },
    ]

    expect(findOverdueBills(groups, 'A', NOW).count).toBe(0)
  })

  it('mengabaikan bill lama bila utang user sudah lunas via settlement', () => {
    const groups: GroupReminderInput[] = [
      {
        groupId: 'g1',
        groupName: 'Trip',
        bills: [
          {
            id: 'b1',
            title: 'Dinner',
            createdAt: daysAgo(5),
            paidBy: 'B',
            amount: 100,
            participants: [{ userId: 'A', shareAmount: 100 }],
          },
        ],
        settlements: [{ from: 'A', to: 'B', amount: 100 }],
      },
    ]

    expect(findOverdueBills(groups, 'A', NOW).count).toBe(0)
  })

  it('tidak menandai bill bila user tidak berutang (justru berpiutang)', () => {
    const groups: GroupReminderInput[] = [
      {
        groupId: 'g1',
        groupName: 'Trip',
        bills: [
          {
            id: 'b1',
            title: 'Dinner',
            createdAt: daysAgo(5),
            paidBy: 'A',
            amount: 100,
            participants: [{ userId: 'B', shareAmount: 100 }],
          },
        ],
        settlements: [],
      },
    ]

    expect(findOverdueBills(groups, 'A', NOW).count).toBe(0)
  })

  it('bill yang dibuat hari ini TIDAK overdue', () => {
    const groups: GroupReminderInput[] = [
      {
        groupId: 'g1',
        groupName: 'Trip',
        bills: [
          {
            id: 'b1',
            title: 'Just created',
            createdAt: new Date(NOW.getTime() - 60 * 1000).toISOString(),
            paidBy: 'B',
            amount: 100,
            participants: [{ userId: 'A', shareAmount: 100 }],
          },
        ],
        settlements: [],
      },
    ]

    expect(findOverdueBills(groups, 'A', NOW).count).toBe(0)
  })

  it('tepat 72 jam belum overdue, lebih dari 72 jam baru overdue', () => {
    function withCreated(msAgo: number): GroupReminderInput[] {
      return [
        {
          groupId: 'g1',
          groupName: 'Trip',
          bills: [
            {
              id: 'b1',
              title: 'Boundary',
              createdAt: new Date(NOW.getTime() - msAgo).toISOString(),
              paidBy: 'B',
              amount: 100,
              participants: [{ userId: 'A', shareAmount: 100 }],
            },
          ],
          settlements: [],
        },
      ]
    }

    const HOUR = 60 * 60 * 1000
    expect(findOverdueBills(withCreated(72 * HOUR), 'A', NOW).count).toBe(0)
    expect(findOverdueBills(withCreated(72 * HOUR + 1000), 'A', NOW).count).toBe(1)
  })

  it('string tanggal tanpa zona waktu diperlakukan sebagai UTC', () => {
    // 4 hari lalu, diformat TANPA 'Z' (mis. "2026-01-06T12:00:00").
    const fourDaysAgoNoTz = new Date(NOW.getTime() - 4 * 24 * 60 * 60 * 1000)
      .toISOString()
      .replace('Z', '')

    const groups: GroupReminderInput[] = [
      {
        groupId: 'g1',
        groupName: 'Trip',
        bills: [
          {
            id: 'b1',
            title: 'No timezone',
            createdAt: fourDaysAgoNoTz,
            paidBy: 'B',
            amount: 100,
            participants: [{ userId: 'A', shareAmount: 100 }],
          },
        ],
        settlements: [],
      },
    ]

    expect(findOverdueBills(groups, 'A', NOW).count).toBe(1)
  })

  it('tanggal tidak valid tidak dianggap overdue', () => {
    const groups: GroupReminderInput[] = [
      {
        groupId: 'g1',
        groupName: 'Trip',
        bills: [
          {
            id: 'b1',
            title: 'Broken date',
            createdAt: '',
            paidBy: 'B',
            amount: 100,
            participants: [{ userId: 'A', shareAmount: 100 }],
          },
        ],
        settlements: [],
      },
    ]

    expect(findOverdueBills(groups, 'A', NOW).count).toBe(0)
  })

  it('bill baru di grup dengan bill lama hanya menandai bill lama', () => {
    const groups: GroupReminderInput[] = [
      {
        groupId: 'g1',
        groupName: 'Trip',
        bills: [
          {
            id: 'old',
            title: 'Old bill',
            createdAt: daysAgo(4),
            paidBy: 'B',
            amount: 100,
            participants: [{ userId: 'A', shareAmount: 100 }],
          },
          {
            id: 'new',
            title: 'New bill',
            createdAt: new Date(NOW.getTime() - 60 * 1000).toISOString(),
            paidBy: 'B',
            amount: 50,
            participants: [{ userId: 'A', shareAmount: 50 }],
          },
        ],
        settlements: [],
      },
    ]

    const result = findOverdueBills(groups, 'A', NOW)

    expect(result.count).toBe(1)
    expect(result.bills[0].billId).toBe('old')
    expect(result.bills.some((bill) => bill.billId === 'new')).toBe(false)
  })
})
