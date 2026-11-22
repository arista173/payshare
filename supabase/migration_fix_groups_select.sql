-- =============================================================================
-- PayShare Demo — Migrasi Fase 3.2: perbaikan policy SELECT groups
-- Tempel ke Supabase SQL Editor lalu Run.
--
-- Masalah: createGroup() melakukan `.insert(...).select().single()`.
-- Saat RETURNING, Postgres menerapkan SELECT policy pada baris baru. Karena
-- baris membership belum dibuat (dibuat setelah insert), is_group_member(id)
-- masih false sehingga muncul:
--   new row violates row-level security policy for table "groups"
--
-- Perbaikan: pemilik grup juga boleh SELECT grup miliknya. Aman karena
-- owner_id = auth.uid() hanya berlaku untuk grup yang ia buat.
-- =============================================================================

drop policy if exists "groups_select_member" on public.groups;
create policy "groups_select_member" on public.groups
  for select using (public.is_group_member(id) or owner_id = auth.uid());
