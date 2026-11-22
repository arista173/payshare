import { supabase } from './supabase'
import type { SettlementForBalance } from './balance'

type SettlementRow = {
  from_user: string
  to_user: string
  amount: number
}

export async function listGroupSettlements(
  groupId: string,
): Promise<SettlementForBalance[]> {
  const { data, error } = await supabase
    .from('settlements')
    .select('from_user, to_user, amount')
    .eq('group_id', groupId)
  if (error) throw new Error(error.message)

  return (data as SettlementRow[]).map((row) => ({
    from: row.from_user,
    to: row.to_user,
    amount: Number(row.amount),
  }))
}
