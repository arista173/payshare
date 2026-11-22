import { supabase } from './supabase'
import type { BillForBalance, BillParticipant } from './balance'

export type BillSummary = {
  id: string
  title: string
  amount: number
  paidBy: string
  createdAt: string
}

export type BillWithGroupRow = BillRow & {
  group_id: string
  groups: { name: string } | { name: string }[] | null
  bill_participants: { user_id: string; share_amount: number }[]
}

export type AllBillsRow = {
  id: string
  title: string
  amount: number
  paidBy: string
  createdAt: string
  groupId: string
  groupName: string
  participants: BillParticipant[]
}

/**
 * Ambil semua bill lintas grup yang diikuti user (memanfaatkan RLS:
 * hanya grup tempat user member yang terlihat).
 */
export async function listAllBills(): Promise<AllBillsRow[]> {
  const { data, error } = await supabase
    .from('bills')
    .select(
      'id, title, amount, paid_by, created_at, group_id, groups ( name ), bill_participants ( user_id, share_amount )',
    )
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  return (data as BillWithGroupRow[]).map((row) => {
    const group = Array.isArray(row.groups) ? row.groups[0] : row.groups
    return {
      id: row.id,
      title: row.title,
      amount: Number(row.amount),
      paidBy: row.paid_by,
      createdAt: row.created_at,
      groupId: row.group_id,
      groupName: group?.name ?? 'Unknown group',
      participants: (row.bill_participants ?? []).map((participant) => ({
        userId: participant.user_id,
        shareAmount: Number(participant.share_amount),
      })),
    }
  })
}

export type CreateBillInput = {
  groupId: string
  title: string
  amount: number
  paidBy: string
  participants: BillParticipant[]
}

type BillRow = {
  id: string
  title: string
  amount: number
  paid_by: string
  created_at: string
}

type BillWithParticipantsRow = BillRow & {
  bill_participants: { user_id: string; share_amount: number }[]
}

export type BillForReminder = {
  id: string
  title: string
  createdAt: string
  paidBy: string
  amount: number
  participants: BillParticipant[]
}

function toBillSummary(row: BillRow): BillSummary {
  return {
    id: row.id,
    title: row.title,
    amount: Number(row.amount),
    paidBy: row.paid_by,
    createdAt: row.created_at,
  }
}

export async function listGroupBills(groupId: string): Promise<BillSummary[]> {
  const { data, error } = await supabase
    .from('bills')
    .select('id, title, amount, paid_by, created_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as BillRow[]).map(toBillSummary)
}

export async function listGroupBillsForBalance(
  groupId: string,
): Promise<BillForBalance[]> {
  const { data, error } = await supabase
    .from('bills')
    .select('paid_by, amount, bill_participants ( user_id, share_amount )')
    .eq('group_id', groupId)
  if (error) throw new Error(error.message)

  return (data as BillWithParticipantsRow[]).map((row) => ({
    paidBy: row.paid_by,
    amount: Number(row.amount),
    participants: row.bill_participants.map((participant) => ({
      userId: participant.user_id,
      shareAmount: Number(participant.share_amount),
    })),
  }))
}

export async function listGroupBillsForReminder(
  groupId: string,
): Promise<BillForReminder[]> {
  const { data, error } = await supabase
    .from('bills')
    .select(
      'id, title, created_at, paid_by, amount, bill_participants ( user_id, share_amount )',
    )
    .eq('group_id', groupId)
  if (error) throw new Error(error.message)

  return (data as BillWithParticipantsRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    paidBy: row.paid_by,
    amount: Number(row.amount),
    participants: row.bill_participants.map((participant) => ({
      userId: participant.user_id,
      shareAmount: Number(participant.share_amount),
    })),
  }))
}

export async function createBill(input: CreateBillInput): Promise<void> {
  const { data: bill, error: billError } = await supabase
    .from('bills')
    .insert({
      group_id: input.groupId,
      title: input.title.trim(),
      amount: input.amount,
      paid_by: input.paidBy,
    })
    .select('id')
    .single()
  if (billError) throw new Error(billError.message)

  const rows = input.participants.map((participant) => ({
    bill_id: bill.id,
    user_id: participant.userId,
    share_amount: participant.shareAmount,
  }))

  const { error: participantError } = await supabase
    .from('bill_participants')
    .insert(rows)
  if (participantError) {
    await supabase.from('bills').delete().eq('id', bill.id)
    throw new Error(participantError.message)
  }
}
