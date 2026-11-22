-- =============================================================================
-- PayShare Demo — Migrasi Fase 3.5: pesan exception RPC ke bahasa Inggris
-- Tempel ke Supabase SQL Editor lalu Run.
--
-- Pesan dari `raise exception` di dalam fungsi SQL ikut tampil ke user lewat
-- error Supabase, jadi harus berbahasa Inggris seperti teks UI lainnya.
-- =============================================================================

-- join_group_by_code: kode salah
create or replace function public.join_group_by_code(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_group_id uuid;
begin
  select id into target_group_id
  from public.groups
  where invite_code = upper(trim(code));

  if target_group_id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (target_group_id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return target_group_id;
end;
$$;

grant execute on function public.join_group_by_code(text) to authenticated;

-- create_group: belum login
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

notify pgrst, 'reload schema';
