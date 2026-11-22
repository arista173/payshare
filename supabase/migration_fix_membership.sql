-- =============================================================================
-- PayShare Demo — Diagnostik & perbaikan "Group not found"
-- Tempel ke Supabase SQL Editor lalu Run.
--
-- "Group not found" tampil saat getGroup() mengembalikan null, artinya RLS
-- SELECT menyembunyikan baris karena user bukan owner dan bukan member.
--
-- File ini:
--   1) Menampilkan grup yang owner-nya belum punya baris group_members.
--   2) Menambal (backfill) baris membership 'owner' yang hilang.
--   Setelah dijalankan, owner bisa membuka kembali grupnya.
-- =============================================================================

-- 1) Lihat grup yang owner-nya belum tercatat sebagai member.
select g.id, g.name, g.owner_id, g.created_at
from public.groups g
left join public.group_members gm
  on gm.group_id = g.id and gm.user_id = g.owner_id
where gm.user_id is null;

-- 2) Tambal membership owner yang hilang.
insert into public.group_members (group_id, user_id, role)
select g.id, g.owner_id, 'owner'
from public.groups g
left join public.group_members gm
  on gm.group_id = g.id and gm.user_id = g.owner_id
where gm.user_id is null
on conflict (group_id, user_id) do nothing;
