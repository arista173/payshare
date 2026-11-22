-- =============================================================================
-- PayShare Demo — Migrasi Fase 3.3: pembuatan grup atomik via RPC
-- Tempel ke Supabase SQL Editor lalu Run.
--
-- Tujuan: membuat grup dan mendaftarkan pembuatnya sebagai 'owner' dalam satu
-- transaksi. Menghilangkan mode gagal sebagian (grup ada tapi membership
-- hilang -> "Group not found" saat grup dibuka).
-- =============================================================================

create or replace function public.create_group(group_name text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  new_group public.groups;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create a group';
  end if;

  insert into public.groups (name, owner_id)
  values (trim(group_name), auth.uid())
  returning * into new_group;

  insert into public.group_members (group_id, user_id, role)
  values (new_group.id, auth.uid(), 'owner')
  on conflict (group_id, user_id) do nothing;

  return new_group;
end;
$$;

grant execute on function public.create_group(text) to authenticated;
