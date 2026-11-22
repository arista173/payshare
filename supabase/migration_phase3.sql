-- =============================================================================
-- PayShare Demo — Migrasi Fase 3 (lanjutan schema awal)
-- Tempel ke Supabase SQL Editor setelah migration.sql sebelumnya.
-- Aman dijalankan ulang.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Kode undangan 6 karakter (A-Z, 0-9 tanpa 0/O/1/I) pada groups.
-- -----------------------------------------------------------------------------
create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

alter table public.groups
  add column if not exists invite_code text;

update public.groups
  set invite_code = public.generate_invite_code()
  where invite_code is null;

alter table public.groups
  alter column invite_code set default public.generate_invite_code();
alter table public.groups
  alter column invite_code set not null;

create unique index if not exists groups_invite_code_key
  on public.groups (invite_code);

-- -----------------------------------------------------------------------------
-- RPC join_group_by_code: cari grup via kode lalu daftarkan pemanggil sebagai member.
-- SECURITY DEFINER agar bisa membaca baris groups (yang belum terlihat via RLS)
-- berdasarkan kode persis, tanpa membuka seluruh tabel.
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Pembuatan grup: user membuat grup (insert groups) lalu mendaftarkan dirinya
-- sebagai member ber-role 'owner'. Policy insert member sudah mengizinkan
-- user_id = auth.uid(), sehingga insert diri sendiri sebagai owner sah.
-- Tidak perlu perubahan policy tambahan di sini.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- Profiles: agar bisa menampilkan nama anggota lain di grup yang sama.
-- User boleh membaca profil rekan yang berbagi minimal satu grup.
-- Fungsi SECURITY DEFINER menghindari rekursi RLS pada group_members.
-- -----------------------------------------------------------------------------
create or replace function public.shares_group_with(target_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members me
    join public.group_members them on them.group_id = me.group_id
    where me.user_id = auth.uid()
      and them.user_id = target_user_id
  );
$$;

drop policy if exists "profiles_select_group_peers" on public.profiles;
create policy "profiles_select_group_peers" on public.profiles
  for select using (public.shares_group_with(id));

