import { describe, expect, it } from 'vitest'
import {
  billStatusesForUser,
  computeDebts,
  netBalanceForUser,
  type BillForBalance,
  type BillStatusInput,
} from './balance'

describe('computeDebts', () => {
  it('satu bill split rata: setiap peserta berutang share-nya ke pembayar', () => {
    const bills: BillForBalance[] = [
      {
        paidBy: 'A',
        amount: 300,
        participants: [
          { userId: 'A', shareAmount: 100 },
          { userId: 'B', shareAmount: 100 },
          { userId: 'C', shareAmount: 100 },
        ],
      },
    ]

    expect(computeDebts(bills)).toEqual(
      expect.arrayContaining([
        { from: 'B', to: 'A', amount: 100 },
        { from: 'C', to: 'A', amount: 100 },
      ]),
    )
    expect(computeDebts(bills)).toHaveLength(2)
  })

  it('satu bill custom: transfer sesuai nominal share masing-masing', () => {
    const bills: BillForBalance[] = [
      {
        paidBy: 'A',
        amount: 500,
        participants: [
          { userId: 'A', shareAmount: 100 },
          { userId: 'B', shareAmount: 400 },
        ],
      },
    ]

    expect(computeDebts(bills)).toEqual([{ from: 'B', to: 'A', amount: 400 }])
  })

  it('rantai A->B, B->C disederhanakan menjadi A->C tanpa B', () => {
    // Bill 1: B membayar 500, A menanggung penuh => A berutang B 500.
    // Bill 2: C membayar 500, B menanggung penuh => B berutang C 500.
    const bills: BillForBalance[] = [
      {
        paidBy: 'B',
        amount: 500,
        participants: [{ userId: 'A', shareAmount: 500 }],
      },
      {
        paidBy: 'C',
        amount: 500,
        participants: [{ userId: 'B', shareAmount: 500 }],
      },
    ]

    const debts = computeDebts(bills)

    expect(debts).toHaveLength(1)
    expect(debts[0]).toEqual({ from: 'A', to: 'C', amount: 500 })
    expect(debts.some((d) => d.from === 'B' || d.to === 'B')).toBe(false)
  })

  it('settlement pembayaran sebagian mengurangi sisa utang', () => {
    const bills: BillForBalance[] = [
      {
        paidBy: 'B',
        amount: 100,
        participants: [{ userId: 'A', shareAmount: 100 }],
      },
    ]

    // A sudah membayar 40 ke B; sisa utang A->B = 60.
    const debts = computeDebts(bills, [{ from: 'A', to: 'B', amount: 40 }])

    expect(debts).toEqual([{ from: 'A', to: 'B', amount: 60 }])
  })

  it('settlement penuh membuat utang menjadi nol', () => {
    const bills: BillForBalance[] = [
      {
        paidBy: 'B',
        amount: 100,
        participants: [{ userId: 'A', shareAmount: 100 }],
      },
    ]

    const debts = computeDebts(bills, [{ from: 'A', to: 'B', amount: 100 }])

    expect(debts).toEqual([])
  })

  it('netBalanceForUser: positif bila berutang, berkurang oleh settlement', () => {
    const bills: BillForBalance[] = [
      {
        paidBy: 'B',
        amount: 100,
        participants: [{ userId: 'A', shareAmount: 100 }],
      },
    ]

    expect(netBalanceForUser(bills, [], 'A')).toBe(100)
    expect(netBalanceForUser(bills, [{ from: 'A', to: 'B', amount: 60 }], 'A')).toBe(40)
    expect(netBalanceForUser(bills, [{ from: 'A', to: 'B', amount: 100 }], 'A')).toBe(0)
  })
})

describe('billStatusesForUser', () => {
  function bill(
    id: string,
    createdAt: string,
    paidBy: string,
    amount: number,
    participants: { userId: string; shareAmount: number }[],
  ): BillStatusInput {
    return { id, createdAt, paidBy, amount, participants }
  }

  it('hanya bill yang bagiannya belum dibayar yang Unpaid', () => {
    // Bill lama: A berutang 100. Bill baru: A berutang 100 lagi.
    // A sudah membayar 100 -> lunas bill TERTUA, bill baru tetap Unpaid.
    const bills = [
      bill('old', '2026-01-01T00:00:00Z', 'B', 100, [{ userId: 'A', shareAmount: 100 }]),
      bill('new', '2026-01-10T00:00:00Z', 'B', 100, [{ userId: 'A', shareAmount: 100 }]),
    ]

    const statuses = billStatusesForUser(
      bills,
      [{ from: 'A', to: 'B', amount: 100 }],
      'A',
    )

    expect(statuses.get('old')).toBe('paid')
    expect(statuses.get('new')).toBe('unpaid')
  })

  it('bill tanpa bagian user dianggap paid', () => {
    const bills = [
      bill('b1', '2026-01-01T00:00:00Z', 'A', 100, [{ userId: 'B', shareAmount: 100 }]),
    ]

    expect(billStatusesForUser(bills, [], 'A').get('b1')).toBe('paid')
  })

  it('tanpa settlement, semua bagian user Unpaid', () => {
    const bills = [
      bill('b1', '2026-01-01T00:00:00Z', 'B', 100, [{ userId: 'A', shareAmount: 100 }]),
      bill('b2', '2026-01-02T00:00:00Z', 'B', 50, [{ userId: 'A', shareAmount: 50 }]),
    ]

    const statuses = billStatusesForUser(bills, [], 'A')
    expect(statuses.get('b1')).toBe('unpaid')
    expect(statuses.get('b2')).toBe('unpaid')
  })
})
