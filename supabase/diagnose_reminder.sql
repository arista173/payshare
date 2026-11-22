-- =============================================================================
-- PayShare — Diagnostik Reminder: cek umur bill sebenarnya
-- Tempel ke Supabase SQL Editor lalu Run.
--
-- Ganti 'you@example.com' dengan email akun Anda.
-- Hasilnya menunjukkan setiap bill di grup Anda beserta umur (jam) sebenarnya.
-- Bill dengan age_hours > 72 DAN bagian Anda belum lunas yang akan muncul
-- sebagai reminder.
-- =============================================================================

select
  b.id,
  b.title,
  g.name as group_name,
  b.created_at,
  now() as now_utc,
  round(extract(epoch from (now() - b.created_at)) / 3600.0, 2) as age_hours,
  (extract(epoch from (now() - b.created_at)) / 3600.0) > 72 as is_older_than_72h,
  bp.share_amount as my_share
from public.bills b
join public.groups g on g.id = b.group_id
join public.group_members gm on gm.group_id = g.id
join auth.users u on u.id = gm.user_id
left join public.bill_participants bp
  on bp.bill_id = b.id and bp.user_id = u.id
where u.email = 'you@example.com'
order by b.created_at asc;

-- Jika ada bill "Overdue dinner (test)" atau bill lain dengan created_at lama
-- yang tidak Anda sadari, itulah yang muncul di reminder. Untuk menghapusnya:
--
-- delete from public.bills where title = 'Overdue dinner (test)';
