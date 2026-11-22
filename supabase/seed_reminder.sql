-- =============================================================================
-- PayShare Demo — Seeder untuk menguji fitur Reminder (Fase 5)
-- Tempel ke Supabase SQL Editor lalu Run.
--
-- Membuat 1 bill BERUMUR 4 HARI di salah satu grup Anda, dengan Anda sebagai
-- peserta dan orang lain sebagai pembayar -> Anda berutang -> reminder muncul.
--
-- CARA PAKAI:
--   1) Di bagian "GANTI EMAIL" di bawah, ubah 'you@example.com' menjadi email
--      akun yang Anda pakai login.
--   2) Jalankan seluruh file di SQL Editor.
--   3) Buka Dashboard -> banner "You have 1 unpaid bill older than 3 days".
--
-- Catatan: SQL Editor berjalan sebagai role postgres sehingga auth.uid() NULL,
-- jadi kita memilih user berdasarkan email.
-- =============================================================================

with target as (
  select id as user_id
  from auth.users
  where email = 'demo1@example.com'   -- <<< GANTI EMAIL DI SINI
),
pick as (
  select
    g.id as group_id,
    coalesce(
      (select gm.user_id
         from public.group_members gm
        where gm.group_id = g.id and gm.user_id <> t.user_id
        limit 1),
      t.user_id
    ) as payer_id,
    t.user_id as member_id
  from target t
  join public.group_members me on me.user_id = t.user_id
  join public.groups g on g.id = me.group_id
  order by g.created_at
  limit 1
),
new_bill as (
  insert into public.bills (group_id, title, amount, paid_by, created_at)
  select group_id, 'Overdue dinner (test)', 100, payer_id, now() - interval '4 days'
  from pick
  returning id
)
insert into public.bill_participants (bill_id, user_id, share_amount)
select nb.id, pick.member_id, 100
from new_bill nb
cross join pick;

-- Verifikasi bill baru & umurnya.
select id, title, amount, paid_by, created_at,
       date_part('day', now() - created_at) as age_days
from public.bills
where title = 'Overdue dinner (test)'
order by created_at desc;

-- =============================================================================
-- ALTERNATIF CEPAT: jadikan bill yang SUDAH ADA berumur 4 hari,
-- agar reminder langsung muncul tanpa insert bill baru.
-- Ganti 'you@example.com' lalu jalankan blok UPDATE ini.
-- =============================================================================
-- update public.bills
--   set created_at = now() - interval '4 days'
--   where group_id in (
--     select gm.group_id
--     from public.group_members gm
--     join auth.users u on u.id = gm.user_id
--     where u.email = 'you@example.com'
--   );
