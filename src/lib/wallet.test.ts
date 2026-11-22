import { describe, expect, it } from 'vitest'
import { transactionDirection, type Transaction } from './wallet'

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: 'x',
    type: 'payment',
    amount: 100,
    description: null,
    createdAt: new Date().toISOString(),
    ...partial,
  }
}

describe('transactionDirection', () => {
  it('top up selalu masuk', () => {
    expect(transactionDirection(tx({ type: 'topup', description: 'Wallet top-up' }))).toBe(
      'in',
    )
  })

  it('payment "received" adalah uang masuk', () => {
    expect(
      transactionDirection(tx({ type: 'payment', description: 'Bill settlement received' })),
    ).toBe('in')
  })

  it('payment biasa adalah uang keluar', () => {
    expect(
      transactionDirection(tx({ type: 'payment', description: 'Bill settlement' })),
    ).toBe('out')
  })
})
