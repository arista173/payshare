-- =============================================================================
-- PayShare Demo — Migrasi Fase 3.4: relasi FK group_members -> profiles
-- Tempel ke Supabase SQL Editor lalu Run.
--
-- Masalah:
--   Could not find a relationship between 'group_members' and 'profiles'
--   in the schema cache
--
-- Penyebab: embed PostgREST `profiles ( full_name )` butuh foreign key eksplisit
-- antara kolom yang di-embed dan tabel tujuan. `group_members.user_id`
-- mereferensi auth.users(id), bukan public.profiles(id), sehingga PostgREST
-- tidak tahu relasinya.
--
-- Solusi: tambah FK dari group_members.user_id -> profiles.id. Karena
-- profiles.id sendiri mereferensi auth.users(id) dengan ON DELETE CASCADE,
-- penambahan FK ini konsisten (1:1 dengan user).
-- =============================================================================

alter table public.group_members
  drop constraint if exists group_members_user_profile_fkey;

alter table public.group_members
  add constraint group_members_user_profile_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

-- Muat ulang cache skema PostgREST agar relasi baru dikenali.
notify pgrst, 'reload schema';
