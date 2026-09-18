-- ============================================================
-- Qwerty — Skema Supabase (jalanin ini di Supabase SQL Editor)
-- Tabel: profiles, conversations, messages
-- Plus: RLS policy + RPC buat sistem kredit yang aman
-- ============================================================

-- ---------- 1. PROFILES ----------
-- Satu baris per akun (1:1 sama auth.users lewat id).
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  picture text,
  plan text not null default 'gratis',              -- 'gratis' | 'pro' | 'maks' | 'promax'
  credit_awal_sisa integer not null default 500,     -- jatah sekali kasih pas ambil plan
  credit_harian_jatah integer not null default 10,   -- jatah yang di-refill tiap hari sesuai plan
  credit_harian_sisa integer not null default 10,    -- sisa jatah harian buat hari ini
  last_credit_reset date not null default current_date,
  api_key_count integer not null default 0,          -- buat batasin jumlah API key per akun
  plan_chosen boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- ---------- 2. CONVERSATIONS ----------
-- Satu baris = satu sesi chat (persis satu "session" yang udah ada di kode, disimpen apa
-- adanya sebagai JSON di kolom "data"). Ini sengaja gak dipecah per-pesan biar kompatibel
-- langsung sama struktur data yang udah dipakai di seluruh kode chat, jadi risikonya rendah.
create table if not exists public.conversations (
  id text primary key,             -- sama persis sama "id" sesi chat di kode (uid() bikinan JS)
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,             -- { title, messages:[...], tokens, ts, mode }
  updated_at timestamptz not null default now()
);
alter table public.conversations enable row level security;

drop policy if exists "conversations_all_own" on public.conversations;
create policy "conversations_all_own" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists conversations_user_idx on public.conversations(user_id, updated_at desc);

-- ---------- 4. Bikin profile otomatis begitu ada akun baru daftar ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, picture)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
          coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- 5. RPC: potong kredit (dipanggil abis AI selesai jawab) ----------
-- SECURITY DEFINER jadi bisa update row biarpun RLS aktif, TAPI cuma buat baris milik
-- pemanggil sendiri (dicek manual di dalam function, bukan cuma ngandelin RLS).
-- Potongan diambil dari credit_harian_sisa dulu, baru dari credit_awal_sisa kalau kurang.
create or replace function public.deduct_credit(p_amount integer)
returns table(credit_awal_sisa integer, credit_harian_sisa integer, allowed boolean)
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_awal integer;
  v_harian integer;
  v_total integer;
  v_take_harian integer;
  v_take_awal integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select credit_awal_sisa, credit_harian_sisa into v_awal, v_harian
  from public.profiles where id = v_uid for update;

  v_total := coalesce(v_awal,0) + coalesce(v_harian,0);

  if v_total < p_amount then
    -- kredit gak cukup: gak dipotong sama sekali, tandain allowed=false biar frontend munculin popup upgrade
    return query select v_awal, v_harian, false;
    return;
  end if;

  v_take_harian := least(v_harian, p_amount);
  v_take_awal := p_amount - v_take_harian;

  update public.profiles
  set credit_harian_sisa = credit_harian_sisa - v_take_harian,
      credit_awal_sisa = credit_awal_sisa - v_take_awal
  where id = v_uid
  returning credit_awal_sisa, credit_harian_sisa into v_awal, v_harian;

  return query select v_awal, v_harian, true;
end;
$$;

-- ---------- 6. RPC: refill kredit harian kalau udah ganti hari ----------
-- Dipanggil pas app dibuka / login. Aman dipanggil berkali-kali (gak dobel refill di hari yang sama).
create or replace function public.refresh_daily_credit()
returns table(credit_awal_sisa integer, credit_harian_sisa integer)
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_jatah integer;
  v_last date;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select credit_harian_jatah, last_credit_reset into v_jatah, v_last
  from public.profiles where id = v_uid for update;

  if v_last < current_date then
    update public.profiles
    set credit_harian_sisa = v_jatah,
        last_credit_reset = current_date
    where id = v_uid;
  end if;

  return query select p.credit_awal_sisa, p.credit_harian_sisa
  from public.profiles p where p.id = v_uid;
end;
$$;

-- ---------- 7. RPC: ganti plan (dipanggil pas approve redeem code / upgrade) ----------
-- PENTING: aman dipanggil berkali-kali (idempotent). Pertama kali milih plan sama sekali,
-- kredit awal di-SET langsung (bukan ditambah ke default kolom yang udah 500/10 dari awal —
-- itu penyebab bug kredit dobel jadi 1K/1.5K). Baru kalau BENERAN ganti ke plan yang beda dari
-- yang sekarang, kredit awal ditambah (bonus upgrade). Kalau plan-nya sama kayak sekarang dan
-- emang udah pernah dipilih sebelumnya, gak ngapa-ngapain sama sekali (no-op).
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
