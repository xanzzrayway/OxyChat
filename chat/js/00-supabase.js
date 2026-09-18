// ==== Supabase: client, auth, sistem kredit, sync percakapan ====
// Anon key ini emang didesain buat ditaro di frontend (aman, dibatesin sama RLS policy +
// RPC function security definer di server Supabase, bukan kredensial rahasia kayak service_role).
const SUPABASE_URL = 'https://decfoxbykpcqvaagwtwe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlY2ZveGJ5a3BjcXZhYWd3dHdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5NjE2ODAsImV4cCI6MjEwMDUzNzY4MH0.R4hDp9KFLI4PPNVUyLy5drMDIN9JXWSafsMYdlQJ5U0';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Jatah kredit per plan (dipake pas assign plan baru, dan buat jatah harian yang di-refill tiap hari)
const CREDIT_DEFS = {
  gratis: { awal: 500,  harian: 10 },
  pro:    { awal: 1500, harian: 100 },
  maks:   { awal: 2000, harian: 300 },
  promax: { awal: 5000, harian: 450 }
};

let sbSession = null;   // sesi auth Supabase yang lagi aktif
let sbProfile = null;   // baris public.profiles buat user yang lagi login

async function sbGetSession() {
  const { data } = await sb.auth.getSession();
  sbSession = data.session || null;
  return sbSession;
}

function sbSignInWithGoogle() {
  return sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname }
  });
}

async function sbSignOut() {
  try { await sb.auth.signOut(); } catch (e) {}
  sbSession = null;
  sbProfile = null;
}

// Nunggu baris profiles muncul (trigger on_auth_user_created di server yang bikin, kadang ada jeda dikit)
async function sbFetchProfile(retry) {
  if (!sbSession) return null;
  const { data, error } = await sb.from('profiles').select('*').eq('id', sbSession.user.id).single();
  if (error || !data) {
    if (!retry) { await new Promise(r => setTimeout(r, 900)); return sbFetchProfile(true); }
    console.warn('sbFetchProfile', error);
    return null;
  }
  sbProfile = data;
  return data;
}

async function sbRefreshDailyCredit() {
  if (!sbSession) return null;
  const { data, error } = await sb.rpc('refresh_daily_credit');
  if (error) { console.warn('sbRefreshDailyCredit', error); return null; }
  const row = data && data[0];
  if (row && sbProfile) {
    sbProfile.credit_awal_sisa = row.credit_awal_sisa;
    sbProfile.credit_harian_sisa = row.credit_harian_sisa;
  }
  return row;
}

// Dipanggil abis AI selesai jawab. amount = panjang karakter balasannya (1 huruf = 1 kredit).
// Kalau gagal konek (bukan gara-gara kredit abis), fail-open — jangan sampe user keblokir gara-gara
// koneksi doang, bukan gara-gara kreditnya emang abis.
async function sbDeductCredit(amount) {
  if (!sbSession || amount <= 0) return { allowed: true };
  const { data, error } = await sb.rpc('deduct_credit', { p_amount: amount });
  if (error) { console.warn('sbDeductCredit', error); return { allowed: true }; }
  const row = data && data[0];
  if (row && sbProfile) {
    sbProfile.credit_awal_sisa = row.credit_awal_sisa;
    sbProfile.credit_harian_sisa = row.credit_harian_sisa;
  }
  return row || { allowed: true };
}

async function sbSetUserPlan(plan) {
  if (!sbSession) return;
  const def = CREDIT_DEFS[plan] || CREDIT_DEFS.gratis;
  const { error } = await sb.rpc('set_user_plan', { p_plan: plan, p_credit_awal: def.awal, p_credit_harian: def.harian });
  if (error) { console.warn('sbSetUserPlan', error); return; }
  await sbFetchProfile();
}

function sbCreditTotal() {
  if (!sbProfile) return null;
  return (sbProfile.credit_awal_sisa || 0) + (sbProfile.credit_harian_sisa || 0);
}

// ---- Sinkron percakapan: tiap sesi chat disimpen sebagai satu baris (id sesi = id baris) ----
let sbSaveDebounceTimer = null;
function sbQueueSaveConversation(id, dataObj) {
  if (!sbSession) return;
  clearTimeout(sbSaveDebounceTimer);
  sbSaveDebounceTimer = setTimeout(() => sbSaveConversationNow(id, dataObj), 900);
}
async function sbSaveConversationNow(id, dataObj) {
  if (!sbSession) return;
  const { error } = await sb.from('conversations').upsert({
    id, user_id: sbSession.user.id, data: dataObj, updated_at: new Date().toISOString()
  });
  if (error) console.warn('sbSaveConversationNow', error);
}
async function sbDeleteConversation(id) {
  if (!sbSession) return;
  const { error } = await sb.from('conversations').delete().eq('id', id);
  if (error) console.warn('sbDeleteConversation', error);
}
async function sbLoadAllConversations() {
  if (!sbSession) return null;
  const { data, error } = await sb.from('conversations').select('id, data').eq('user_id', sbSession.user.id);
  if (error) { console.warn('sbLoadAllConversations', error); return null; }
  const out = {};
  (data || []).forEach(row => { out[row.id] = row.data; });
  return out;
}

// ---- Dengerin perubahan status login Supabase (baru login, sesi lama kedeteksi, atau logout) ----
// PENTING: event ini kadang nembak SEBELUM script 03-ui-interactions.js (tempat completeSupabaseLogin
// dkk didefinisiin) selesai dimuat — kalau itu kejadian, dulu event-nya ke-skip diem-diem dan user
// keliatan "nyangkut" balik ke layar login padahal login Google-nya sebenernya udah berhasil.
// Sekarang event-nya dicatet, dan 09-send-status.js bakal coba proses ulang sekali lagi di akhir
// setelah semua fungsi pasti udah ke-load, biar gak pernah ke-skip.
let sbLastAuthEvent = null;
let sbLastAuthSession = null;
function sbDispatchAuthEvent(event, session) {
  if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
    if (typeof completeSupabaseLogin === 'function') { completeSupabaseLogin(); return true; }
  } else if (event === 'SIGNED_OUT') {
    if (typeof handleSupabaseSignOut === 'function') { handleSupabaseSignOut(); return true; }
  } else if (event === 'INITIAL_SESSION' && !session) {
    if (typeof onSupabaseNoSession === 'function') { onSupabaseNoSession(); return true; }
  }
  return false;
}
sb.auth.onAuthStateChange((event, session) => {
  sbSession = session;
  sbLastAuthEvent = event;
  sbLastAuthSession = session;
  sbDispatchAuthEvent(event, session);
});
