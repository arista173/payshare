-- =============================================================================
-- PayShare Demo — Skema Database + Row Level Security
-- Tempel seluruh file ini ke Supabase SQL Editor lalu jalankan (Run).
-- Aman dijalankan ulang: semua objek dibuat dengan IF NOT EXISTS / DROP POLICY IF EXISTS.
-- =============================================================================

create extension if not exists "pgcrypto";

-- =============================================================================
-- TABEL
-- =============================================================================

-- profiles: 1 baris per auth.user
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- groups: grup pembagian biaya
create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- group_members: keanggotaan user di grup
create table if not exists public.group_members (
  group_id    uuid not null references public.groups (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null default 'member' check (role in ('owner', 'member')),
  created_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- FK eksplisit ke profiles agar PostgREST bisa meng-embed
-- `profiles (...)` dari group_members (mis. menampilkan nama anggota).
alter table public.group_members
  drop constraint if exists group_members_user_profile_fkey;
alter table public.group_members
  add constraint group_members_user_profile_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

-- bills: tagihan dalam grup
create table if not exists public.bills (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups (id) on delete cascade,
  title        text not null,
  amount       numeric(14, 2) not null check (amount >= 0),
  paid_by      uuid not null references auth.users (id),
  created_at   timestamptz not null default now()
);

-- bill_participants: siapa menanggung berapa pada sebuah bill
create table if not exists public.bill_participants (
  bill_id      uuid not null references public.bills (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  share_amount numeric(14, 2) not null default 0 check (share_amount >= 0),
  primary key (bill_id, user_id)
);

-- wallets: dompet SIMULASI, 1 per user
create table if not exists public.wallets (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  balance      numeric(14, 2) not null default 0 check (balance >= 0),
  updated_at   timestamptz not null default now()
);

-- transactions: riwayat transaksi dompet SIMULASI
create table if not exists public.transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  type         text not null check (type in ('topup', 'payment')),
  amount       numeric(14, 2) not null check (amount > 0),
  description  text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_group_members_user   on public.group_members (user_id);
create index if not exists idx_bills_group          on public.bills (group_id);
create index if not exists idx_bill_participants_usr on public.bill_participants (user_id);
create index if not exists idx_transactions_user    on public.transactions (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Helper: cek keanggotaan grup tanpa memicu rekursi RLS pada group_members.
-- Dibuat SETELAH tabel group_members (fungsi sql divalidasi saat dibuat).
-- SECURITY DEFINER agar fungsi membaca tabel tanpa terkena policy pemanggil.
-- -----------------------------------------------------------------------------
create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = auth.uid()
  );
$$;

-- =============================================================================
-- TRIGGER: buat profile + wallet otomatis saat user baru mendaftar
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;

  insert into public.wallets (user_id, balance)
  values (new.id, 0)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- RLS: aktifkan di semua tabel
-- =============================================================================
alter table public.profiles          enable row level security;
alter table public.groups            enable row level security;
alter table public.group_members     enable row level security;
alter table public.bills             enable row level security;
alter table public.bill_participants enable row level security;
alter table public.wallets           enable row level security;
alter table public.transactions      enable row level security;

-- -----------------------------------------------------------------------------
-- profiles: user hanya baca/ubah miliknya sendiri
-- -----------------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- -----------------------------------------------------------------------------
-- groups:
--   SELECT : hanya grup tempat user menjadi member
--   INSERT : user boleh membuat grup dengan dirinya sebagai owner
--   UPDATE/DELETE : hanya owner grup
-- -----------------------------------------------------------------------------
drop policy if exists "groups_select_member" on public.groups;
create policy "groups_select_member" on public.groups
  for select using (public.is_group_member(id) or owner_id = auth.uid());

drop policy if exists "groups_insert_owner" on public.groups;
create policy "groups_insert_owner" on public.groups
  for insert with check (owner_id = auth.uid());

drop policy if exists "groups_update_owner" on public.groups;
create policy "groups_update_owner" on public.groups
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "groups_delete_owner" on public.groups;
create policy "groups_delete_owner" on public.groups
  for delete using (owner_id = auth.uid());

-- -----------------------------------------------------------------------------
-- group_members:
--   SELECT : hanya baris pada grup tempat user menjadi member
--   INSERT : user menambah dirinya sendiri ke grup (saat buat grup / join)
--   DELETE : boleh keluar sendiri, atau owner mengeluarkan dari grupnya
-- -----------------------------------------------------------------------------
drop policy if exists "group_members_select_member" on public.group_members;
create policy "group_members_select_member" on public.group_members
  for select using (public.is_group_member(group_id));

drop policy if exists "group_members_insert_self" on public.group_members;
create policy "group_members_insert_self" on public.group_members
  for insert with check (user_id = auth.uid());

drop policy if exists "group_members_delete_self_or_owner" on public.group_members;
create policy "group_members_delete_self_or_owner" on public.group_members
  for delete using (
    user_id = auth.uid()
    or exists (
      select 1 from public.groups g
      where g.id = group_id and g.owner_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- bills: hanya member grup terkait boleh baca; member boleh membuat bill
-- -----------------------------------------------------------------------------
drop policy if exists "bills_select_member" on public.bills;
create policy "bills_select_member" on public.bills
  for select using (public.is_group_member(group_id));

drop policy if exists "bills_insert_member" on public.bills;
create policy "bills_insert_member" on public.bills
  for insert with check (
    public.is_group_member(group_id) and paid_by = auth.uid()
  );

drop policy if exists "bills_update_member" on public.bills;
create policy "bills_update_member" on public.bills
  for update using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

drop policy if exists "bills_delete_member" on public.bills;
create policy "bills_delete_member" on public.bills
  for delete using (public.is_group_member(group_id));

-- -----------------------------------------------------------------------------
-- bill_participants: boleh baca bila member grup dari bill tsb;
--   modifikasi hanya bila user adalah member grup bill tsb
-- -----------------------------------------------------------------------------
drop policy if exists "bill_participants_select_member" on public.bill_participants;
create policy "bill_participants_select_member" on public.bill_participants
  for select using (
    exists (
      select 1 from public.bills b
      where b.id = bill_id and public.is_group_member(b.group_id)
    )
  );

drop policy if exists "bill_participants_insert_member" on public.bill_participants;
create policy "bill_participants_insert_member" on public.bill_participants
  for insert with check (
    exists (
      select 1 from public.bills b
      where b.id = bill_id and public.is_group_member(b.group_id)
    )
  );

drop policy if exists "bill_participants_update_member" on public.bill_participants;
create policy "bill_participants_update_member" on public.bill_participants
  for update using (
    exists (
      select 1 from public.bills b
      where b.id = bill_id and public.is_group_member(b.group_id)
    )
  )
  with check (
    exists (
      select 1 from public.bills b
      where b.id = bill_id and public.is_group_member(b.group_id)
    )
  );

drop policy if exists "bill_participants_delete_member" on public.bill_participants;
create policy "bill_participants_delete_member" on public.bill_participants
  for delete using (
    exists (
      select 1 from public.bills b
      where b.id = bill_id and public.is_group_member(b.group_id)
    )
  );

-- -----------------------------------------------------------------------------
-- wallets: user hanya akses miliknya sendiri
-- -----------------------------------------------------------------------------
drop policy if exists "wallets_select_own" on public.wallets;
create policy "wallets_select_own" on public.wallets
  for select using (user_id = auth.uid());

drop policy if exists "wallets_insert_own" on public.wallets;
create policy "wallets_insert_own" on public.wallets
  for insert with check (user_id = auth.uid());

drop policy if exists "wallets_update_own" on public.wallets;
create policy "wallets_update_own" on public.wallets
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- transactions: user hanya akses miliknya sendiri
-- -----------------------------------------------------------------------------
drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own" on public.transactions
  for select using (user_id = auth.uid());

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own" on public.transactions
  for insert with check (user_id = auth.uid());

-- =============================================================================
-- GRANT: RLS tetap berlaku, tetapi role authenticated/anon butuh privilege tabel.
-- Tanpa ini muncul "permission denied for table ..." (SQLSTATE 42501).
-- =============================================================================
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.profiles          to authenticated;
grant select, insert, update, delete on public.groups            to authenticated;
grant select, insert, update, delete on public.group_members     to authenticated;
grant select, insert, update, delete on public.bills             to authenticated;
grant select, insert, update, delete on public.bill_participants to authenticated;
grant select, insert, update, delete on public.wallets           to authenticated;
grant select, insert, update, delete on public.transactions      to authenticated;

grant execute on function public.is_group_member(uuid) to authenticated;
