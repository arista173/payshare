import { supabase } from './supabase'

export type Wallet = {
  userId: string
  balance: number
  updatedAt: string
}

export type TransactionType = 'topup' | 'payment'

export type Transaction = {
  id: string
  type: TransactionType
  amount: number
  description: string | null
  createdAt: string
}

export type TransactionDirection = 'in' | 'out'

/**
 * Tentukan arah uang: masuk ('in') atau keluar ('out').
 * - Top Up selalu masuk.
 * - Payment masuk bila ini pembayaran yang DITERIMA ("received").
 */
export function transactionDirection(tx: Transaction): TransactionDirection {
  if (tx.type === 'topup') return 'in'
  const description = (tx.description ?? '').toLowerCase()
  return description.includes('received') ? 'in' : 'out'
}

type WalletRow = {
  user_id: string
  balance: number
  updated_at: string
}

type TransactionRow = {
  id: string
  type: TransactionType
  amount: number
  description: string | null
  created_at: string
}

export async function getWallet(userId: string): Promise<Wallet> {
  const { data, error } = await supabase
    .from('wallets')
    .select('user_id, balance, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)

  const row = data as WalletRow | null
  return {
    userId,
    balance: row ? Number(row.balance) : 0,
    updatedAt: row?.updated_at ?? '',
  }
}

export async function listTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, type, amount, description, created_at')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  return (data as TransactionRow[]).map((row) => ({
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    description: row.description,
    createdAt: row.created_at,
  }))
}

/** Simulasi top-up: atomik via RPC. Tanpa payment gateway. */
export async function topUpWallet(amount: number): Promise<number> {
  const { data, error } = await supabase.rpc('top_up_wallet', { amount })
  if (error) throw new Error(error.message)
  return Number(data)
}

/**
 * Bayar utang dari wallet ke user lain dalam grup (atomik via RPC).
 * Cek saldo dilakukan di server; error "Insufficient balance..." diteruskan.
 */
export async function payWithWallet(input: {
  toUser: string
  groupId: string
  amount: number
}): Promise<number> {
  const { data, error } = await supabase.rpc('pay_wallet', {
    p_to_user: input.toUser,
    p_group_id: input.groupId,
    p_amount: input.amount,
  })
  if (error) throw new Error(error.message)
  return Number(data)
}
