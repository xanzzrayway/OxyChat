// GANTI ini dengan URL server lo (dari cloudflared tunnel di Termux)
const SERVER_URL = 'https://server.qwertychat.my.id';
localStorage.setItem('oxychat_server_url_v1', SERVER_URL);

// ==== Device id (dipakai buat identifikasi ringan, BUKAN buat ban) ====
const LS_DEVICE_ID = 'oxychat_device_id_v1';
function getDeviceId() {
  let id = localStorage.getItem(LS_DEVICE_ID);
  if (!id) {
    id = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12);
    localStorage.setItem(LS_DEVICE_ID, id);
  }
  return id;
}

// ==== Auto-update checker ====
// Biar user gak perlu manual hapus data browser tiap ada update.
// APP_VERSION di sini HARUS sama dengan isi version.json — begitu kamu deploy versi baru,
// update angka ini + isi version.json (bisa pake timestamp, format bebas asal beda tiap deploy).
const APP_VERSION = '20260823112950';
function checkForAppUpdate() {
  fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (data && data.version && data.version !== APP_VERSION) showUpdateToast();
    })
    .catch(() => {});
}
function showUpdateToast() {
  if (document.getElementById('app-update-toast')) return;
  const boot = () => {
    const el = document.createElement('div');
    el.id = 'app-update-toast';
    el.innerHTML = 'Ada update baru <button id="app-update-refresh-btn" type="button">Refresh</button>';
    document.body.appendChild(el);
    document.getElementById('app-update-refresh-btn').onclick = () => location.reload();
  };
  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);
}
checkForAppUpdate();
setInterval(checkForAppUpdate, 5 * 60 * 1000); // cek ulang tiap 5 menit
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForAppUpdate(); });

// Model-model ini dipanggil lewat provider NVIDIA, sisanya default ke Groq.
// Routing API key & base URL sekarang ditangani di server, bukan di sini.
const NVIDIA_MODELS = [
  'nvidia/llama-3.3-nemotron-super-49b-v1.5', // Oxy Nemotron
  'deepseek-ai/deepseek-r1',                  // Oxy DeepSeek R1
  'meta/llama-3.3-70b-instruct',              // Oxy Llama 70B N
];
// Spectrax: model gabungan, coba Gemini dulu, fallback ke NVIDIA kalau gagal (logic-nya ada di server)
const SPECTRAX_MODELS = [
  'spectrax',
];
// Model-model ini dipanggil lewat provider Mistral
const MISTRAL_MODELS = [
  'vaneus-4.0',
];
// Model-model ini dipanggil lewat provider Perplexity (Sonar)
const PERPLEXITY_MODELS = [
  'sonar-reasoning-pro',
  'sonar-pro',
  'sonar',
  'sonar-deep-research',
];
function getProviderName(modelValue) {
  if (SPECTRAX_MODELS.includes(modelValue)) return 'spectrax';
  if (NVIDIA_MODELS.includes(modelValue)) return 'nvidia';
  if (MISTRAL_MODELS.includes(modelValue)) return 'mistral';
  if (PERPLEXITY_MODELS.includes(modelValue)) return 'perplexity';
  return 'groq';
}
async function callOxyAPI(modelValue, body, extraOpts = {}) {
  try {
    // SERVER_URL.replace(...) buang trailing slash biar gak jadi dobel slash pas digabung '/api/chat'
    const res = await fetch(SERVER_URL.replace(/\/+$/, '') + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-Id': getDeviceId() },
      body: JSON.stringify({ provider: getProviderName(modelValue), ...body }),
      ...extraOpts
    });
    if (typeof document !== 'undefined') document.getElementById('server-down-banner')?.classList.remove('show');
    return res;
  } catch (err) {
    if (err.name !== 'AbortError' && typeof document !== 'undefined') {
      document.getElementById('server-down-banner')?.classList.add('show');
    }
    throw err;
  }
}
const VISION_MODEL = 'qwen/qwen3.6-27b';
const VISION_CAPABLE_MODELS = [VISION_MODEL];
const LS_KEY    = 'oxychat_sessions_v1';
const LS_ACTIVE = 'oxychat_active_v1';
const LS_MODEL  = 'oxychat_model_v1';
const LS_NAME   = 'oxychat_username_v1';
const LS_PICTURE = 'oxychat_userpicture_v1';
const LS_EMAIL   = 'oxychat_useremail_v1';
const LS_THEME  = 'oxychat_theme_v1';
const LS_FONT   = 'oxychat_font_v1';
const LS_UISIZE = 'oxychat_uisize_v1';
const LS_TEXTSIZE = 'oxychat_textsize_v1';
const LS_CUSTOM_INSTR = 'oxychat_custom_instr_v1';
const LS_CHATMODE = 'oxychat_chatmode_v1';
let userPicture = localStorage.getItem(LS_PICTURE) || '';
let userEmail = localStorage.getItem(LS_EMAIL) || '';
const LS_GOOGLE_NAME = 'oxychat_google_name_v1';
const LS_GOOGLE_PICTURE = 'oxychat_google_picture_v1';
const LS_IS_TRIAL = 'oxychat_is_trial_v1';
const LS_PLAN = 'oxychat_plan_v1';
const LS_PLAN_CHOSEN = 'oxychat_plan_chosen_v1';
const LS_SPECTRAX_UNLOCK = 'oxychat_spectrax_unlock_until_v1';

// ==== Penanda akun (biar tiap akun Google beda storage & riwayat chat) ====
// accountKey() balikin id unik per akun: 'g_<email>' buat akun Google, 'trial' buat mode uji coba,
// atau '' (bucket lama/anonim) kalau belum ada yang login sama sekali.
function sanitizeAcctPart(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '_'); }
function accountKey() {
  if (userEmail) return 'g_' + sanitizeAcctPart(userEmail);
  if (localStorage.getItem(LS_IS_TRIAL) === '1') return 'trial';
  return '';
}
function scopedKey(base) {
  const ak = accountKey();
  return ak ? (base + '__' + ak) : base;
}
// Sekali pindah dari versi lama (storage global) ke versi per-akun ini, data lama (kalau ada)
// dipindah otomatis ke akun Google pertama yang login, biar riwayat chat lama gak hilang.
function migrateLegacyAccountData(targetAk) {
  if (!targetAk) return;
  [LS_KEY, LS_ACTIVE, LS_PLAN, LS_PLAN_CHOSEN].forEach(base => {
    const legacyVal = localStorage.getItem(base);
    const scoped = base + '__' + targetAk;
    if (legacyVal !== null && localStorage.getItem(scoped) === null) {
      localStorage.setItem(scoped, legacyVal);
      localStorage.removeItem(base);
    }
  });
}

const PLANS = {
  gratis: { label: 'Paket Awal', keyLimit: '1x', msgLimit: '10', harga: 'FREE' },
  pro:    { label: 'Paket Pro', keyLimit: '5x', msgLimit: '15', harga: '10K' },
  maks:   { label: 'Paket Maks', keyLimit: '10x', msgLimit: '30', harga: '15K' }
};
const LS_MSG_COUNT = 'oxychat_msgcount_v1';
const LS_MSG_WINDOW_START = 'oxychat_msgwindow_v1';
const MSG_LIMIT_WINDOW_MS = 15 * 60 * 1000; // reset tiap 15 menit
function getMsgWindowStart() {
  const v = parseInt(localStorage.getItem(scopedKey(LS_MSG_WINDOW_START)) || '0', 10);
  return isNaN(v) ? 0 : v;
}
function ensureMsgWindowFresh() {
  const start = getMsgWindowStart();
  const now = Date.now();
  if (!start) {
    localStorage.setItem(scopedKey(LS_MSG_WINDOW_START), String(now));
    return;
  }
  if (now - start >= MSG_LIMIT_WINDOW_MS) {
    localStorage.setItem(scopedKey(LS_MSG_WINDOW_START), String(now));
    localStorage.setItem(scopedKey(LS_MSG_COUNT), '0');
  }
}
function getMsgCount() {
  ensureMsgWindowFresh();
  const v = parseInt(localStorage.getItem(scopedKey(LS_MSG_COUNT)) || '0', 10);
  return isNaN(v) ? 0 : v;
}
function incrementMsgCount() {
  ensureMsgWindowFresh();
  const v = getMsgCount() + 1;
  localStorage.setItem(scopedKey(LS_MSG_COUNT), String(v));
  updateLimitBannerUI();
  return v;
}
function resetMsgCount() {
  localStorage.setItem(scopedKey(LS_MSG_COUNT), '0');
  localStorage.setItem(scopedKey(LS_MSG_WINDOW_START), String(Date.now()));
  updateLimitBannerUI();
}
function getMsgWindowRemainingMs() {
  const start = getMsgWindowStart();
  if (!start) return 0;
  const remain = MSG_LIMIT_WINDOW_MS - (Date.now() - start);
  return remain > 0 ? remain : 0;
}
function getCurrentMsgLimit() {
  const p = PLANS[currentPlan] || PLANS.gratis;
  return parseInt(p.msgLimit, 10) || 0;
}
function isMsgLimitReached() {
  return getMsgCount() >= getCurrentMsgLimit();
}
function formatMmSs(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m + ':' + String(s).padStart(2, '0');
}
function updateLimitBannerUI() {
  const banner = document.getElementById('limit-banner');
  const inputBox = document.getElementById('input-box');
  const timerBox = document.getElementById('limit-timer-box');
  const timerText = document.getElementById('limit-timer-text');
  if (!banner || !inputBox) return;
  const reached = isMsgLimitReached();
  banner.classList.toggle('show', reached);
  inputBox.classList.toggle('limit-locked', reached);
  if (timerBox) timerBox.classList.toggle('show', reached);
  if (reached && timerText) {
    const remain = getMsgWindowRemainingMs();
    timerText.textContent = 'Reset dalam ' + formatMmSs(remain);
  }
}
setInterval(() => { updateLimitBannerUI(); }, 1000);
let currentPlan = localStorage.getItem(scopedKey(LS_PLAN)) || 'gratis';
let pendingPlanChoice = null;
function applyPlan(p) {
  if (!PLANS[p]) p = 'gratis';
  currentPlan = p;
  localStorage.setItem(scopedKey(LS_PLAN), currentPlan);
}
// Kode redeem: isi manual di sini nanti.
// Format plan penuh:      'KODENYA': { plan: 'pro' } atau { plan: 'maks' }
// Format buka model sementara: 'KODENYA': { unlockModel: 'spectrax', hours: 24 }
const REDEEM_CODES = {
  'SPECTRAX2026PRO': { unlockModel: 'spectrax', hours: 24 },
};
function getSpectraxUnlockUntil() {
  const v = parseInt(localStorage.getItem(scopedKey(LS_SPECTRAX_UNLOCK)) || '0', 10);
  return isNaN(v) ? 0 : v;
}
function isSpectraxUnlocked() { return Date.now() < getSpectraxUnlockUntil(); }

const MODELS = [
  { group:'Model', items:[
    { label:'Spectrax', value:'spectrax', pro:true, icon:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L2 12.5h12L8 1.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8 1.5v11M4.7 7h6.6M3.3 9.7h9.4" stroke="currentColor" stroke-width="0.9" stroke-linecap="round" opacity="0.55"/></svg>' },
    { label:'Vaneus 4.0', value:'vaneus-4.0', pro:true, icon:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l6-2.5L14 4v5c0 3-2.5 5.5-6 6.5-3.5-1-6-3.5-6-6.5V4z"/><path d="M6 8l1.5 1.5L11 6"/></svg>' },
    { label:'Oxy Nemotron', value:'nvidia/llama-3.3-nemotron-super-49b-v1.5', icon:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 5l6 6M11 5l-6 6"/></svg>' },
    { label:'Oxy Sonar Reasoning', value:'sonar-reasoning-pro', icon:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M8 8l3.2-3.2M8 4v1.2M8 12v-1.2M4 8h1.2M12 8h-1.2"/></svg>' },
    { label:'Oxy DeepSeek R1', value:'deepseek-ai/deepseek-r1', icon:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="5.5"/><path d="M8 5v3l2 2"/></svg>' },
    { label:'Oxy Llama 70B N', value:'meta/llama-3.3-70b-instruct', icon:'<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 12l4-8 2 4 2-4 4 8z"/></svg>' },
    { label:'Oxy Sonar Pro', value:'sonar-pro', icon:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M8 8l3.2-3.2M8 4v1.2M8 12v-1.2M4 8h1.2M12 8h-1.2"/></svg>' },
    { label:'Oxy Sonar', value:'sonar', icon:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M8 8l3.2-3.2M8 4v1.2M8 12v-1.2M4 8h1.2M12 8h-1.2"/></svg>' },
    { label:'Oxy Sonar Deep Research', value:'sonar-deep-research', icon:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="4.5"/><path d="M10.3 10.3L14 14"/></svg>' },
    { label:'Oxy Thinking', value:'qwen/qwen3.6-27b', icon:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5.6 2.3c-1.3 0-2.3 1-2.3 2.3 0 .4.1.8.3 1.1-1 .3-1.7 1.2-1.7 2.3 0 1 .6 1.9 1.5 2.2-.1.3-.2.6-.2 1 0 1.4 1.2 2.6 2.6 2.6.4 0 .8-.1 1.1-.3V3.7c-.3-.8-.8-1.4-1.3-1.4z"/><path d="M10.4 2.3c1.3 0 2.3 1 2.3 2.3 0 .4-.1.8-.3 1.1 1 .3 1.7 1.2 1.7 2.3 0 1-.6 1.9-1.5 2.2.1.3.2.6.2 1 0 1.4-1.2 2.6-2.6 2.6-.4 0-.8-.1-1.1-.3V3.7c.3-.8.8-1.4 1.3-1.4z"/></svg>' },
    { label:'Oxy Ultra', value:'openai/gpt-oss-120b', icon:'<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style="transform:rotate(45deg)"><path d="M12 1.5C14.2 3.6 15.5 6.8 15.5 10c0 2.2-.6 4.2-1.7 5.8L12 18l-1.8-2.2C9.1 14.2 8.5 12.2 8.5 10c0-3.2 1.3-6.4 3.5-8.5zM9.3 13.2L5.8 16.8v3.4l3.5-3.7zM14.7 13.2l3.5 3.6v3.4l-3.5-3.7zM12 18l-1.7 3.3L12 20l1.7 1.3z"/></svg>' },
    { label:'Oxy Expert', value:'llama-3.3-70b-versatile', icon:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.6a4.4 4.4 0 00-2.4 8.1c.3.2.5.6.5 1v.4h3.8v-.4c0-.4.2-.8.5-1A4.4 4.4 0 008 1.6z"/><line x1="6.4" y1="13.6" x2="9.6" y2="13.6"/><line x1="6.8" y1="15" x2="9.2" y2="15"/></svg>' },
    { label:'Oxy Fast', value:'llama-3.1-8b-instant', icon:'<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8.6 1.2L3.4 8.6h3.3l-.9 6.2 5.8-7.7H8.3l.3-5.9z"/></svg>' },
    { label:'Oxy Vision', value:'openai/gpt-oss-20b', icon:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z"/><circle cx="8" cy="8" r="2"/></svg>' },
  ]},
];

let sessions = {};
