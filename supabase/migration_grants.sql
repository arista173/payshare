-- =============================================================================
-- PayShare Demo — Migrasi Fase 3.1: GRANT akses tabel ke role Supabase Auth
-- Tempel ke Supabase SQL Editor lalu Run.
--
-- RLS mengatur BARIS mana yang boleh diakses, tetapi role `authenticated` /
-- `anon` tetap butuh GRANT level tabel. Tanpa ini muncul error:
--   permission denied for table groups (SQLSTATE 42501)
-- RLS tetap berlaku, jadi user hanya melihat baris sesuai policy.
-- =============================================================================

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.profiles          to authenticated;
grant select, insert, update, delete on public.groups            to authenticated;
grant select, insert, update, delete on public.group_members     to authenticated;
grant select, insert, update, delete on public.bills             to authenticated;
grant select, insert, update, delete on public.bill_participants to authenticated;
grant select, insert, update, delete on public.wallets           to authenticated;
grant select, insert, update, delete on public.transactions      to authenticated;

-- Fungsi helper yang dipanggil dari policy / RPC.
grant execute on function public.is_group_member(uuid)   to authenticated;
grant execute on function public.shares_group_with(uuid) to authenticated;
grant execute on function public.join_group_by_code(text) to authenticated;
