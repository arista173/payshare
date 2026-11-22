-- =============================================================================
-- PayShare Demo — Migrasi Fase 4: Wallet simulasi + pembayaran utang
-- Tempel ke Supabase SQL Editor setelah migrasi Fase 1-3. Aman dijalankan ulang.
--
-- Isi:
--   1) transactions.type: izinkan 'topup' & 'payment' (mengganti 'spend').
--   2) Tabel settlements: catatan penyelesaian utang (from_user -> to_user).
--   3) RPC top_up_wallet(amount): tambah saldo + catat transaksi (atomik).
--   4) RPC pay_wallet(to_user, group_id, amount): transfer saldo antar user
--      + catat transaksi 'payment' + catat settlement (atomik, dengan cek saldo).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) transactions.type
-- -----------------------------------------------------------------------------
alter table public.transactions
  drop constraint if exists transactions_type_check;

alter table public.transactions
  add constraint transactions_type_check
  check (type in ('topup', 'payment'));

-- -----------------------------------------------------------------------------
-- 2) settlements: penyelesaian utang (pembayaran sebagian diizinkan).
--    Hutang bersih A->B dikurangi total settlements A->B per grup.
-- -----------------------------------------------------------------------------
create table if not exists public.settlements (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  from_user   uuid not null references auth.users (id) on delete cascade,
  to_user     uuid not null references auth.users (id) on delete cascade,
  amount      numeric(14, 2) not null check (amount > 0),
  created_at  timestamptz not null default now(),
  check (from_user <> to_user)
);

create index if not exists idx_settlements_group
  on public.settlements (group_id);

alter table public.settlements enable row level security;

-- Baca: hanya member grup terkait.
drop policy if exists "settlements_select_member" on public.settlements;
create policy "settlements_select_member" on public.settlements
  for select using (public.is_group_member(group_id));

-- Insert dibatasi lewat RPC pay_wallet (SECURITY DEFINER), tetapi tetap
-- beri policy insert agar konsisten dengan pola RLS lain.
drop policy if exists "settlements_insert_member" on public.settlements;
create policy "settlements_insert_member" on public.settlements
  for insert with check (
    public.is_group_member(group_id) and from_user = auth.uid()
  );

grant select, insert on public.settlements to authenticated;

-- -----------------------------------------------------------------------------
-- 3) RPC top_up_wallet: simulasi top-up (tanpa payment gateway).
-- -----------------------------------------------------------------------------
create or replace function public.top_up_wallet(amount numeric)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance numeric(14, 2);
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  if amount is null or amount <= 0 then
    raise exception 'Top-up amount must be greater than 0';
  end if;

  insert into public.wallets (user_id, balance)
  values (auth.uid(), 0)
  on conflict (user_id) do nothing;

  update public.wallets
    set balance = balance + amount,
        updated_at = now()
    where user_id = auth.uid()
    returning balance into new_balance;

  insert into public.transactions (user_id, type, amount, description)
  values (auth.uid(), 'topup', amount, 'Wallet top-up (demo)');

  return new_balance;
end;
$$;

grant execute on function public.top_up_wallet(numeric) to authenticated;

-- -----------------------------------------------------------------------------
-- 4) RPC pay_wallet: bayar utang dari wallet ke user lain dalam satu grup.
--    - Cek saldo; jika kurang -> raise exception.
--    - Kurangi saldo pengirim, tambah saldo penerima.
--    - Catat transaksi 'payment' untuk pengirim dan penerima.
--    - Catat settlement (from_user -> to_user) untuk grup tsb.
-- -----------------------------------------------------------------------------
create or replace function public.pay_wallet(
  p_to_user uuid,
  p_group_id uuid,
  p_amount numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_balance numeric(14, 2);
  remaining_balance numeric(14, 2);
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than 0';
  end if;
  if p_to_user = auth.uid() then
    raise exception 'You cannot pay yourself';
  end if;
  if not public.is_group_member(p_group_id) then
    raise exception 'You are not a member of this group';
  end if;

  -- Pastikan penerima juga member grup.
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_to_user
  ) then
    raise exception 'Recipient is not a member of this group';
  end if;

  select balance into sender_balance
  from public.wallets
  where user_id = auth.uid()
  for update;

  if sender_balance is null then
    raise exception 'Insufficient balance, please top up';
  end if;
  if sender_balance < p_amount then
    raise exception 'Insufficient balance, please top up';
  end if;

  -- Kurangi saldo pengirim.
  update public.wallets
    set balance = balance - p_amount,
        updated_at = now()
    where user_id = auth.uid()
    returning balance into remaining_balance;

  -- Tambah saldo penerima (buat wallet jika belum ada).
  insert into public.wallets (user_id, balance)
  values (p_to_user, 0)
  on conflict (user_id) do nothing;

  update public.wallets
    set balance = balance + p_amount,
        updated_at = now()
    where user_id = p_to_user;

  -- Catat transaksi.
  insert into public.transactions (user_id, type, amount, description)
  values (auth.uid(), 'payment', p_amount, 'Bill settlement (demo)');

  insert into public.transactions (user_id, type, amount, description)
  values (p_to_user, 'payment', p_amount, 'Bill settlement received (demo)');

  -- Catat settlement.
  insert into public.settlements (group_id, from_user, to_user, amount)
  values (p_group_id, auth.uid(), p_to_user, p_amount);

  return remaining_balance;
end;
$$;

grant execute on function public.pay_wallet(uuid, uuid, numeric) to authenticated;

notify pgrst, 'reload schema';
