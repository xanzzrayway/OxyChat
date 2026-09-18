-- ============================================================
-- FIX BUG: kredit dobel jadi 1K/1.5K pas pilih plan
-- Jalanin SEMUA isi file ini di Supabase SQL Editor (Run sekali aja)
-- ============================================================

-- 1) Ganti function set_user_plan jadi versi yang aman dipanggil berkali-kali
create or replace function public.set_user_plan(p_plan text, p_credit_awal integer, p_credit_harian integer)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_already_chosen boolean;
  v_current_plan text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select plan_chosen, plan into v_already_chosen, v_current_plan
  from public.profiles where id = v_uid for update;

  if not v_already_chosen then
    update public.profiles
    set plan = p_plan,
        credit_awal_sisa = p_credit_awal,
        credit_harian_jatah = p_credit_harian,
        credit_harian_sisa = p_credit_harian,
        plan_chosen = true
    where id = v_uid;
  elsif v_current_plan is distinct from p_plan then
    update public.profiles
    set plan = p_plan,
        credit_awal_sisa = credit_awal_sisa + p_credit_awal,
        credit_harian_jatah = p_credit_harian,
        credit_harian_sisa = p_credit_harian
    where id = v_uid;
  end if;
end;
$$;

-- 2) Benerin angka kredit yang udah kadung nyangkut kegedean (dari bug lama) buat SEMUA akun
--    yang paketnya "gratis" (soalnya cuma paket itu yang bisa dipilih sendiri sejauh ini).
--    Ini nge-reset paksa balik ke default paket gratis: 500 awal + 10 harian.
--    Kalau kamu punya banyak user asli yang sisa kreditnya udah kepake, HATI-HATI jalanin ini —
--    tapi kalau baru kamu doang yang testing, aman langsung jalanin.
update public.profiles
set credit_awal_sisa = 500,
    credit_harian_jatah = 10,
    credit_harian_sisa = 10
where plan = 'gratis';
