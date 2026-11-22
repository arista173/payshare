import { supabase } from './supabase'

export type GroupSummary = {
  id: string
  name: string
  inviteCode: string
}

export type GroupMember = {
  userId: string
  fullName: string
  role: 'owner' | 'member'
}

type GroupRow = {
  id: string
  name: string
  invite_code: string
}

type MemberRow = {
  user_id: string
  role: 'owner' | 'member'
  profiles: { full_name: string | null } | { full_name: string | null }[] | null
}

function toGroupSummary(row: GroupRow): GroupSummary {
  return { id: row.id, name: row.name, inviteCode: row.invite_code }
}

export async function listMyGroups(): Promise<GroupSummary[]> {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, invite_code')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data satisfies GroupRow[]).map(toGroupSummary)
}

export async function getGroup(groupId: string): Promise<GroupSummary | null> {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, invite_code')
    .eq('id', groupId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? toGroupSummary(data) : null
}

export async function listGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('user_id, role, profiles ( full_name )')
    .eq('group_id', groupId)
  if (error) throw new Error(error.message)

  return (data as MemberRow[]).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    return {
      userId: row.user_id,
      fullName: profile?.full_name?.trim() || 'No name',
      role: row.role,
    }
  })
}

export async function createGroup(name: string): Promise<GroupSummary> {
  const { data, error } = await supabase.rpc('create_group', {
    group_name: name.trim(),
  })
  if (error) throw new Error(error.message)
  return toGroupSummary(data as GroupRow)
}

export async function joinGroupByCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_group_by_code', {
    code: code.trim().toUpperCase(),
  })
  if (error) throw new Error(error.message)
  return data as string
}
