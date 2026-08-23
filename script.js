// GANTI ini dengan URL server lo (dari cloudflared tunnel di Termux)
const SERVER_URL = 'https://server.qwertychat.my.id/';
localStorage.setItem('oxychat_server_url_v1', SERVER_URL);

// ==== Anti-Jailbreak: device id + ban permanen dari server ====
// Device id dikirim di tiap request biar server bisa nge-ban perangkat spesifik,
// bukan cuma nge-ban IP (yang bisa gampang ganti/gonta-ganti jaringan).
const LS_DEVICE_ID = 'oxychat_device_id_v1';
const LS_BANNED = 'oxychat_banned_v1';

function getDeviceId() {
  let id = localStorage.getItem(LS_DEVICE_ID);
  if (!id) {
    id = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12);
    localStorage.setItem(LS_DEVICE_ID, id);
  }
  return id;
}

// Nampilin overlay ban full-screen yang gak bisa ditutup user.
// Ini dipanggil (a) begitu app dibuka kalau device ini udah pernah kena ban sebelumnya,
// atau (b) begitu server balikin sinyal banned:true di request manapun.
function showJailbreakBan(reason) {
  try {
    localStorage.setItem(LS_BANNED, JSON.stringify({ banned: true, reason: reason || 'Kami Telah Mendeteksi Jailbreak', ts: Date.now() }));
  } catch (e) {}
  document.documentElement.style.overflow = 'hidden';
  const boot = () => {
    document.body.classList.add('jb-banned');
    const overlay = document.getElementById('jailbreak-ban-overlay');
    const reasonEl = document.getElementById('jb-ban-reason');
    if (reasonEl) reasonEl.textContent = reason || 'Kami Telah Mendeteksi Jailbreak';
    if (overlay) overlay.classList.add('show');
    const app = document.getElementById('app');
    if (app) app.style.display = 'none';
  };
  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);
}

// Cek paling awal (sebelum apapun di-render) apakah device ini udah kena ban permanen.
(function checkExistingBan() {
  try {
    const raw = localStorage.getItem(LS_BANNED);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data && data.banned) showJailbreakBan(data.reason);
  } catch (e) {}
})();

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
  // Kalau device ini udah kena ban permanen, jangan kirim request apapun lagi ke server.
  try {
    const raw = localStorage.getItem(LS_BANNED);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.banned) { showJailbreakBan(d.reason); throw new Error('DEVICE_BANNED'); }
    }
  } catch (e) { if (e && e.message === 'DEVICE_BANNED') throw e; }

  try {
    const res = await fetch(SERVER_URL + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-Id': getDeviceId() },
      body: JSON.stringify({ provider: getProviderName(modelValue), ...body }),
      ...extraOpts
    });
    if (typeof document !== 'undefined') document.getElementById('server-down-banner')?.classList.remove('show');

    // Server ngedeteksi jailbreak / device lagi banned -> langsung tampilin popup permanen.
    if (res.status === 403) {
      let payload = null;
      try { payload = await res.clone().json(); } catch (e) {}
      if (payload && payload.banned) {
        showJailbreakBan(payload.reason || 'Kami Telah Mendeteksi Jailbreak');
      }
    }
    return res;
  } catch (err) {
    if (err.name !== 'AbortError' && err.message !== 'DEVICE_BANNED' && typeof document !== 'undefined') {
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
let activeId = null;
let isStreaming = false;
let activeDraftFlush = null; // dipanggil kalo tab/app di-background pas AI lagi ngetik, biar draft ke-save duluan
let abortController = null;
let userScrolledUp = false;
let webSearchEnabled = false;
let imageGenModeActive = false;
let userName = localStorage.getItem(LS_NAME) || '';
let activeStream = null; // { sessionId, full, rebind(container) } - biar streaming gak hilang pas pindah chat
let chatMode = localStorage.getItem(LS_CHATMODE) || 'normal'; // 'normal' | 'multi'

function getAllModels() {
  const list = [];
  MODELS.forEach(g => g.items.forEach(m => list.push(m)));
  return list;
}
const MODEL_COLORS = {
  'qwen/qwen3.6-27b': '#3b82f6',
  'openai/gpt-oss-120b': '#a855f7',
  'llama-3.3-70b-versatile': '#10b981',
  'llama-3.1-8b-instant': '#f59e0b',
  'openai/gpt-oss-20b': '#ec4899',
  'spectrax': '#f5b400',
  'vaneus-4.0': '#fa5b30',
  'nvidia/llama-3.3-nemotron-super-49b-v1.5': '#76b900',
  'deepseek-ai/deepseek-r1': '#76b900',
  'meta/llama-3.3-70b-instruct': '#76b900',
  'sonar-reasoning-pro': '#20808d',
  'sonar-pro': '#20808d',
  'sonar': '#20808d',
  'sonar-deep-research': '#20808d'
};
const MODEL_SUBS = {
  'qwen/qwen3.6-27b': 'Reasoning · Deep',
  'openai/gpt-oss-120b': 'Model · 120B',
  'llama-3.3-70b-versatile': 'Meta · 70B',
  'llama-3.1-8b-instant': 'Instan · 8B',
  'openai/gpt-oss-20b': 'Vision · Baca Gambar',
  'spectrax': 'Gemini · Auto',
  'vaneus-4.0': 'Mistral · Large',
  'nvidia/llama-3.3-nemotron-super-49b-v1.5': 'NVIDIA · 49B Reasoning',
  'deepseek-ai/deepseek-r1': 'NVIDIA · DeepSeek R1',
  'meta/llama-3.3-70b-instruct': 'NVIDIA · Llama 70B',
  'sonar-reasoning-pro': 'Perplexity · Reasoning + Web',
  'sonar-pro': 'Perplexity · Pro Search',
  'sonar': 'Perplexity · Cepat',
  'sonar-deep-research': 'Perplexity · Riset Mendalam'
};
function getModelColor(value) { return MODEL_COLORS[value] || '#8b8b9a'; }
function getModelSub(value) { return MODEL_SUBS[value] || ''; }

// Kode singkat tiap model buat UI pilih model baru
const MODEL_CODE = {
  'qwen/qwen3.6-27b': 'R3.5',
  'openai/gpt-oss-120b': 'X2.5',
  'llama-3.3-70b-versatile': 'X2.0',
  'llama-3.1-8b-instant': 'X1.6',
  'openai/gpt-oss-20b': 'X2.9',
  'spectrax': 'Spectrax',
  'vaneus-4.0': 'Vaneus 4.0',
  'nvidia/llama-3.3-nemotron-super-49b-v1.5': 'Oxy Nemotron',
  'deepseek-ai/deepseek-r1': 'Oxy DeepSeek R1',
  'meta/llama-3.3-70b-instruct': 'Oxy Llama 70B N',
  'sonar-reasoning-pro': 'Oxy Sonar Reasoning',
  'sonar-pro': 'Oxy Sonar Pro',
  'sonar': 'Oxy Sonar',
  'sonar-deep-research': 'Oxy Sonar Deep Research'
};
function getModelCode(value) { return MODEL_CODE[value] || ''; }
// Model utama yang tampil di halaman awal sheet
const MAIN_MODEL_VALUES = [
  'spectrax', // Spectrax, paling atas
  'vaneus-4.0',                                    // Vaneus 4.0, di bawah Spectrax
  'nvidia/llama-3.3-nemotron-super-49b-v1.5',       // Oxy Nemotron, dipisah dari Spectrax
  'sonar-reasoning-pro',                            // Oxy Sonar Reasoning, di bawah Oxy Nemotron
];
// Sisanya, diurutkan dari nomor kecil ke besar, ada di halaman "Lainnya"
const OTHER_MODEL_VALUES = [
  'llama-3.1-8b-instant',          // X1.6
  'llama-3.3-70b-versatile',       // X2.0
  'openai/gpt-oss-120b',           // X2.5
  'qwen/qwen3.6-27b',              // R3.5, Oxy Thinking
  'openai/gpt-oss-20b',            // X2.9, Oxy Vision
  'deepseek-ai/deepseek-r1',       // Oxy DeepSeek R1
  'meta/llama-3.3-70b-instruct',   // Oxy Llama 70B N
  'sonar-pro',                     // Oxy Sonar Pro
  'sonar',                         // Oxy Sonar
  'sonar-deep-research'            // Oxy Sonar Deep Research
];

let multiCanvasZoom = 1;
function applyCanvasTransform(canvas, inner) {
  const panX = parseFloat(canvas.dataset.panX) || 0;
  const panY = parseFloat(canvas.dataset.panY) || 0;
  inner.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + multiCanvasZoom + ')';
}
function cycleMultiZoom() {
  const levels = [1, 0.85, 0.7, 0.55];
  const idx = levels.indexOf(multiCanvasZoom);
  multiCanvasZoom = levels[(idx + 1) % levels.length];
  document.querySelectorAll('.multi-canvas').forEach(canvas => {
    const inner = canvas.querySelector('.multi-canvas-inner');
    if (inner) applyCanvasTransform(canvas, inner);
  });
  toast('Zoom ' + Math.round(multiCanvasZoom * 100) + '%');
}
function toggleFullscreenCanvas() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => toast('Fullscreen gak didukung di sini'));
  } else {
    document.exitFullscreen();
  }
}
function renderMultiChips() {
  const chipRow = document.getElementById('multi-chip-row');
  const infoRow = document.getElementById('multi-info-row');
  const controls = document.getElementById('multi-canvas-controls');
  if (!chipRow || !infoRow) return;
  chipRow.style.display = 'none'; infoRow.style.display = 'none';
  if (chatMode !== 'multi') {
    if (controls) controls.style.display = 'none';
    return;
  }
  if (controls) controls.style.display = 'flex';
  return;
}
function attachCanvasPan(canvas, inner) {
  let panning = false, startX = 0, startY = 0, baseX = 0, baseY = 0;
  canvas.addEventListener('pointerdown', e => {
    if (e.target.closest('.multi-node')) return;
    panning = true;
    canvas.classList.add('panning');
    startX = e.clientX; startY = e.clientY;
    baseX = parseFloat(canvas.dataset.panX) || 0;
    baseY = parseFloat(canvas.dataset.panY) || 0;
    try { canvas.setPointerCapture(e.pointerId); } catch(err) {}
  });
  canvas.addEventListener('pointermove', e => {
    if (!panning) return;
    const nx = baseX + (e.clientX - startX);
    const ny = baseY + (e.clientY - startY);
    canvas.dataset.panX = nx; canvas.dataset.panY = ny;
    applyCanvasTransform(canvas, inner);
  });
  const end = () => { panning = false; canvas.classList.remove('panning'); };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', end);
}
function attachNodeDrag(nodeEl, onMove, handleSelector) {
  const handle = handleSelector ? nodeEl.querySelector(handleSelector) : nodeEl;
  if (!handle) return;
  let dragging = false, startX = 0, startY = 0, baseLeft = 0, baseTop = 0;
  handle.addEventListener('pointerdown', e => {
    dragging = true;
    nodeEl.classList.add('dragging');
    startX = e.clientX; startY = e.clientY;
    baseLeft = parseFloat(nodeEl.style.left) || 0;
    baseTop = parseFloat(nodeEl.style.top) || 0;
    try { handle.setPointerCapture(e.pointerId); } catch(err) {}
    e.stopPropagation();
  });
  handle.addEventListener('pointermove', e => {
    if (!dragging) return;
    const z = multiCanvasZoom || 1;
    nodeEl.style.left = (baseLeft + (e.clientX - startX) / z) + 'px';
    nodeEl.style.top = (baseTop + (e.clientY - startY) / z) + 'px';
    if (onMove) onMove();
    e.stopPropagation();
  });
  const end = e => { dragging = false; nodeEl.classList.remove('dragging'); e && e.stopPropagation && e.stopPropagation(); };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
  handle.addEventListener('lostpointercapture', end);
}
function buildMultiCanvasTurn(qText, models) {
  const nodeW = 220, nodeGap = 18, userW = 200, rowY = 130;
  const totalRowW = models.length * nodeW + Math.max(0, models.length - 1) * nodeGap;
  const canvasContentW = Math.max(totalRowW + 40, 320);
  const canvasContentH = rowY + 260;

  const turn = document.createElement('div');
  turn.className = 'multi-turn';

  const canvas = document.createElement('div');
  canvas.className = 'multi-canvas';

  const inner = document.createElement('div');
  inner.className = 'multi-canvas-inner';
  inner.style.width = canvasContentW + 'px';
  inner.style.height = canvasContentH + 'px';

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'multi-lines');
  svg.setAttribute('width', canvasContentW);
  svg.setAttribute('height', canvasContentH);

  const userX = canvasContentW / 2 - userW / 2;
  const userNode = document.createElement('div');
  userNode.className = 'multi-node user-node-canvas';
  userNode.style.left = userX + 'px';
  userNode.style.top = '14px';
  userNode.style.width = userW + 'px';
  userNode.innerHTML = '<div class="mun-tag">KAMU</div><div class="mun-text">' + renderMDInline(qText) + '</div>';

  inner.appendChild(svg);
  inner.appendChild(userNode);

  const boxByModel = {};
  const links = [];
  models.forEach((m, i) => {
    const color = getModelColor(m.value);
    const nodeEl = document.createElement('div');
    nodeEl.className = 'multi-node answer-node-canvas';
    nodeEl.style.left = (i * (nodeW + nodeGap) + 20) + 'px';
    nodeEl.style.top = rowY + 'px';
    nodeEl.style.width = nodeW + 'px';

    const box = document.createElement('div');
    box.className = 'multi-answer-box';
    box.style.setProperty('--mc', color);
    const head = document.createElement('div');
    head.className = 'multi-answer-head';
    head.innerHTML = '<span class="node-dot"></span>' + (m.icon || '') + '<span>' + escHtml(m.label) + '</span>';
    const body = document.createElement('div');
    body.className = 'multi-answer-body';
    body.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    box.appendChild(head); box.appendChild(body);
    nodeEl.appendChild(box);
    inner.appendChild(nodeEl);
    boxByModel[m.value] = body;

    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('stroke', color);
    svg.appendChild(path);
    links.push({ path, nodeEl });

    attachNodeDrag(nodeEl, redrawLines, '.multi-answer-head');
  });

  canvas.appendChild(inner);
  turn.appendChild(canvas);

  function redrawLines() {
    const ux = (parseFloat(userNode.style.left) || 0) + userW / 2;
    const uy = (parseFloat(userNode.style.top) || 0) + userNode.offsetHeight;
    links.forEach(({ path, nodeEl }) => {
      const nx = (parseFloat(nodeEl.style.left) || 0) + nodeW / 2;
      const ny = parseFloat(nodeEl.style.top) || 0;
      const midY = (uy + ny) / 2;
      path.setAttribute('d', 'M ' + ux + ' ' + uy + ' C ' + ux + ' ' + midY + ', ' + nx + ' ' + midY + ', ' + nx + ' ' + ny);
    });
  }
  attachNodeDrag(userNode, redrawLines);
  attachCanvasPan(canvas, inner);
  requestAnimationFrame(() => {
    redrawLines();
    const availW = canvas.clientWidth;
    const offsetX = availW > canvasContentW ? (availW - canvasContentW) / 2 : 10;
    canvas.dataset.panX = offsetX; canvas.dataset.panY = 0;
    applyCanvasTransform(canvas, inner);
  });

  return { turn, boxByModel, redrawLines };
}
function setChatMode(mode) {
  if (mode !== 'normal' && mode !== 'multi') return;
  chatMode = mode;
  localStorage.setItem(LS_CHATMODE, mode);
  updateChatModeTabsUI();
  newChat();
  toast(mode === 'multi' ? 'Multi Chat aktif, semua model bakal jawab' : 'Normal Chat aktif');
}
function updateChatModeTabsUI() {
  document.querySelectorAll('.chat-mode-tab').forEach(el => {
    el.classList.toggle('active', el.dataset.mode === chatMode);
  });
  document.body.classList.toggle('mode-multi', chatMode === 'multi');
  const inputEl = document.getElementById('input');
  if (inputEl) inputEl.placeholder = chatMode === 'multi' ? 'Tanya 4 model sekaligus...' : 'Tanya Qwerty...';
  updatePillForMode();
  renderMultiChips();
}
function updatePillForMode() {
  if (chatMode === 'multi') {
    document.getElementById('pill-icon').innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8.6 1.2L3.4 8.6h3.3l-.9 6.2 5.8-7.7H8.3l.3-5.9z"/></svg>';
    document.getElementById('pill-label').textContent = 'Multi Chat';
  } else {
    setPillModel(selectedModel);
  }
}

const VALID_THEMES = ['light', 'neutral-dark', 'blue-dark', 'purple-dark'];
const THEME_LABELS = { light: 'Terang', 'neutral-dark': 'Gelap', 'blue-dark': 'Biru Gelap', 'purple-dark': 'Ungu Gelap' };
let currentTheme = localStorage.getItem(LS_THEME) || 'light';
function applyTheme(t) {
  if (t === 'dark') t = 'blue-dark'; // migrasi dari versi lama
  if (!VALID_THEMES.includes(t)) t = 'light';
  currentTheme = t;
  document.documentElement.setAttribute('data-theme', currentTheme);
  localStorage.setItem(LS_THEME, currentTheme);
}
applyTheme(currentTheme);

const FONT_LABELS = {
  "'Plus Jakarta Sans', sans-serif": 'Plus Jakarta Sans',
  "'Inter', sans-serif": 'Inter',
  "'Poppins', sans-serif": 'Poppins',
  "'Space Grotesk', sans-serif": 'Space Grotesk',
  "'Manrope', sans-serif": 'Manrope'
};
let currentFont = localStorage.getItem(LS_FONT) || "'Plus Jakarta Sans', sans-serif";
function applyFont(f) {
  if (!FONT_LABELS[f]) f = "'Plus Jakarta Sans', sans-serif";
  currentFont = f;
  document.documentElement.style.setProperty('--font-main', currentFont);
  localStorage.setItem(LS_FONT, currentFont);
}
applyFont(currentFont);

const UISIZE_LABELS = { small: 'Kecil', medium: 'Sedang', large: 'Besar' };
const UISIZE_ZOOM = { small: 0.92, medium: 1, large: 1.1 };
let currentUiSize = localStorage.getItem(LS_UISIZE) || 'medium';
function applyUiSize(s) {
  if (!UISIZE_ZOOM[s]) s = 'medium';
  currentUiSize = s;
  document.documentElement.style.setProperty('--ui-zoom', UISIZE_ZOOM[s]);
  localStorage.setItem(LS_UISIZE, currentUiSize);
}
applyUiSize(currentUiSize);

const TEXTSIZE_LABELS = { small: 'Kecil', medium: 'Sedang', large: 'Besar' };
const TEXTSIZE_SCALE = { small: 0.9, medium: 1, large: 1.15 };
let currentTextSize = localStorage.getItem(LS_TEXTSIZE) || 'medium';
function applyTextSize(s) {
  if (!TEXTSIZE_SCALE[s]) s = 'medium';
  currentTextSize = s;
  document.documentElement.style.setProperty('--chat-text-scale', TEXTSIZE_SCALE[s]);
  localStorage.setItem(LS_TEXTSIZE, currentTextSize);
}
applyTextSize(currentTextSize);

let customInstructions = localStorage.getItem(LS_CUSTOM_INSTR) || '';

const savedModelVal = localStorage.getItem(LS_MODEL);
let selectedModel = MODELS[0].items[0];
if (savedModelVal) {
  for (const g of MODELS) {
    const f = g.items.find(m => m.value === savedModelVal);
    if (f) { selectedModel = f; break; }
  }
}
// Kalau model default/tersimpan itu PRO tapi user masih FREE (dan gak lagi punya unlock sementara), turunin ke model gratis pertama
if (selectedModel.pro && currentPlan === 'gratis' && !(selectedModel.value === 'spectrax' && isSpectraxUnlocked())) {
  const freeModel = getAllModels().find(m => !m.pro);
  if (freeModel) selectedModel = freeModel;
}

try {
  const raw = localStorage.getItem(scopedKey(LS_KEY));
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) sessions = parsed;
  }
} catch(e) { sessions = {}; }

// Kalo app sempet ke-reload/ke-suspend pas AI lagi ngetik (misal keluar app bentar di HP),
// balasan yang lagi jalan itu ketinggalan sebagai draft di localStorage. Beresin di sini pas load:
// - kalo draft-nya udah ada isinya, tetep tampilin (tandain putus), jangan sampe ilang.
// - kalo draft-nya kosong (belom sempet nerima apa-apa), buang aja.
(function cleanupStreamingDrafts() {
  let changed = false;
  Object.values(sessions).forEach(s => {
    if (!s || !Array.isArray(s.messages)) return;
    for (let i = s.messages.length - 1; i >= 0; i--) {
      const m = s.messages[i];
      if (m && m.draft) {
        changed = true;
        if (m.content && m.content.trim()) {
          delete m.draft;
          m.interrupted = true;
        } else {
          s.messages.splice(i, 1);
        }
      }
    }
  });
  if (changed) {
    try { localStorage.setItem(scopedKey(LS_KEY), JSON.stringify(sessions)); } catch(e) {}
  }
})();

function resolveActiveId() {
  let id = localStorage.getItem(scopedKey(LS_ACTIVE)) || null;
  if (id && sessions[id]) return id;
  const sorted = Object.values(sessions).sort((a,b) => (b.ts||0) - (a.ts||0));
  return sorted.length ? sorted[0].id : null;
}
activeId = resolveActiveId();

const $msgs      = document.getElementById('messages');
const $input     = document.getElementById('input');
const $tokenInfo = document.getElementById('token-info');
const $histList  = document.getElementById('hist-list');
const $sidebar   = document.getElementById('sidebar');
const $overlay   = document.getElementById('overlay');
const $toast     = document.getElementById('toast');
const $sendBtn   = document.getElementById('send-btn');
const $scrollBtn = document.getElementById('scroll-btn');
const $topbarTitle = document.getElementById('topbar-title');

$msgs.addEventListener('scroll', () => {
  const atBottom = $msgs.scrollHeight - $msgs.scrollTop - $msgs.clientHeight < 60;
  userScrolledUp = !atBottom;
  $scrollBtn.classList.toggle('show', !atBottom);
});
function forceScrollBottom() {
  if (!userScrolledUp) $msgs.scrollTop = $msgs.scrollHeight;
}

// Kalo user keluar app/tab bentar pas AI lagi ngetik (streaming), langsung flush draft ke localStorage
// biar kalo browser/OS reload halamannya pas di-background, balasan yang udah kebentuk gak ilang.
// Terus pas balik lagi ke app, paksa render ulang chat aktif biar konten yang sempet ketinggalan tetep muncul.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (activeDraftFlush) activeDraftFlush();
  } else {
    if (activeStream && activeStream.sessionId === activeId) {
      renderMessages();
    }
  }
});
window.addEventListener('pagehide', () => { if (activeDraftFlush) activeDraftFlush(); });
function scrollToBottomManual() {
  userScrolledUp = false;
  $msgs.scrollTo({ top: $msgs.scrollHeight, behavior: 'smooth' });
  $scrollBtn.classList.remove('show');
}

(function() {
  let startX = 0, startY = 0;
  let isDragging = false, isHoriz = null;
  const THRESHOLD = 80;
  const MAX_VERT  = 40;

  $sidebar.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isDragging = false;
    isHoriz = null;
  }, { passive: true });

  $sidebar.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - startX;
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (isHoriz === null && (Math.abs(dx) > 6 || dy > 6)) {
      isHoriz = Math.abs(dx) > dy;
    }
    if (!isHoriz || dx > 0) return;
    e.preventDefault();
    isDragging = true;
    $sidebar.classList.add('dragging');
    $sidebar.style.transform = 'translateX(' + Math.min(0, dx) + 'px)';
  }, { passive: false });

  $sidebar.addEventListener('touchend', e => {
    if (!isDragging) { isHoriz = null; return; }
    isDragging = false; isHoriz = null;
    $sidebar.classList.remove('dragging');
    $sidebar.style.transform = '';
    const dx = e.changedTouches[0].clientX - startX;
    const dy = Math.abs(e.changedTouches[0].clientY - startY);
    if (dx < -THRESHOLD && dy < MAX_VERT) closeSidebar();
  }, { passive: true });
})();

function setPillModel(m) {
  document.getElementById('pill-icon').innerHTML = m.icon || '';
  document.getElementById('pill-label').textContent = getModelCode(m.value) || m.label;
}
function modelCardHTML(value, small) {
  const m = getAllModels().find(x => x.value === value);
  if (!m) return '';
  const sel = selectedModel.value === value;
  const spectraxUnlocked = value === 'spectrax' && isSpectraxUnlocked();
  const locked = m.pro && currentPlan === 'gratis' && !spectraxUnlocked;
  return '<div class="model-card' + (small ? ' model-card-sm' : '') + (sel ? ' selected' : '') + (locked ? ' locked' : '') + '" onclick="selectModelFromSheet(\'' + value + '\')">'
    + '<div class="model-card-icon" style="color:' + getModelColor(value) + '">' + (m.icon || '') + '</div>'
    + '<div class="model-card-text"><div class="model-card-code">' + escHtml(getModelCode(value)) + '</div></div>'
    + (m.pro && !spectraxUnlocked ? '<span class="model-card-pro-badge">PRO</span>' : '')
    + (spectraxUnlocked ? '<span class="model-card-unlock-badge">24 JAM</span>' : '')
    + (sel ? '<span class="model-card-check"><svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.3 3.3L13 5"/></svg></span>' : '')
    + '</div>';
}
function buildModelDD() {
  document.getElementById('model-main-grid').innerHTML = MAIN_MODEL_VALUES.map(v => modelCardHTML(v, false)).join('');
  document.getElementById('model-other-list').innerHTML = OTHER_MODEL_VALUES.map(v => modelCardHTML(v, true)).join('');
}
function selectModelFromSheet(value) {
  const m = getAllModels().find(x => x.value === value);
  if (!m) return;
  const spectraxUnlocked = value === 'spectrax' && isSpectraxUnlocked();
  if (m.pro && currentPlan === 'gratis' && !spectraxUnlocked) {
    toast('Model ' + m.label + ' cuma buat Paket Pro/Maks. Redeem code atau upgrade dulu ya');
    return;
  }
  selectedModel = m;
  setPillModel(m);
  localStorage.setItem(LS_MODEL, m.value);
  buildModelDD();
  closeModelDD();
}
function openModelPage(name) {
  if (name === 'other') document.getElementById('model-page-other').classList.add('active');
}
function closeModelPage() {
  document.getElementById('model-page-other').classList.remove('active');
}
function toggleModelDD() {
  if (chatMode === 'multi') { toast('Di Multi Chat semua model otomatis jawab bareng'); return; }
  buildModelDD();
  document.getElementById('model-sheet-backdrop').classList.add('show');
  document.getElementById('model-sheet').classList.add('show');
}
function closeModelDD() {
  document.getElementById('model-sheet-backdrop').classList.remove('show');
  document.getElementById('model-sheet').classList.remove('show');
  setTimeout(closeModelPage, 300);
}

document.addEventListener('click', e => {
  if (!e.target.closest('#model-sheet') && !e.target.closest('#model-pill-wrap')) closeModelDD();
  if (!e.target.closest('#modal-menu-wrap'))  closeModalMenu();
  if (!e.target.closest('#img-modal-menu-wrap'))  closeImgModalMenu();
});

function togglePlusSheet() {
  const sheet = document.getElementById('plus-sheet');
  const backdrop = document.getElementById('plus-sheet-backdrop');
  const btn = document.getElementById('plus-btn');
  const isOpen = sheet.classList.contains('show');
  if (isOpen) { sheet.classList.remove('show'); backdrop.classList.remove('show'); btn.classList.remove('sheet-open'); }
  else { sheet.classList.add('show'); backdrop.classList.add('show'); btn.classList.add('sheet-open'); }
}
function closePlusSheet() {
  document.getElementById('plus-sheet').classList.remove('show');
  document.getElementById('plus-sheet-backdrop').classList.remove('show');
  document.getElementById('plus-btn').classList.remove('sheet-open');
}

let pendingAttachment = null;

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

const FILE_ICON_SVG = '<svg width="18" height="18" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V7z"/><polyline points="13 2 13 7 18 7"/></svg>';

function clearAttachmentUI() {
  const chip = document.getElementById('attach-chip');
  if (chip) chip.remove();
  const preview = document.getElementById('attach-preview');
  if (preview) preview.remove();
}

function showImagePreview(attach) {
  clearAttachmentUI();
  const box = document.createElement('div');
  box.id = 'attach-preview';
  box.className = 'attach-image-preview';
  box.innerHTML = '<div class="attach-image-thumb"><img src="data:' + attach.mediaType + ';base64,' + attach.base64 + '" alt="' + escHtml(attach.name) + '"></div>'
    + '<button class="attach-remove-btn" onclick="clearAttachment()" aria-label="Hapus gambar"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M1 1l8 8M9 1l-8 8"/></svg></button>';
  const inputBox = document.getElementById('input-box');
  inputBox.insertBefore(box, inputBox.firstChild);
}

function showFilePreview(attach) {
  clearAttachmentUI();
  const box = document.createElement('div');
  box.id = 'attach-preview';
  box.className = 'attach-file-preview';
  const canRead = attach.type === 'file' && attach.textContent != null;
  const sizeLabel = formatFileSize(attach.size) + (canRead ? '' : (attach.type === 'pdf' ? ' · PDF' : ' · isi belum bisa dibaca AI'));
  box.innerHTML = '<div class="attach-file-icon">' + FILE_ICON_SVG + '</div>'
    + '<div class="attach-file-info">'
    + '<div class="attach-file-name">' + escHtml(attach.name) + '</div>'
    + '<div class="attach-file-size">' + sizeLabel + '</div>'
    + '</div>'
    + '<button class="attach-remove-btn" onclick="clearAttachment()" aria-label="Hapus file"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M1 1l8 8M9 1l-8 8"/></svg></button>';
  const inputBox = document.getElementById('input-box');
  inputBox.insertBefore(box, inputBox.firstChild);
}

function clearAttachment() {
  pendingAttachment = null;
  clearAttachmentUI();
}

function activateImageGenMode() {
  if (!activeId || !sessions[activeId]) newChat();
  imageGenModeActive = true;
  let chip = document.getElementById('image-mode-chip');
  if (!chip) {
    chip = document.createElement('div');
    chip.id = 'image-mode-chip';
    chip.className = 'image-mode-chip';
    chip.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M3 16l4.5-4.5a1.5 1.5 0 0 1 2.1 0L13 15l2-2a1.5 1.5 0 0 1 2.1 0L21 17"/></svg>'
      + '<span>Generate Image</span>';
    const inputLine = document.getElementById('input-line');
    inputLine.insertBefore(chip, inputLine.firstChild);
  }
  $input.placeholder = 'Deskripsi gambar...';
  $input.focus();
}
function deactivateImageGenMode() {
  imageGenModeActive = false;
  const chip = document.getElementById('image-mode-chip');
  if (chip) chip.remove();
  $input.placeholder = 'Tanya Qwerty...';
}

function readFileAsBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = () => rej(new Error('Read failed'));
    r.readAsDataURL(file);
  });
}

function readFileAsText(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error('Read failed'));
    r.readAsText(file);
  });
}

const TEXT_FILE_EXTENSIONS = ['txt','md','markdown','json','js','jsx','ts','tsx','py','html','htm','css','csv','xml','yaml','yml','c','cpp','h','hpp','java','go','rs','php','rb','sh','bat','log','ini','conf','cfg','sql','lua','vue','svelte','env','gitignore','toml'];

function isTextFile(file) {
  if (file.type && (file.type.startsWith('text/') || file.type === 'application/json' || file.type === 'application/xml' || file.type === 'application/javascript')) return true;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  return TEXT_FILE_EXTENSIONS.includes(ext);
}

const MAX_FILE_TEXT_CHARS = 20000;

async function onFileSelected(input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    try {
      const isPdf = file.type === 'application/pdf';
      const base64 = await readFileAsBase64(file);
      let textContent = null;
      if (!isPdf && isTextFile(file)) {
        try {
          textContent = await readFileAsText(file);
          if (textContent.length > MAX_FILE_TEXT_CHARS) {
            textContent = textContent.slice(0, MAX_FILE_TEXT_CHARS) + '\n\n...[isi file dipotong karena kepanjangan]...';
          }
        } catch (e) { textContent = null; }
      }
      pendingAttachment = { type: isPdf ? 'pdf' : 'file', file, base64, textContent, mediaType: file.type || 'application/octet-stream', name: file.name, size: file.size };
      showFilePreview(pendingAttachment);
      closePlusSheet();
    } catch(e) { toast('Gagal membaca file'); }
  }
  input.value = '';
}
async function onImageSelected(input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    try {
      const base64 = await readFileAsBase64(file);
      pendingAttachment = { type: 'image', file, base64, mediaType: file.type || 'image/jpeg', name: file.name, size: file.size };
      showImagePreview(pendingAttachment);
      closePlusSheet();
    } catch(e) { toast('Gagal membaca gambar'); }
  }
  input.value = '';
}
function onWebSearchToggle(el) {
  webSearchEnabled = el.checked;
  document.getElementById('web-search-row').classList.toggle('active', webSearchEnabled);
  toast(webSearchEnabled ? 'Pencarian web aktif' : 'Pencarian web nonaktif');
}

const WELCOME_WORDS = ['Qwerty', 'Asisten Pintarmu', 'Siap Membantu', 'Cepat & Cerdas', 'Mulai Ngobrol'];
let welcomeTypeTimer = null;
function startWelcomeTypewriter() {
  const el = document.getElementById('welcome-type-text');
  let wordIdx = 0, charIdx = 0, phase = 'typing';
  const TYPE_MS = 90, ERASE_MS = 45, HOLD_MS = 1100, GAP_MS = 350;
  function step() {
    const word = WELCOME_WORDS[wordIdx];
    if (phase === 'typing') {
      charIdx++;
      el.textContent = word.slice(0, charIdx);
      if (charIdx >= word.length) { phase = 'hold'; welcomeTypeTimer = setTimeout(step, HOLD_MS); return; }
      welcomeTypeTimer = setTimeout(step, TYPE_MS);
    } else if (phase === 'hold') {
      phase = 'erasing';
      welcomeTypeTimer = setTimeout(step, ERASE_MS);
    } else {
      charIdx--;
      el.textContent = word.slice(0, charIdx);
      if (charIdx <= 0) {
        phase = 'typing';
        wordIdx = (wordIdx + 1) % WELCOME_WORDS.length;
        welcomeTypeTimer = setTimeout(step, GAP_MS);
        return;
      }
      welcomeTypeTimer = setTimeout(step, ERASE_MS);
    }
  }
  step();
}
function stopWelcomeTypewriter() {
  if (welcomeTypeTimer) { clearTimeout(welcomeTypeTimer); welcomeTypeTimer = null; }
}
function showWelcomeOverlay() {
  document.getElementById('welcome-overlay').classList.add('show');
  startWelcomeTypewriter();
}
function triggerGoogleLogin() {
  if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
    toast('Google Login gagal dimuat, coba lagi...');
    return;
  }
  google.accounts.id.prompt((notification) => {
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      toast('Login Google gagal ditampilkan, coba lagi ya');
    }
  });
}
function handleGoogleLogin(response) {
  try {
    const payload = JSON.parse(atob(response.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    userName = payload.name || payload.given_name || 'Pengguna';
    userPicture = payload.picture || '';
    userEmail = payload.email || '';
    localStorage.setItem(LS_NAME, userName);
    localStorage.setItem(LS_PICTURE, userPicture);
    localStorage.setItem(LS_EMAIL, userEmail);
    localStorage.setItem(LS_GOOGLE_NAME, userName);
    localStorage.setItem(LS_GOOGLE_PICTURE, userPicture);
    localStorage.removeItem(LS_IS_TRIAL);
    // Akun Google pertama yang login mewarisi riwayat/paket lama (kalau ada); akun lain mulai bersih
    migrateLegacyAccountData(accountKey());
    reloadAccountScopedState();
    hideWelcomeOverlay();
    renderSidebarAccount();
    toast('Halo, ' + userName + '!');
    // Tiap akun punya flag pilihan paket sendiri, jadi akun Google baru selalu ditawarin pilih paket
    if (!localStorage.getItem(scopedKey(LS_PLAN_CHOSEN))) {
      showPlanOverlay();
    }
  } catch (err) {
    toast('Gagal login Google, coba lagi ya');
  }
}
function startTrialSession() {
  userName = 'Trial Account';
  userPicture = '';
  userEmail = '';
  localStorage.setItem(LS_NAME, userName);
  localStorage.removeItem(LS_PICTURE);
  localStorage.removeItem(LS_EMAIL);
  localStorage.setItem(LS_IS_TRIAL, '1');
  reloadAccountScopedState();
  hideWelcomeOverlay();
  renderSidebarAccount();
  toast('Mode uji coba aktif, chat kamu gak tersimpan permanen');
}
function hideWelcomeOverlay() {
  stopWelcomeTypewriter();
  document.getElementById('welcome-overlay').classList.remove('show');
}

// ==== Overlay Pilih Paket ====
function showPlanOverlay() {
  pendingPlanChoice = null;
  document.querySelectorAll('.plan-box').forEach(el => el.classList.remove('selected'));
  document.getElementById('plan-continue-btn').disabled = true;
  document.getElementById('plan-overlay').classList.add('show');
}
function hidePlanOverlay() {
  document.getElementById('plan-overlay').classList.remove('show');
}
function selectPlanBox(p) {
  if (p === 'pro' || p === 'maks') {
    toast('Paket ' + PLANS[p].label + ' belum bisa diakses saat ini');
    return;
  }
  pendingPlanChoice = p;
  document.querySelectorAll('.plan-box').forEach(el => el.classList.toggle('selected', el.dataset.plan === p));
  document.getElementById('plan-continue-btn').disabled = false;
}
function confirmPlanSelection() {
  if (!pendingPlanChoice || pendingPlanChoice === 'pro' || pendingPlanChoice === 'maks') return;
  const isActualChange = pendingPlanChoice !== currentPlan;
  applyPlan(pendingPlanChoice);
  localStorage.setItem(scopedKey(LS_PLAN_CHOSEN), '1');
  if (isActualChange) resetMsgCount();
  hidePlanOverlay();
  buildModelDD();
  toast('Kamu sekarang di ' + PLANS[currentPlan].label);
}

// ==== Redeem Code ====
function openRedeemModal() {
  document.getElementById('redeem-input').value = '';
  document.getElementById('redeem-modal').classList.add('open');
}
function closeRedeemModal() {
  document.getElementById('redeem-modal').classList.remove('open');
}
function submitRedeemCode() {
  const input = document.getElementById('redeem-input');
  const code = input.value.trim().toUpperCase();
  if (!code) { toast('Isi kode dulu'); return; }
  const entry = REDEEM_CODES[code];
  if (!entry) {
    toast('Kode gak valid atau udah gak berlaku');
    return;
  }
  if (entry.unlockModel) {
    const m = getAllModels().find(x => x.value === entry.unlockModel);
    const until = Date.now() + (entry.hours || 24) * 3600000;
    localStorage.setItem(scopedKey(LS_SPECTRAX_UNLOCK), String(until));
    buildModelDD();
    toast('Berhasil! ' + (m ? m.label : 'Model') + ' kebuka selama ' + (entry.hours || 24) + ' jam');
    closeRedeemModal();
    return;
  }
  if (!PLANS[entry.plan]) {
    toast('Kode gak valid atau udah gak berlaku');
    return;
  }
  const redeemIsChange = entry.plan !== currentPlan;
  applyPlan(entry.plan);
  localStorage.setItem(scopedKey(LS_PLAN_CHOSEN), '1');
  if (redeemIsChange) resetMsgCount();
  buildModelDD();
  toast('Berhasil! Sekarang kamu di ' + PLANS[entry.plan].label);
  closeRedeemModal();
}
function renderSidebarAccount() {
  const avatar = document.getElementById('sidebar-account-avatar');
  const nameEl = document.getElementById('sidebar-account-name');
  if (!avatar || !nameEl) return;
  if (!userName) { const stored = localStorage.getItem(LS_NAME); if (stored) userName = stored; }
  if (!userPicture) { const storedPic = localStorage.getItem(LS_PICTURE); if (storedPic) userPicture = storedPic; }
  const name = userName || 'Pengguna';
  if (userPicture) {
    avatar.innerHTML = '<img src="' + userPicture + '" class="sidebar-account-avatar-img" alt="">';
  } else {
    avatar.textContent = name.trim().charAt(0) || '?';
  }
  nameEl.textContent = name;
}
function logoutAccount() {
  document.getElementById('logout-modal-backdrop').classList.add('show');
  document.getElementById('logout-modal').classList.add('show');
}
function closeLogoutModal() {
  document.getElementById('logout-modal-backdrop').classList.remove('show');
  document.getElementById('logout-modal').classList.remove('show');
}
function confirmLogout() {
  closeLogoutModal();
  if (isStreaming && abortController) { abortController.abort(); abortController = null; isStreaming = false; }
  userName = '';
  userPicture = '';
  userEmail = '';
  localStorage.removeItem(LS_NAME);
  localStorage.removeItem(LS_PICTURE);
  localStorage.removeItem(LS_EMAIL);
  localStorage.removeItem(LS_IS_TRIAL);
  if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
    google.accounts.id.disableAutoSelect();
  }
  reloadAccountScopedState();
  closeSidebar();
  showWelcomeOverlay();
}

function openPersonalizeModal() {
  renderPersonalizeModal();
  document.getElementById('personalize-modal').classList.add('open');
}
function closePersonalizeModal() {
  document.getElementById('personalize-modal').classList.remove('open');
  closeThemePopup();
}
function renderPersonalizeModal() {
  if (!userName) { const stored = localStorage.getItem(LS_NAME); if (stored) userName = stored; }
  if (!userPicture) { const storedPic = localStorage.getItem(LS_PICTURE); if (storedPic) userPicture = storedPic; }
  const name = userName || 'Pengguna';
  const pAvatar = document.getElementById('personalize-avatar');
  if (userPicture) {
    pAvatar.innerHTML = '<img src="' + userPicture + '" class="personalize-avatar-img" alt="">';
  } else {
    pAvatar.textContent = name.trim().charAt(0) || '?';
  }
  document.getElementById('personalize-name').textContent = name;
  document.getElementById('theme-current-label').textContent = THEME_LABELS[currentTheme] || 'Terang';
  document.querySelectorAll('.theme-option').forEach(el => {
    el.classList.toggle('active', el.dataset.themeValue === currentTheme);
  });
  document.getElementById('font-current-label').textContent = FONT_LABELS[currentFont] || 'Plus Jakarta Sans';
  document.querySelectorAll('#font-popup .theme-option').forEach(el => {
    el.classList.toggle('active', el.dataset.fontValue === currentFont);
  });
  document.getElementById('uisize-current-label').textContent = UISIZE_LABELS[currentUiSize] || 'Sedang';
  document.querySelectorAll('#uisize-popup .theme-option').forEach(el => {
    el.classList.toggle('active', el.dataset.uisizeValue === currentUiSize);
  });
  document.getElementById('textsize-current-label').textContent = TEXTSIZE_LABELS[currentTextSize] || 'Sedang';
  document.querySelectorAll('#textsize-popup .theme-option').forEach(el => {
    el.classList.toggle('active', el.dataset.textsizeValue === currentTextSize);
  });
  document.getElementById('custom-instr-status').textContent = customInstructions ? 'Aktif' : 'Belum diatur';
}

// ==== Edit profil (custom nama & foto) ====
let pendingProfilePicture = null;
function openEditProfileModal() {
  if (!userName) { const stored = localStorage.getItem(LS_NAME); if (stored) userName = stored; }
  if (!userPicture) { const storedPic = localStorage.getItem(LS_PICTURE); if (storedPic) userPicture = storedPic; }
  pendingProfilePicture = userPicture || null;
  document.getElementById('edit-profile-name-input').value = userName || '';
  renderEditProfilePreview();
  document.getElementById('edit-profile-backdrop').classList.add('show');
  document.getElementById('edit-profile-modal').classList.add('show');
}
function closeEditProfileModal() {
  document.getElementById('edit-profile-backdrop').classList.remove('show');
  document.getElementById('edit-profile-modal').classList.remove('show');
  pendingProfilePicture = null;
}
function renderEditProfilePreview() {
  const preview = document.getElementById('edit-profile-avatar-preview');
  const nameVal = document.getElementById('edit-profile-name-input').value.trim() || userName || 'Pengguna';
  if (pendingProfilePicture) {
    preview.innerHTML = '<img src="' + pendingProfilePicture + '" alt="">';
  } else {
    preview.innerHTML = '';
    preview.textContent = nameVal.charAt(0) || '?';
  }
}
function handleProfilePhotoChange(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('File harus berupa gambar'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      // resize ke maksimal 200x200 biar hemat localStorage
      const size = 200;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      const minSide = Math.min(img.width, img.height);
      const sx = (img.width - minSide) / 2;
      const sy = (img.height - minSide) / 2;
      ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
      pendingProfilePicture = canvas.toDataURL('image/jpeg', 0.85);
      renderEditProfilePreview();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function saveEditProfile() {
  const nameVal = document.getElementById('edit-profile-name-input').value.trim();
  if (!nameVal) { toast('Nama gak boleh kosong'); return; }
  userName = nameVal;
  userPicture = pendingProfilePicture || '';
  localStorage.setItem(LS_NAME, userName);
  if (userPicture) localStorage.setItem(LS_PICTURE, userPicture); else localStorage.removeItem(LS_PICTURE);
  closeEditProfileModal();
  renderSidebarAccount();
  renderPersonalizeModal();
  toast('Profil diperbarui');
}
function resetToGoogleProfile() {
  const gName = localStorage.getItem(LS_GOOGLE_NAME);
  const gPic = localStorage.getItem(LS_GOOGLE_PICTURE);
  if (!gName) { toast('Belum ada data Google tersimpan'); return; }
  document.getElementById('edit-profile-name-input').value = gName;
  pendingProfilePicture = gPic || null;
  renderEditProfilePreview();
}
document.getElementById('edit-profile-name-input')?.addEventListener('input', renderEditProfilePreview);

function openCustomInstrModal() {
  const ta = document.getElementById('custom-instr-textarea');
  ta.value = customInstructions;
  updateCustomInstrCount();
  document.getElementById('custom-instr-modal').classList.add('open');
  setTimeout(() => ta.focus(), 200);
}
function closeCustomInstrModal() {
  document.getElementById('custom-instr-modal').classList.remove('open');
}
function updateCustomInstrCount() {
  const ta = document.getElementById('custom-instr-textarea');
  document.getElementById('custom-instr-count').textContent = ta.value.length + ' karakter';
}
function saveCustomInstr() {
  const ta = document.getElementById('custom-instr-textarea');
  customInstructions = ta.value.trim();
  localStorage.setItem(LS_CUSTOM_INSTR, customInstructions);
  renderPersonalizeModal();
  closeCustomInstrModal();
  toast(customInstructions ? 'Instruksi khusus disimpan' : 'Instruksi khusus dihapus');
}

// ==== Api Key OxyChat ====
// Katalog model publik yang bisa dipilih pas bikin API key (harus sinkron sama server)
const APIKEY_MODEL_CATALOG = [
  { id: 'spectrax', label: 'Spectrax' },
  { id: 'vaneus-4.0', label: 'Vaneus 4.0' },
  { id: 'oxy-nemotron', label: 'Oxy Nemotron' },
  { id: 'oxy-deepseek-r1', label: 'Oxy DeepSeek R1' },
  { id: 'oxy-llama-70b-n', label: 'Oxy Llama 70B N' },
  { id: 'oxy-sonar-reasoning', label: 'Oxy Sonar Reasoning' },
  { id: 'oxy-sonar-pro', label: 'Oxy Sonar Pro' },
  { id: 'oxy-sonar', label: 'Oxy Sonar' },
  { id: 'oxy-sonar-deep-research', label: 'Oxy Sonar Deep Research' },
  { id: 'oxy-thinking', label: 'Oxy Thinking' },
  { id: 'oxy-vision', label: 'Oxy Vision' },
  { id: 'oxy-ultra', label: 'Oxy Ultra' },
  { id: 'oxy-expert', label: 'Oxy Expert' },
  { id: 'oxy-fast', label: 'Oxy Fast' },
];
// Buka halaman API key terpisah (bukan modal lagi)
function goToApiKeyPage() {
  window.location.href = 'CreateApikey/';
}

function goToRequestUpdatePage() {
  window.location.href = 'Request-Update/';
}
function openThemePopup(e) {
  if (e) e.stopPropagation();
  renderPersonalizeModal();
  const popup = document.getElementById('theme-popup');
  const row = document.getElementById('theme-row');
  const rect = row.getBoundingClientRect();
  const pw = 190;
  let left = rect.right - pw;
  if (left < 8) left = 8;
  if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
  let top = rect.bottom + 8;
  popup.style.left = left + 'px';
  popup.style.top = top + 'px';
  popup.classList.add('show');
  setTimeout(() => document.addEventListener('click', closeThemePopupOutside, { once: true }), 10);
}
function closeThemePopupOutside(e) {
  const popup = document.getElementById('theme-popup');
  if (popup.contains(e.target)) {
    setTimeout(() => document.addEventListener('click', closeThemePopupOutside, { once: true }), 10);
  } else {
    closeThemePopup();
  }
}
function closeThemePopup() {
  document.getElementById('theme-popup').classList.remove('show');
}
function setTheme(t) {
  applyTheme(t);
  renderPersonalizeModal();
  closeThemePopup();
}

// ==== Popup generik: Font, Ukuran UI, Ukuran Teks (pola sama kayak theme-popup) ====
function openSettingPopup(popupId, rowId) {
  const popup = document.getElementById(popupId);
  const row = document.getElementById(rowId);
  const rect = row.getBoundingClientRect();
  const pw = 190;
  let left = rect.right - pw;
  if (left < 8) left = 8;
  if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
  let top = rect.bottom + 8;
  popup.style.left = left + 'px';
  popup.style.top = top + 'px';
  popup.classList.add('show');
  const outsideHandler = (e) => {
    if (popup.contains(e.target)) {
      setTimeout(() => document.addEventListener('click', outsideHandler, { once: true }), 10);
    } else {
      popup.classList.remove('show');
    }
  };
  setTimeout(() => document.addEventListener('click', outsideHandler, { once: true }), 10);
}

function openFontPopup(e) {
  if (e) e.stopPropagation();
  renderPersonalizeModal();
  openSettingPopup('font-popup', 'font-row');
}
function closeFontPopup() { document.getElementById('font-popup').classList.remove('show'); }
function setFont(fontValue, label) {
  applyFont(fontValue);
  renderPersonalizeModal();
  closeFontPopup();
}

function openUiSizePopup(e) {
  if (e) e.stopPropagation();
  renderPersonalizeModal();
  openSettingPopup('uisize-popup', 'uisize-row');
}
function closeUiSizePopup() { document.getElementById('uisize-popup').classList.remove('show'); }
function setUiSize(s) {
  applyUiSize(s);
  renderPersonalizeModal();
  closeUiSizePopup();
}

function openTextSizePopup(e) {
  if (e) e.stopPropagation();
  renderPersonalizeModal();
  openSettingPopup('textsize-popup', 'textsize-row');
}
function closeTextSizePopup() { document.getElementById('textsize-popup').classList.remove('show'); }
function setTextSize(s) {
  applyTextSize(s);
  renderPersonalizeModal();
  closeTextSizePopup();
}

// ==== Thinking (semua model bisa mikir dulu sebelum jawab) + Upaya (level kedalaman mikir) ====
const LS_THINKING = 'oxychat_thinking_v1';
const LS_EFFORT = 'oxychat_effort_v1';
const EFFORT_LABELS = { rendah: 'Rendah', sedang: 'Sedang', tinggi: 'Tinggi', maks: 'Maks' };
const EFFORT_INSTRUCTIONS = {
  rendah: 'Sebelum jawab, mikir singkat aja (1-2 kalimat) di dalam tag <think>...</think>, to the point.',
  sedang: 'Sebelum jawab, mikir langkah-langkah utamanya secara ringkas di dalam tag <think>...</think>.',
  tinggi: 'Sebelum jawab, mikir agak mendalam di dalam tag <think>...</think>, pertimbangkan beberapa sudut pandang atau kemungkinan.',
  maks: 'Sebelum jawab, mikir super detail dan step-by-step di dalam tag <think>...</think>, pertimbangkan berbagai kemungkinan, edge case, dan cek ulang logikanya sebelum yakin sama jawabannya.'
};
let thinkingEnabled = localStorage.getItem(LS_THINKING) === '1';
let currentEffort = EFFORT_LABELS[localStorage.getItem(LS_EFFORT)] ? localStorage.getItem(LS_EFFORT) : 'sedang';
function getThinkingInstruction() {
  if (!thinkingEnabled) return '';
  return '\n\n' + EFFORT_INSTRUCTIONS[currentEffort] +
    ' Aturan ini WAJIB dipatuhi APAPUN model/karakter lu, gak peduli lu biasanya langsung jawab atau kagak.' +
    ' WAJIB bungkus SELURUH proses mikirnya di dalam tag <think> dan </think> (buka tag <think> di baris PALING AWAL sebelum nulis apapun lain, tutup dengan </think> sebelum mulai jawaban final).' +
    ' Jawaban final WAJIB ditulis SETELAH tag </think> ditutup, di luar tag itu. JANGAN PERNAH skip proses mikir ini, JANGAN PERNAH langsung jawab tanpa tag <think> lebih dulu.';
}
function onThinkingToggle(el) {
  thinkingEnabled = el.checked;
  localStorage.setItem(LS_THINKING, thinkingEnabled ? '1' : '0');
}
// Kirim parameter reasoning native (kalo providernya support, dia bakal kepake; kalo enggak ya diabaikan aja).
// Ini biar model yang emang punya mode reasoning bawaan (bukan cuma ngandelin instruksi prompt) beneran mikir juga.
const EFFORT_TO_LEVEL = { rendah: 'low', sedang: 'medium', tinggi: 'high', maks: 'high' };
function getReasoningExtraParams(modelValue) {
  if (!thinkingEnabled) return {};
  // Parameter reasoning native ini gak semua provider/model ngerti formatnya (bisa bikin request-nya
  // ditolak alias error 400 kalo dikasih field yang gak dikenal). Aman-nya cuma dikirim ke Groq, dan cuma
  // field yang emang didukung Groq (reasoning_effort/reasoning_format). "enable_thinking" & "thinking" itu
  // format punya provider lain (bukan Groq), makanya di-reject servernya kalo dipaksa kirim ke Groq.
  // Provider selain Groq tetep dapet efek mikir dari instruksi prompt (getThinkingInstruction).
  if (getProviderName(modelValue) !== 'groq') return {};
  const level = EFFORT_TO_LEVEL[currentEffort] || 'medium';
  return {
    reasoning_effort: level,
    reasoning_format: 'parsed'
  };
}
function openEffortPopup(e) {
  if (e) e.stopPropagation();
  renderEffortPopup();
  openSettingPopup('effort-popup', 'effort-row');
}
function closeEffortPopup() { document.getElementById('effort-popup').classList.remove('show'); }
function setEffort(v) {
  if (!EFFORT_LABELS[v]) v = 'sedang';
  currentEffort = v;
  localStorage.setItem(LS_EFFORT, currentEffort);
  renderEffortPopup();
  closeEffortPopup();
}
function renderEffortPopup() {
  document.getElementById('effort-current-label').textContent = EFFORT_LABELS[currentEffort] || 'Sedang';
  document.querySelectorAll('#effort-popup .theme-option').forEach(el => {
    el.classList.toggle('active', el.dataset.effortValue === currentEffort);
  });
}
document.getElementById('thinking-toggle').checked = thinkingEnabled;
renderEffortPopup();

document.getElementById('custom-instr-textarea').addEventListener('input', updateCustomInstrCount);

function saveSessions() {
  try {
    const toSave = {};
    for (const [id, s] of Object.entries(sessions)) {
      toSave[id] = { ...s, messages: s.messages.slice(-100) };
    }
    localStorage.setItem(scopedKey(LS_KEY), JSON.stringify(toSave));
    localStorage.setItem(scopedKey(LS_ACTIVE), activeId || '');
  } catch(e) {}
}

// Dipanggil tiap konteks akun berubah (login Google, ganti akun, mode uji coba, logout) supaya
// riwayat chat, sesi aktif, dan paket yang ke-render selalu punya punya akun yang lagi aktif sekarang.
function reloadAccountScopedState() {
  sessions = {};
  try {
    const raw = localStorage.getItem(scopedKey(LS_KEY));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) sessions = parsed;
    }
  } catch (e) { sessions = {}; }
  activeId = resolveActiveId();
  currentPlan = localStorage.getItem(scopedKey(LS_PLAN)) || 'gratis';
  if (selectedModel.pro && currentPlan === 'gratis' && !(selectedModel.value === 'spectrax' && isSpectraxUnlocked())) {
    const freeModel = getAllModels().find(m => !m.pro);
    if (freeModel) { selectedModel = freeModel; localStorage.setItem(LS_MODEL, freeModel.value); setPillModel(freeModel); }
  }
  if (activeId && sessions[activeId]) {
    renderHistList(); renderMessages(); updateTopbarTitle();
    $tokenInfo.textContent = sessions[activeId].tokens ? '~' + sessions[activeId].tokens + ' tok' : '';
  } else {
    renderHistList(); showEmptyState(); updateTopbarTitle();
    $tokenInfo.textContent = '';
  }
  buildModelDD();
  updateLimitBannerUI();
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,5); }
function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(msg, ms) {
  $toast.textContent = msg; $toast.classList.add('show');
  setTimeout(() => $toast.classList.remove('show'), ms || 2000);
}
function autoResize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 130) + 'px'; }
function fillPrompt(text) {
  $input.value = text;
  autoResize($input);
  send();
}
function setSendLoading(v) { $sendBtn.classList.toggle('loading', v); }
function updateTopbarTitle() {
  $topbarTitle.textContent = '';
}
function stripThinkBlocks(text) {
  return (text || '').replace(/<think>[\s\S]*?<\/think>/g, '');
}

async function performWebSearch(query) {
  try {
    const res = await fetch('https://api.duckduckgo.com/?q=' + encodeURIComponent(query) + '&format=json&no_html=1&skip_disambig=1');
    if (!res.ok) return null;
    const data = await res.json();
    const items = [];
    if (data.AbstractText) items.push({ text: data.AbstractText, url: data.AbstractURL || '' });
    if (Array.isArray(data.RelatedTopics)) {
      data.RelatedTopics.forEach(t => {
        if (items.length >= 6) return;
        if (t.Text && t.FirstURL) items.push({ text: t.Text, url: t.FirstURL });
        else if (Array.isArray(t.Topics)) {
          t.Topics.forEach(t2 => { if (items.length < 6 && t2.Text && t2.FirstURL) items.push({ text: t2.Text, url: t2.FirstURL }); });
        }
      });
    }
    return items.length ? items : null;
  } catch(e) { return null; }
}
function buildPollinationsUrl(prompt) {
  const seed = Math.floor(Math.random() * 1000000000);
  return 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?width=1024&height=1024&nologo=true&seed=' + seed;
}
function generateImage(prompt, onStatus) {
  return new Promise(resolve => {
    const maxAttempts = 3;
    let attempt = 0;
    const tryLoad = () => {
      attempt++;
      if (onStatus) onStatus(attempt, maxAttempts);
      const url = buildPollinationsUrl(prompt);
      const img = new Image();
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return; settled = true;
        if (attempt < maxAttempts) tryLoad(); else resolve(null);
      }, 30000);
      img.onload = () => {
        if (settled) return; settled = true;
        clearTimeout(timer); resolve(url);
      };
      img.onerror = () => {
        if (settled) return; settled = true;
        clearTimeout(timer);
        if (attempt < maxAttempts) tryLoad(); else resolve(null);
      };
      img.src = url;
    };
    tryLoad();
  });
}
function imageGenLoadingHTML(statusText) {
  return '<div class="img-gen-box">'
    + '<div class="img-gen-bg"></div>'
    + '<div class="img-gen-dark-overlay"></div>'
    + '<svg class="img-gen-icon" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M3 16l4.5-4.5a1.5 1.5 0 0 1 2.1 0L13 15l2-2a1.5 1.5 0 0 1 2.1 0L21 17"/></svg>'
    + '</div>';
}
function renderAIImage(container, url, prompt) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-top:2px;';
  const img = document.createElement('img');
  img.src = url;
  img.alt = prompt;
  img.style.cssText = 'max-width:100%;border-radius:14px;display:block;cursor:pointer;';
  img.onclick = () => openImageViewer(url);
  wrap.appendChild(img);
  container.appendChild(wrap);
}
async function describeImageWithVision(attach) {
  const res = await callOxyAPI(VISION_MODEL, {
    model: VISION_MODEL,
    messages: [
      { role: 'user', content: [
          { type: 'image_url', image_url: { url: 'data:' + attach.mediaType + ';base64,' + attach.base64 } },
          { type: 'text', text: 'Deskripsikan isi gambar ini secara detail dan objektif dalam Bahasa Indonesia: objek yang ada, teks yang kelihatan (kalau ada), warna, suasana, dan konteksnya. Jangan menjawab pertanyaan apapun, cukup deskripsikan gambarnya aja.' }
        ] }
    ],
    stream: false,
    temperature: 0.3
  });
  if (!res.ok) throw new Error('Gagal baca gambar');
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}
async function generateAITitle(userMsg, aiReply) {
  try {
    const prompt = `Buat judul singkat (3-6 kata, bahasa Indonesia) untuk percakapan ini. Hanya tulis judulnya saja, tanpa tanda kutip, tanpa penjelasan.\n\nUser: ${userMsg.slice(0, 200)}\nAI: ${stripThinkBlocks(aiReply).slice(0, 300)}`;
    const res = await callOxyAPI('llama-3.1-8b-instant', {
      model: 'llama-3.1-8b-instant',
      messages: [{ role:'user', content: prompt }],
      max_tokens: 30,
      stream: false
    });
    if (!res.ok) return null;
    const data = await res.json();
    const title = data.choices?.[0]?.message?.content?.trim();
    return title ? title.replace(/^["']|["']$/g, '').trim() : null;
  } catch(e) { return null; }
}

function extractSources(text) {
  const sources = [];
  const seen = new Set();
  const urlRe = /https?:\/\/[^\s\)\]"'<>]+/g;
  let m;
  while ((m = urlRe.exec(text)) !== null) {
    let url = m[0].replace(/[.,;:!?]+$/, '');
    try {
      const u = new URL(url);
      const domain = u.hostname.replace(/^www\./, '');
      if (!seen.has(domain)) {
        seen.add(domain);
        let title = domain;
        const pathParts = u.pathname.split('/').filter(Boolean);
        if (pathParts.length) {
          const last = decodeURIComponent(pathParts[pathParts.length - 1])
            .replace(/[-_]/g, ' ').replace(/\.\w+$/, '');
          if (last && last.length > 1) title = last;
        }
        sources.push({ url, domain, title });
      }
    } catch(e) {}
  }
  return sources.slice(0, 8);
}

function makeFavBubble(domain, cls) {
  const bubble = document.createElement('div');
  bubble.className = cls;
  const faviconUrl = 'https://www.google.com/s2/favicons?sz=32&domain=' + domain;
  const img = document.createElement('img');
  img.src = faviconUrl;
  img.onerror = function() {
    img.style.display = 'none';
    const letter = document.createElement('span');
    letter.className = 'fav-letter';
    letter.textContent = domain[0];
    bubble.appendChild(letter);
  };
  bubble.appendChild(img);
  return bubble;
}

function buildSourcesEl(sources) {
  if (!sources.length) return null;

  const wrap = document.createElement('div');
  wrap.className = 'ai-sources-wrap';

  const pillRow = document.createElement('div');
  pillRow.className = 'sources-pill-row';

  const favStack = document.createElement('div');
  favStack.className = 'sources-favstack';
  sources.slice(0, 4).forEach(s => {
    favStack.appendChild(makeFavBubble(s.domain, 'sources-fav-bubble'));
  });

  const label = document.createElement('span');
  label.className = 'sources-pill-label';
  label.textContent = 'Sumber';

  const arrow = document.createElement('span');
  arrow.className = 'sources-pill-arrow';
  arrow.textContent = '▼';

  pillRow.appendChild(favStack);
  pillRow.appendChild(label);
  pillRow.appendChild(arrow);

  const list = document.createElement('div');
  list.className = 'sources-list';

  sources.forEach(s => {
    const a = document.createElement('a');
    a.className = 'source-item';
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';

    a.appendChild(makeFavBubble(s.domain, 'source-item-fav'));

    const titleEl = document.createElement('span');
    titleEl.className = 'source-item-title';
    titleEl.textContent = s.title;

    const domainEl = document.createElement('span');
    domainEl.className = 'source-item-domain';
    domainEl.textContent = s.domain;

    a.appendChild(titleEl);
    a.appendChild(domainEl);
    list.appendChild(a);
  });

  pillRow.addEventListener('click', () => {
    const isOpen = list.classList.toggle('open');
    pillRow.classList.toggle('open', isOpen);
  });

  wrap.appendChild(pillRow);
  wrap.appendChild(list);
  return wrap;
}

let activeThinkRef = null;
function openThinkModal(content, ref) {
  activeThinkRef = ref || null;
  const body = document.getElementById('think-modal-body');
  body.textContent = (content || '').trim();
  document.getElementById('think-modal-backdrop').classList.add('show');
  document.getElementById('think-modal').classList.add('show');
}
function closeThinkModal() {
  activeThinkRef = null;
  document.getElementById('think-modal-backdrop').classList.remove('show');
  document.getElementById('think-modal').classList.remove('show');
}
function buildThinkBlock(content) {
  const pill = document.createElement('div');
  pill.className = 'think-pill';
  pill.innerHTML = '<span class="think-icon"><svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="6.5" cy="6.5" r="5.2"/><path d="M6.5 4v2.6l1.7 1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>'
    + '<span class="think-label">Thinking</span><span class="think-chevron">&gt;</span>';
  pill.onclick = () => openThinkModal(content, null);
  return pill;
}

function toggleSidebar() {
  const collapsed = $sidebar.classList.toggle('collapsed');
  $overlay.classList.toggle('show', !collapsed && window.innerWidth < 900);
  if (!collapsed) renderSidebarAccount();
}
function closeSidebar() { $sidebar.classList.add('collapsed'); $overlay.classList.remove('show'); }

function renameChat() {
  if (!activeId || !sessions[activeId]) { toast('Tidak ada obrolan aktif'); return; }
  const inp = document.getElementById('rename-input');
  inp.value = sessions[activeId].title;
  updateRenameCounter();
  document.getElementById('rename-modal').classList.add('open');
  setTimeout(() => { inp.focus(); inp.select(); }, 60);
}
function updateRenameCounter() {
  const inp = document.getElementById('rename-input');
  const counter = document.getElementById('rename-char-count');
  const len = inp.value.length;
  counter.textContent = len + '/80';
  counter.className = len >= 80 ? 'over' : len >= 60 ? 'warn' : '';
}
function closeRenameModal() { document.getElementById('rename-modal').classList.remove('open'); }
function closeRenameModalOutside(e) { if (e.target === document.getElementById('rename-modal')) closeRenameModal(); }
function confirmRename() {
  const inp = document.getElementById('rename-input');
  const name = inp.value.trim();
  if (!name) { inp.focus(); return; }
  sessions[activeId].title = name; sessions[activeId].ts = Date.now();
  saveSessions(); renderHistList(); updateTopbarTitle(); closeRenameModal(); toast('Nama diubah');
}
document.getElementById('rename-input').addEventListener('input', updateRenameCounter);
document.getElementById('rename-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') confirmRename();
  if (e.key === 'Escape') closeRenameModal();
});

let modalCodeContent = '', modalCodeLang = 'html';
let modalCodeTitle = 'Code';
function openModal(title, lang, code) {
  modalCodeContent = code; modalCodeLang = lang; modalCodeTitle = title || guessTitleFromCode(code, lang);
  document.getElementById('modal-code-pre').textContent = code;
  document.getElementById('modal-body').classList.remove('show-preview');
  document.getElementById('modal-iframe').srcdoc = '';
  updateModalViewToggleLabel(false);
  document.getElementById('code-modal').classList.add('open');
}
function closeModal() { document.getElementById('code-modal').classList.remove('open'); }
function updateModalViewToggleLabel(showingPreview) {
  document.getElementById('modal-view-toggle-label').textContent = showingPreview ? 'Lihat Kode' : 'Preview';
}
function switchTab(tab) {
  const body = document.getElementById('modal-body');
  if (tab === 'preview') {
    body.classList.add('show-preview');
    const iframe = document.getElementById('modal-iframe');
    if (!iframe.srcdoc) iframe.srcdoc = modalCodeContent;
  } else {
    body.classList.remove('show-preview');
  }
  updateModalViewToggleLabel(tab === 'preview');
}
function toggleModalView() {
  const isPreview = document.getElementById('modal-body').classList.contains('show-preview');
  switchTab(isPreview ? 'code' : 'preview');
  closeModalMenu();
}
function toggleModalMenu() { document.getElementById('modal-menu-dd').classList.toggle('open'); }
function closeModalMenu()  { document.getElementById('modal-menu-dd').classList.remove('open'); }
function modalCopyCode() { navigator.clipboard.writeText(modalCodeContent).then(() => toast('Kode disalin!')); closeModalMenu(); }
function modalDownloadCode() {
  const extMap = { html:'html', htm:'html', javascript:'js', js:'js', python:'py', py:'py', css:'css', typescript:'ts', json:'json', bash:'sh', shell:'sh' };
  // Kalo judulnya udah punya ekstensi (misal "index.html"), pake itu apa adanya biar sesuai nama filenya.
  const hasExt = /\.[a-z0-9]+$/i.test(modalCodeTitle);
  const fileName = hasExt ? modalCodeTitle : modalCodeTitle + '.' + (extMap[(modalCodeLang||'').toLowerCase()] || 'txt');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([modalCodeContent], {type:'text/plain'}));
  a.download = fileName; a.click();
  closeModalMenu(); toast('File diunduh');
}

let currentViewerImageUrl = '';
function openImageViewer(url) {
  currentViewerImageUrl = url;
  document.getElementById('img-modal-img').src = url;
  document.getElementById('img-modal').classList.add('open');
}
function closeImageViewer() {
  document.getElementById('img-modal').classList.remove('open');
  closeImgModalMenu();
}
function toggleImgModalMenu() { document.getElementById('img-modal-menu-dd').classList.toggle('open'); }
function closeImgModalMenu()  { document.getElementById('img-modal-menu-dd').classList.remove('open'); }
async function downloadViewerImage() {
  closeImgModalMenu();
  try {
    const res = await fetch(currentViewerImageUrl);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl; a.download = 'oxy-image-' + Date.now() + '.jpg';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    toast('Gambar diunduh');
  } catch(e) { toast('Gagal download gambar', 2500); }
}
async function saveViewerImage() {
  closeImgModalMenu();
  try {
    const res = await fetch(currentViewerImageUrl);
    const blob = await res.blob();
    const file = new File([blob], 'oxy-image-' + Date.now() + '.jpg', { type: blob.type || 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
    } else {
      window.open(currentViewerImageUrl, '_blank');
      toast('Tahan gambar lalu pilih Simpan ke galeri', 3000);
    }
  } catch(e) {
    if (e.name !== 'AbortError') toast('Gagal simpan gambar', 2500);
  }
}

function highlightCode(code, lang) {
  const esc = escHtml(code);
  let s = esc;
  if (lang === 'html' || lang === 'xml') {
    s = s.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '\x00comment\x00$1\x00/comment\x00');
    s = s.replace(/(&lt;\/?)([\w][\w-]*)/g, (_, open, name) => open + '\x00tag\x00' + name + '\x00/tag\x00');
    s = s.replace(/\b([\w-]+)(?==(?!=))/g, '\x00attr\x00$1\x00/attr\x00');
    s = s.replace(/"([^"]*)"/g, '\x00string\x00"$1"\x00/string\x00');
    s = s.replace(/\x00comment\x00([\s\S]*?)\x00\/comment\x00/g, '<span class="token-comment">$1</span>');
    s = s.replace(/\x00tag\x00([\s\S]*?)\x00\/tag\x00/g, '<span class="token-tag">$1</span>');
    s = s.replace(/\x00attr\x00([\s\S]*?)\x00\/attr\x00/g, '<span class="token-attr">$1</span>');
    s = s.replace(/\x00string\x00([\s\S]*?)\x00\/string\x00/g, '<span class="token-string">$1</span>');
  } else if (lang === 'css') {
    s = s.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="token-comment">$1</span>');
    s = s.replace(/"[^"]*"|'[^']*'/g, m => `<span class="token-string">${m}</span>`);
    s = s.replace(/\b([\w-]+)(?=\s*:)/g, '<span class="token-attr">$1</span>');
    s = s.replace(/\b(\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|ms|deg)?)\b/g, '<span class="token-number">$1</span>');
  } else if (['javascript','js','typescript','ts'].includes(lang)) {
    s = s.replace(/(\/\/[^\n]*)/g, '<span class="token-comment">$1</span>');
    s = s.replace(/(`[^`]*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, '<span class="token-string">$1</span>');
    s = s.replace(/\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|try|catch|new|this|typeof|switch|case|break|continue|default|throw|delete|void|yield)\b/g, '<span class="token-keyword">$1</span>');
    s = s.replace(/\b([A-Za-z_$][\w$]*)\s*(?=\()/g, '<span class="token-function">$1</span>');
    s = s.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="token-number">$1</span>');
  } else if (lang === 'python' || lang === 'py') {
    s = s.replace(/(#[^\n]*)/g, '<span class="token-comment">$1</span>');
    s = s.replace(/("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, '<span class="token-string">$1</span>');
    s = s.replace(/\b(def|class|if|elif|else|for|while|return|import|from|as|try|except|finally|with|raise|pass|break|continue|lambda|yield|and|or|not|True|False|None)\b/g, '<span class="token-keyword">$1</span>');
    s = s.replace(/\b([A-Za-z_][\w]*)\s*(?=\()/g, '<span class="token-function">$1</span>');
    s = s.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="token-number">$1</span>');
  } else if (lang === 'json') {
    s = s.replace(/"(?:[^"\\]|\\.)*"\s*(?=:)/g, m => `<span class="token-attr">${m}</span>`);
    s = s.replace(/"(?:[^"\\]|\\.)*"/g, m => `<span class="token-string">${m}</span>`);
    s = s.replace(/\b(true|false|null)\b/g, '<span class="token-keyword">$1</span>');
    s = s.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="token-number">$1</span>');
  } else if (['bash','shell','sh'].includes(lang)) {
    s = s.replace(/(#[^\n]*)/g, '<span class="token-comment">$1</span>');
    s = s.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, m => `<span class="token-string">${m}</span>`);
    s = s.replace(/\b(echo|cd|ls|mkdir|rm|cp|mv|cat|grep|chmod|sudo|if|then|else|fi|for|do|done|while|export)\b/g, '<span class="token-keyword">$1</span>');
  }
  return s;
}

const LANG_EXT = {
  html:'html', htm:'html', xml:'xml', css:'css', scss:'scss', sass:'sass',
  javascript:'js', js:'js', jsx:'jsx', typescript:'ts', ts:'ts', tsx:'tsx',
  python:'py', py:'py', json:'json', bash:'sh', shell:'sh', sh:'sh',
  java:'java', c:'c', cpp:'cpp', 'c++':'cpp', cs:'cs', go:'go', rust:'rs', rs:'rs',
  php:'php', ruby:'rb', rb:'rb', sql:'sql', yaml:'yml', yml:'yml', kotlin:'kt', swift:'swift'
};
// Nama file langsung ketauan begitu ada penanda di kodenya, gak perlu nunggu kode selesai.
function guessTitleFromCode(code, lang) {
  const l = (lang || '').toLowerCase();
  const t = code.match(/<title>(.*?)<\/title>/i);
  if (t && t[1].trim()) return t[1].trim() + (l === 'html' || l === 'htm' ? '.html' : '');
  const fname = code.match(/(?:\/\/|#|<!--)\s*(?:file|filename)\s*:\s*([\w.\-\/]+)/i);
  if (fname) return fname[1].trim();
  const f = code.match(/(?:function|def|class)\s+([A-Za-z_][A-Za-z0-9_]*)/);
  const ext = LANG_EXT[l] || (l && l !== 'code' ? l : '');
  if (f && ext) return f[1] + '.' + ext;
  if (f) return f[1];
  if (l === 'html' || l === 'htm') return 'index.html';
  if (l === 'css' || l === 'scss' || l === 'sass') return 'style.' + l;
  if (['javascript','js'].includes(l)) return 'script.js';
  if (ext) return 'code.' + ext;
  return 'Code';
}
const LANG_DISPLAY = {
  js:'JavaScript', javascript:'JavaScript', ts:'TypeScript', typescript:'TypeScript',
  py:'Python', python:'Python', html:'HTML', htm:'HTML', css:'CSS', scss:'SCSS', sass:'Sass',
  json:'JSON', bash:'Bash', shell:'Shell', sh:'Shell', java:'Java', c:'C', cpp:'C++', 'c++':'C++',
  cs:'C#', go:'Go', rust:'Rust', rs:'Rust', php:'PHP', ruby:'Ruby', rb:'Ruby', sql:'SQL',
  yaml:'YAML', yml:'YAML', kotlin:'Kotlin', swift:'Swift', jsx:'JSX', tsx:'TSX', xml:'XML'
};
// Header codebox nampilin nama bahasanya (HTML/JS/Python/dll), bukan nama file.
function guessLangLabel(lang) {
  const l = (lang || '').toLowerCase();
  return LANG_DISPLAY[l] || (l && l !== 'code' ? l.toUpperCase() : 'Code');
}
function renderMDInline(text) {
  text = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,         '<em>$1</em>')
    .replace(/^---+$/gm, '<hr>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:14px;display:block;margin:4px 0;cursor:pointer;" onclick="openImageViewer(this.src)">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/^[\-\*] (.*)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => '<ul>' + m + '</ul>')
    .replace(/^\d+\. (.*)$/gm, '<li>$1</li>')
    .split('\n\n').map(p => {
      p = p.trim(); if (!p) return '';
      if (/^<(h[1-3]|ul|ol|hr|li)/.test(p)) return p;
      return '<p>' + p.replace(/\n/g,'<br>') + '</p>';
    }).join('');
}
function buildCodeBlock(lang, code) {
  const title = guessTitleFromCode(code, lang);
  const wrap = document.createElement('div');
  wrap.className = 'code-block-wrap';
  const hdr = document.createElement('div');
  hdr.className = 'code-block-header';
  const langLabel = document.createElement('span');
  langLabel.className = 'code-block-lang';
  langLabel.textContent = guessLangLabel(lang);
  const actions = document.createElement('div');
  actions.className = 'code-block-actions';
  const copyBtn = document.createElement('button');
  copyBtn.className = 'code-block-btn';
  copyBtn.title = 'Salin';
  copyBtn.setAttribute('aria-label', 'Salin');
  copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="13" height="13" rx="2.5"/><path d="M4.5 15.5A2 2 0 0 1 3 13.5v-9A2 2 0 0 1 5 2.5h9a2 2 0 0 1 2 2"/></svg>';
  copyBtn.onclick = () => navigator.clipboard.writeText(code).then(() => toast('Kode disalin!'));
  actions.appendChild(copyBtn);
  if (lang === 'html' || lang === 'htm') {
    const prevBtn = document.createElement('button');
    prevBtn.className = 'code-block-btn code-block-btn-play';
    prevBtn.title = 'Preview';
    prevBtn.setAttribute('aria-label', 'Preview');
    prevBtn.innerHTML = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"><path d="M3 1.8v10.4c0 .7.75 1.13 1.35.76l8.2-5.2a.9.9 0 0 0 0-1.52l-8.2-5.2C3.75.67 3 1.1 3 1.8z"/></svg>';
    prevBtn.onclick = () => { openModal(title, lang, code); switchTab('preview'); };
    actions.appendChild(prevBtn);
  }
  hdr.appendChild(langLabel);
  hdr.appendChild(actions);
  const body = document.createElement('div');
  body.className = 'code-block-body';
  const pre = document.createElement('pre');
  pre.innerHTML = highlightCode(code, lang);
  body.appendChild(pre);
  wrap.appendChild(hdr);
  wrap.appendChild(body);
  return wrap;
}
function appendFenceParts(text, container) {
  const parts = [];
  let lastIdx = 0;
  const re = /```(\w*)\n?([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) parts.push({ type:'text', content: text.slice(lastIdx, m.index) });
    parts.push({ type:'code', lang: (m[1]||'code').toLowerCase(), code: m[2].trim() });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) parts.push({ type:'text', content: text.slice(lastIdx) });
  parts.forEach(p => {
    if (p.type === 'text') {
      if (!p.content.trim()) return;
      const div = document.createElement('div');
      div.innerHTML = renderMDInline(p.content);
      container.appendChild(div);
    } else {
      container.appendChild(buildCodeBlock(p.lang, p.code));
    }
  });
}
function renderMDFull(text, container) {
  container.innerHTML = '';
  const thinkRe = /<think>([\s\S]*?)<\/think>/g;
  let m, thinkContent = '';
  while ((m = thinkRe.exec(text)) !== null) {
    thinkContent += (thinkContent ? '\n\n' : '') + m[1].trim();
  }
  const rest = text.replace(thinkRe, '');
  if (thinkContent) container.appendChild(buildThinkBlock(thinkContent));
  appendFenceParts(rest, container);
}

function attachLongPress(el, cb) {
  let timer = null;
  let fired = false;
  let startX = 0, startY = 0;

  const start = e => {
    fired = false;
    const pt = e.touches ? e.touches[0] : e;
    startX = pt.clientX; startY = pt.clientY;
    timer = setTimeout(() => {
      fired = true;
      const x = startX, y = startY;
      cb(x, y);
      if (navigator.vibrate) navigator.vibrate(30);
    }, 450);
  };
  const cancel = () => { clearTimeout(timer); };
  const move = e => {
    const pt = e.touches ? e.touches[0] : e;
    if (Math.abs(pt.clientX - startX) > 8 || Math.abs(pt.clientY - startY) > 8) cancel();
  };
  const up = e => {
    cancel();
    if (fired) e.preventDefault();
  };

  el.addEventListener('touchstart', start, { passive: true });
  el.addEventListener('touchmove', move, { passive: true });
  el.addEventListener('touchend', up);
  el.addEventListener('mousedown', start);
  el.addEventListener('mousemove', move);
  el.addEventListener('mouseup', cancel);
  el.addEventListener('contextmenu', e => { e.preventDefault(); cb(e.clientX, e.clientY); });
}

let _ctxEl = null;
function showCtxMenu(x, y, items) {
  closeCtxMenu();
  const menu = document.createElement('div');
  menu.className = 'ctx-menu';
  _ctxEl = menu;
  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'ctx-item' + (item.danger ? ' danger' : '');
    el.innerHTML = (item.icon || '') + '<span>' + item.label + '</span>';
    el.onclick = () => { closeCtxMenu(); item.action(); };
    menu.appendChild(el);
  });
  document.body.appendChild(menu);
  const mw = 160, mh = items.length * 42 + 10;
  let left = x, top = y + 8;
  if (left + mw > window.innerWidth - 8) left = window.innerWidth - mw - 8;
  if (top + mh > window.innerHeight - 8) top = y - mh - 4;
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
  setTimeout(() => document.addEventListener('click', closeCtxMenu, { once: true }), 10);
}
function closeCtxMenu() {
  if (_ctxEl) { _ctxEl.remove(); _ctxEl = null; }
}

function startEditBubble(bub, row, msgIdx, originalText) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;max-width:78%;width:100%;';

  const ta = document.createElement('textarea');
  ta.className = 'bubble-edit-area';
  ta.value = originalText;
  autoResizeTA(ta);
  ta.addEventListener('input', () => autoResizeTA(ta));

  const actions = document.createElement('div');
  actions.className = 'bubble-edit-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'bubble-edit-btn cancel';
  cancelBtn.textContent = 'Batal';
  cancelBtn.onclick = () => { wrap.replaceWith(bub); };

  const saveBtn = document.createElement('button');
  saveBtn.className = 'bubble-edit-btn save';
  saveBtn.textContent = 'Simpan & Kirim';
  saveBtn.onclick = () => {
    const newText = ta.value.trim();
    if (!newText) return;
    const sess = sessions[activeId];
    sess.messages = sess.messages.slice(0, msgIdx);
    saveSessions();
    renderMessages();
    $input.value = newText;
    autoResize($input);
    send();
  };

  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  wrap.appendChild(ta);
  wrap.appendChild(actions);

  bub.replaceWith(wrap);
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
}

function autoResizeTA(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}

function renderHistList() {
  $histList.innerHTML = '';
  const sorted = Object.values(sessions).sort((a,b) => (b.ts||0)-(a.ts||0));
  if (!sorted.length) {
    $histList.innerHTML = '<div style="padding:24px 14px;font-size:12px;color:#ccc;text-align:center;">Belum ada riwayat</div>';
    return;
  }
  sorted.forEach(s => {
    const el = document.createElement('div');
    el.className = 'hist-item' + (s.id === activeId ? ' active' : '');
    el.innerHTML = '<div class="hist-meta"><div class="hist-title">' + (s.mode === 'multi' ? '⚡ ' : '') + escHtml(s.title||'Chat') + '</div></div>';
    attachLongPress(el, (x, y) => {
      showCtxMenu(x, y, [
        { label: 'Hapus', icon: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 3.5h10M5.5 3.5V2a1 1 0 011-1h1a1 1 0 011 1v1.5M5 6.5v5M9 6.5v5"/></svg>', danger: true, action: () => deleteHistory(s.id) },
        { label: 'Edit Nama', icon: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2l4 4-7 7H1v-4l7-7z"/></svg>', action: () => { loadHistory(s.id); setTimeout(renameChat, 100); } },
      ]);
    });
    el.onclick = () => loadHistory(s.id);
    $histList.appendChild(el);
  });
}
function loadHistory(id) {
  if (!sessions[id]) return;
  activeId = id; saveSessions(); renderHistList(); renderMessages(); updateTopbarTitle();
  chatMode = sessions[id].mode || 'normal';
  localStorage.setItem(LS_CHATMODE, chatMode);
  updateChatModeTabsUI();
  $tokenInfo.textContent = sessions[id].tokens ? '~' + sessions[id].tokens + ' tok' : '';
  if (window.innerWidth < 700) closeSidebar();
}
function deleteHistory(id) {
  delete sessions[id]; saveSessions();
  if (id === activeId) {
    activeId = null;
    const remaining = Object.values(sessions).sort((a,b)=>(b.ts||0)-(a.ts||0));
    if (remaining.length) {
      activeId = remaining[0].id;
      renderHistList(); renderMessages(); updateTopbarTitle();
      $tokenInfo.textContent = sessions[activeId].tokens ? '~'+sessions[activeId].tokens+' tok' : '';
    } else {
      renderHistList(); showEmptyState(); updateTopbarTitle(); $tokenInfo.textContent = '';
    }
  } else { renderHistList(); }
  toast('Riwayat dihapus');
}
function newChat() {
  const id = uid();
  sessions[id] = { id, title:'Tanpa Judul', messages:[], tokens:0, ts:Date.now(), mode: chatMode };
  activeId = id; saveSessions(); renderHistList(); showEmptyState(); updateTopbarTitle();
  $tokenInfo.textContent = '';
  if (window.innerWidth < 700) closeSidebar();
}

function showEmptyState() {
  $msgs.innerHTML = '';
  const es = document.createElement('div');
  es.className = 'slide-in-right';
  if (chatMode === 'multi') {
    es.id = 'empty-state';
    const models = getAllModels();
    es.className += ' multi-hero';
    es.innerHTML = '<div class="multi-hero-title">Multi<br>Chat</div>'
      + '<div class="multi-hero-sub">Bandingkan AI sekaligus dalam satu pertanyaan</div>'
      + '<div class="multi-hero-cards">' + models.map(m =>
        '<div class="multi-hero-card" style="--mc:' + getModelColor(m.value) + '">'
        + '<div class="mhc-icon">' + (m.icon || '') + '</div>'
        + '<div class="mhc-name">' + escHtml(m.label.replace('Oxy ', '')) + '</div>'
        + '<div class="mhc-sub">' + escHtml(getModelSub(m.value)) + '</div>'
        + '</div>'
      ).join('') + '</div>'
      + '<div class="multi-hero-hint">✏️ Ketik pertanyaan di bawah untuk mulai</div>';
    $msgs.appendChild(es);
    return;
  }
  es.id = 'empty-state';
  es.innerHTML = '<div class="es-title">Qwerty</div><div class="es-grid">'
    + '<button class="es-pill" onclick="fillPrompt(\'Buat HTML yang Bagus Dan Keren\')"><svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M1.8 1.5h9.4l-.9 9.3-3.8 1.4-3.8-1.4-.9-9.3z"/><path d="M4.6 5L3.5 6.5L4.6 8M8.4 5L9.5 6.5L8.4 8"/></svg>Buat HTML</button>'
    + '<button class="es-pill" onclick="fillPrompt(\'Ajari saya coding dari dasar, mulai dari mana?\')"><svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 2.6C5.2 1.6 3.2 1.4 1.5 1.9v8.4c1.7-.5 3.7-.3 5 .7 1.3-1 3.3-1.2 5-.7V1.9c-1.7-.5-3.7-.3-5 .7z"/><path d="M6.5 2.6v8.4"/></svg>Belajar Coding</button>'
    + '<button class="es-pill" onclick="fillPrompt(\'Qwerty itu apa dan bisa bantu apa saja?\')"><svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="6.5" cy="6.5" r="5"/><path d="M6.5 5.5v4M6.5 4h.01"/></svg>Tentang Qwerty</button>'
    + '<button class="es-pill" onclick="fillPrompt(\'Buat script Python Yang Keren\')"><svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 10.5C2 10.5 2 6.8 5 6.8C8 6.8 8 3.2 11 3.2"/><circle cx="11" cy="3.2" r="1" fill="currentColor" stroke="none"/></svg>Buat Python</button>'
    + '</div>'
    + '<button class="es-pill es-pill-image" onclick="activateImageGenMode()"><svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="2" width="10" height="9" rx="1.3"/><circle cx="4.5" cy="5" r="1"/><path d="M1.8 8.8l2.5-2.6 2 2 2.4-2.9 2.3 2.9"/></svg>Generate Image</button>';
  $msgs.appendChild(es);
}
function toPlainSpeech(text) {
  let t = stripThinkBlocks(text || '');
  t = t.replace(/```[\s\S]*?```/g, ' Ada blok kode di sini. ');
  t = t.replace(/`([^`]+)`/g, '$1');
  t = t.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  t = t.replace(/[*_#>~]/g, '');
  t = t.replace(/\n{2,}/g, '. ');
  t = t.replace(/\n/g, ' ');
  return t.trim();
}
let activeUtterance = null, activeSoundBtn = null;
function toggleSpeech(text, btn) {
  if (!('speechSynthesis' in window)) { toast('Browser gak support text-to-speech'); return; }
  if (activeSoundBtn === btn) {
    speechSynthesis.cancel();
    btn.classList.remove('speaking');
    activeUtterance = null; activeSoundBtn = null;
    return;
  }
  speechSynthesis.cancel();
  if (activeSoundBtn) activeSoundBtn.classList.remove('speaking');
  const plain = toPlainSpeech(text);
  if (!plain) { toast('Gak ada teks buat dibacain'); return; }
  const utter = new SpeechSynthesisUtterance(plain);
  utter.lang = 'id-ID';
  const reset = () => { btn.classList.remove('speaking'); if (activeSoundBtn === btn) { activeUtterance = null; activeSoundBtn = null; } };
  utter.onend = reset; utter.onerror = reset;
  activeUtterance = utter; activeSoundBtn = btn;
  btn.classList.add('speaking');
  speechSynthesis.speak(utter);
}
function buildMsgActionBar(m, content) {
  const bar = document.createElement('div');
  bar.className = 'msg-action-bar';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'msg-action-btn';
  copyBtn.title = 'Salin';
  copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="13" height="13" rx="2.5"/><path d="M4.5 15.5A2 2 0 0 1 3 13.5v-9A2 2 0 0 1 5 2.5h9a2 2 0 0 1 2 2"/></svg>';
  copyBtn.onclick = () => navigator.clipboard.writeText(stripThinkBlocks(content)).then(() => toast('Disalin!'));
  bar.appendChild(copyBtn);

  const upBtn = document.createElement('button');
  upBtn.className = 'msg-action-btn' + (m.feedback === 'up' ? ' active' : '');
  upBtn.title = 'Suka';
  upBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>';
  const downBtn = document.createElement('button');
  downBtn.className = 'msg-action-btn' + (m.feedback === 'down' ? ' active' : '');
  downBtn.title = 'Gak suka';
  downBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/></svg>';
  upBtn.onclick = () => {
    m.feedback = (m.feedback === 'up') ? null : 'up';
    upBtn.classList.toggle('active', m.feedback === 'up');
    downBtn.classList.remove('active');
    saveSessions();
  };
  downBtn.onclick = () => {
    m.feedback = (m.feedback === 'down') ? null : 'down';
    downBtn.classList.toggle('active', m.feedback === 'down');
    upBtn.classList.remove('active');
    saveSessions();
  };
  bar.appendChild(upBtn);
  bar.appendChild(downBtn);

  const soundBtn = document.createElement('button');
  soundBtn.className = 'msg-action-btn';
  soundBtn.title = 'Dengarkan';
  soundBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
  soundBtn.onclick = () => toggleSpeech(content, soundBtn);
  bar.appendChild(soundBtn);

  return bar;
}
function renderMessages() {
  $msgs.innerHTML = '';
  const sess = sessions[activeId];
  if (!sess || !sess.messages || !sess.messages.length) { showEmptyState(); return; }
  sess.messages.forEach((m, idx) => {
    const content = typeof m.content === 'string' ? m.content : '';
    if (m.role === 'user') {
      const next = sess.messages[idx + 1];
      if (next && next.role === 'assistant' && next.mode === 'multi') return;
      const row = document.createElement('div');
      row.className = 'msg-row user';
      const bub = document.createElement('div');
      bub.className = 'bubble user-bubble';
      bub.innerHTML = renderMDInline(content);
      bub.style.userSelect = 'none';
      bub.style.webkitUserSelect = 'none';
      attachLongPress(bub, (x, y) => {
        showCtxMenu(x, y, [
          { label: 'Salin', icon: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="8" height="8" rx="1.5"/><path d="M2 10V2h8"/></svg>', action: () => navigator.clipboard.writeText(content).then(() => toast('Disalin!')) },
          { label: 'Edit', icon: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2l4 4-7 7H1v-4l7-7z"/></svg>', action: () => startEditBubble(bub, row, idx, content) },
        ]);
      });
      row.appendChild(bub);
      $msgs.appendChild(row);
    } else if (m.role === 'assistant' && m.mode === 'multi' && Array.isArray(m.answers)) {
      const prevUser = sess.messages[idx - 1];
      const qText = (prevUser && typeof prevUser.content === 'string') ? prevUser.content : '';
      const allModels = getAllModels();
      const modelsForNodes = m.answers.map(a => {
        const def = allModels.find(mm => mm.value === a.model);
        return { value: a.model, label: a.label || a.model || 'AI', icon: (def && def.icon) || '' };
      });
      const { turn, boxByModel } = buildMultiCanvasTurn(qText, modelsForNodes);
      m.answers.forEach(a => {
        const body = boxByModel[a.model];
        if (!body) return;
        if (a.error) {
          body.className = 'multi-answer-body err';
          body.textContent = a.error;
        } else {
          body.className = 'multi-answer-body';
          renderMDFull(a.content || '', body);
        }
      });
      $msgs.appendChild(turn);
    } else if (m.role === 'assistant' && !m.draft) {
      const row = document.createElement('div');
      row.className = 'msg-row ai';
      const cnt = document.createElement('div');
      cnt.className = 'ai-content';
      row.appendChild(cnt);
      $msgs.appendChild(row);
      renderMDFull(content, cnt);
      if (m.interrupted) {
        const note = document.createElement('div');
        note.style.cssText = 'font-size:11.5px;color:var(--text-muted);font-style:italic;margin-top:4px;';
        note.textContent = 'Terputus pas lagi jalan (app sempet ketutup/direload), balasan ini gak lengkap.';
        cnt.appendChild(note);
      }
      if (webSearchEnabled) {
        const srcs = extractSources(stripThinkBlocks(content));
        const srcEl = buildSourcesEl(srcs);
        if (srcEl) cnt.appendChild(srcEl);
      }
      cnt.appendChild(buildMsgActionBar(m, content));
    }
  });
  if (activeStream && activeStream.sessionId === activeId) {
    const aiRow = document.createElement('div');
    aiRow.className = 'msg-row ai';
    const cnt = document.createElement('div');
    cnt.className = 'ai-content';
    aiRow.appendChild(cnt);
    $msgs.appendChild(aiRow);
    activeStream.rebind(cnt);
  }
  requestAnimationFrame(() => { $msgs.scrollTop = $msgs.scrollHeight; });
}

function makeStreamingRenderer(container, signal) {
  const nodes = [];
  let targetText = '';
  let shownLen = 0;
  let rafId = null;
  let lastScrollTs = 0;

  let lockedParts = [];
  let lockedUpTo = 0;

  function scrollIfNeeded() {
    const now = performance.now();
    if (now - lastScrollTs < 80) return;
    lastScrollTs = now;
    forceScrollBottom();
  }

  function ensureTextNode(i) {
    if (nodes[i] && nodes[i].type === 'text') return nodes[i];
    if (nodes[i]) nodes[i].el.remove();
    const div = document.createElement('div');
    container.appendChild(div);
    nodes[i] = { type:'text', el: div, prevContent: '' };
    return nodes[i];
  }

  function ensureCodeNode(i, lang) {
    if (nodes[i] && nodes[i].type === 'code') return nodes[i];
    if (nodes[i]) nodes[i].el.remove();
    const wrap = document.createElement('div');
    wrap.className = 'code-block-wrap';
    const hdr = document.createElement('div');
    hdr.className = 'code-block-header';
    const langLabel = document.createElement('span');
    langLabel.className = 'code-block-lang';
    langLabel.textContent = guessLangLabel(lang);
    const actions = document.createElement('div');
    actions.className = 'code-block-actions';
    const copyBtn = document.createElement('button');
    copyBtn.className = 'code-block-btn';
    copyBtn.title = 'Salin';
    copyBtn.setAttribute('aria-label', 'Salin');
    copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="13" height="13" rx="2.5"/><path d="M4.5 15.5A2 2 0 0 1 3 13.5v-9A2 2 0 0 1 5 2.5h9a2 2 0 0 1 2 2"/></svg>';
    actions.appendChild(copyBtn);
    let prevBtn = null;
    if (lang === 'html' || lang === 'htm') {
      prevBtn = document.createElement('button');
      prevBtn.className = 'code-block-btn code-block-btn-play';
      prevBtn.title = 'Preview';
      prevBtn.setAttribute('aria-label', 'Preview');
      prevBtn.innerHTML = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"><path d="M3 1.8v10.4c0 .7.75 1.13 1.35.76l8.2-5.2a.9.9 0 0 0 0-1.52l-8.2-5.2C3.75.67 3 1.1 3 1.8z"/></svg>';
      actions.appendChild(prevBtn);
    }
    hdr.appendChild(langLabel);
    hdr.appendChild(actions);
    const body = document.createElement('div');
    body.className = 'code-block-body';
    const pre = document.createElement('pre');
    body.appendChild(pre);
    wrap.appendChild(hdr);
    wrap.appendChild(body);
    container.appendChild(wrap);

    const ref = { type:'code', el:wrap, pre, body, lang, langLabel, copyBtn, prevBtn, prevContent:'', lastHighlightLen:0, closed:false, highlightedOnce:false };
    nodes[i] = ref;
    copyBtn.onclick = () => navigator.clipboard.writeText(ref.prevContent||'').then(() => toast('Kode disalin!'));
    if (prevBtn) prevBtn.onclick = () => {
      const c = ref.prevContent||'';
      openModal(guessTitleFromCode(c, ref.lang), ref.lang, c);
      switchTab('preview');
    };
    return ref;
  }

  function ensureThinkNode(i) {
    if (nodes[i] && nodes[i].type === 'think') return nodes[i];
    if (nodes[i]) nodes[i].el.remove();
    const pill = document.createElement('div');
    pill.className = 'think-pill';
    pill.innerHTML = '<span class="think-icon"><svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="6.5" cy="6.5" r="5.2"/><path d="M6.5 4v2.6l1.7 1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>'
      + '<span class="think-label">Thinking</span><span class="think-chevron">&gt;</span>';
    container.appendChild(pill);
    const ref = { type:'think', el: pill, prevContent: '' };
    pill.onclick = () => openThinkModal(ref.prevContent, ref);
    nodes[i] = ref;
    return ref;
  }
  function updateThinkNode(ref, content, closed) {
    if (ref.prevContent !== content) {
      ref.prevContent = content;
      if (activeThinkRef === ref) {
        document.getElementById('think-modal-body').textContent = content.trim();
      }
    }
    if (closed && !ref.doneHidden && ref.el && ref.el.parentNode) {
      ref.doneHidden = true;
      const el = ref.el;
      el.style.overflow = 'hidden';
      el.style.maxHeight = el.offsetHeight + 'px';
      el.style.transition = 'opacity 0.25s ease, max-height 0.25s ease, margin 0.25s ease';
      requestAnimationFrame(() => {
        el.style.opacity = '0';
        el.style.maxHeight = '0px';
        el.style.marginBottom = '0px';
      });
      setTimeout(() => { if (el.parentNode) el.remove(); }, 260);
    }
  }

  function updateCodeNode(ref, newContent, isClosed) {
    if (ref.prevContent === newContent && ref.closed === isClosed) return;
    // langLabel selalu nampilin nama bahasa (HTML/JS/dll) dan gak diubah-ubah lagi selama/sesudah ngoding.
    // Nama file cuma dipake internal pas buka modal preview / download, bukan buat header codebox.

    const grew = newContent.length > ref.prevContent.length && newContent.startsWith(ref.prevContent);

    if (!ref.highlightedOnce && grew && !isClosed) {
      const addition = newContent.slice(ref.prevContent.length);
      if (addition) ref.pre.appendChild(document.createTextNode(addition));
      ref.prevContent = newContent;

      if (newContent.length - ref.lastHighlightLen > 200) {
        ref.pre.innerHTML = highlightCode(newContent, ref.lang);
        ref.lastHighlightLen = newContent.length;
      }
      ref.body.scrollTop = ref.body.scrollHeight;
      return;
    }

    ref.pre.innerHTML = highlightCode(newContent, ref.lang);
    ref.prevContent = newContent;
    ref.lastHighlightLen = newContent.length;
    ref.highlightedOnce = true;
    ref.closed = isClosed;
    ref.body.scrollTop = ref.body.scrollHeight;
  }

  function updateTextNode(ref, newContent, isClosed) {
    if (ref.prevContent === newContent && ref.closed === isClosed) return;
    ref.el.innerHTML = renderMDInline(newContent);
    ref.prevContent = newContent;
    ref.closed = isClosed;
  }

  function tokenizeTail(tail) {
    const tailParts = [];
    let i = 0;
    while (i < tail.length) {
      const fenceIdx = tail.indexOf('```', i);
      const thinkIdx = tail.indexOf('<think>', i);
      let nextIdx = -1, kind = null;
      if (fenceIdx !== -1 && (thinkIdx === -1 || fenceIdx < thinkIdx)) { nextIdx = fenceIdx; kind = 'code'; }
      else if (thinkIdx !== -1) { nextIdx = thinkIdx; kind = 'think'; }

      if (nextIdx === -1) {
        const rest = tail.slice(i);
        if (rest) tailParts.push({ type:'text', content: rest, closed:false, consumedLen: rest.length });
        break;
      }

      if (nextIdx > i) {
        const t = tail.slice(i, nextIdx);
        if (t) tailParts.push({ type:'text', content: t, closed:true, consumedLen: t.length });
      }

      if (kind === 'code') {
        const afterFence = tail.slice(nextIdx + 3);
        const nlIdx = afterFence.indexOf('\n');
        if (nlIdx === -1) {
          tailParts.push({ type:'code', lang:'', content:'', closed:false, consumedLen: tail.length - nextIdx });
          i = tail.length; break;
        }
        const lang = afterFence.slice(0, nlIdx).trim().toLowerCase();
        const bodyAndRest = afterFence.slice(nlIdx + 1);
        const endIdx = bodyAndRest.indexOf('```');
        if (endIdx === -1) {
          tailParts.push({ type:'code', lang, content: bodyAndRest, closed:false, consumedLen: tail.length - nextIdx });
          i = tail.length; break;
        } else {
          const consumedLen = (nextIdx + 3 + nlIdx + 1 + endIdx + 3) - nextIdx;
          tailParts.push({ type:'code', lang, content: bodyAndRest.slice(0, endIdx), closed:true, consumedLen });
          i = nextIdx + consumedLen;
        }
      } else {
        const afterTag = tail.slice(nextIdx + 7);
        const endIdx = afterTag.indexOf('</think>');
        if (endIdx === -1) {
          tailParts.push({ type:'think', content: afterTag, closed:false, consumedLen: tail.length - nextIdx });
          i = tail.length; break;
        } else {
          const consumedLen = (nextIdx + 7 + endIdx + 8) - nextIdx;
          tailParts.push({ type:'think', content: afterTag.slice(0, endIdx), closed:true, consumedLen });
          i = nextIdx + consumedLen;
        }
      }
    }
    return tailParts;
  }

  function getParts(visibleText) {
    const tail = visibleText.slice(lockedUpTo);
    const tailParts = tokenizeTail(tail);

    if (tailParts.length > 1) {
      const newlyLocked = tailParts.slice(0, -1);
      newlyLocked.forEach(p => { p.closed = true; });
      const consumed = newlyLocked.reduce((acc, p) => acc + p.consumedLen, 0);
      lockedParts = lockedParts.concat(newlyLocked);
      lockedUpTo += consumed;
    }

    const last = tailParts.length ? tailParts[tailParts.length - 1] : null;
    return last ? lockedParts.concat([last]) : lockedParts.slice();
  }

  function paint() {
    const visibleText = targetText.slice(0, shownLen);
    const parts = getParts(visibleText);

    parts.forEach((seg, i) => {
      if (seg.type === 'text') {
        const ref = ensureTextNode(i);
        updateTextNode(ref, seg.content, !!seg.closed);
      } else if (seg.type === 'code') {
        const ref = ensureCodeNode(i, seg.lang);
        updateCodeNode(ref, seg.content, !!seg.closed);
      } else if (seg.type === 'think') {
        const ref = ensureThinkNode(i);
        updateThinkNode(ref, seg.content, !!seg.closed);
      }
    });
  }

  function activeSegmentType() {
    const visibleText = targetText.slice(0, shownLen);
    const tail = visibleText.slice(lockedUpTo);
    const tailParts = tokenizeTail(tail);
    return tailParts.length ? tailParts[tailParts.length - 1].type : null;
  }

  // ====== SETTING KECEPATAN TYPING (edit di sini sesuka lo) ======
  // TICK_INTERVAL = jeda waktu (ms) tiap langkah muncul
  // CHARS_PER_TICK = jumlah HURUF yang muncul setiap langkah (1 = 1 huruf, 2 = 2 huruf, dst)
  const TEXT_TICK_INTERVAL = 25;
  const TEXT_CHARS_PER_TICK = 5;
  const CODE_TICK_INTERVAL = 30;
  const CODE_CHARS_PER_TICK = 30;
  const THINK_TICK_INTERVAL = 1;
  const THINK_CHARS_PER_TICK = 60;
  // =================================================================
  let lastTickTime = 0;

  function isWordChar(c) {
    return c !== undefined && /[A-Za-z0-9_]/.test(c);
  }

  function nextWordEnd(fromIdx) {
    if (isWordChar(targetText[fromIdx])) {
      let i = fromIdx;
      while (i < targetText.length && isWordChar(targetText[i])) i++;
      return i;
    }
    return fromIdx + 1;
  }

  function isSpaceChar(c) {
    return c === ' ' || c === '\n' || c === '\t' || c === '\r';
  }

  function nextWordsEnd(fromIdx, count) {
    let i = fromIdx;
    const len = targetText.length;
    for (let w = 0; w < count && i < len; w++) {
      while (i < len && isSpaceChar(targetText[i])) i++;
      while (i < len && !isSpaceChar(targetText[i])) i++;
    }
    while (i < len && isSpaceChar(targetText[i])) i++;
    return i > fromIdx ? i : fromIdx + 1;
  }

  function tick(ts) {
    if (signal && signal.aborted) { rafId = null; lastTickTime = 0; return; }
    if (!lastTickTime) lastTickTime = ts;
    const segType = activeSegmentType();
    const isCode = segType === 'code';
    const isThink = segType === 'think';
    const interval = isCode ? CODE_TICK_INTERVAL : (isThink ? THINK_TICK_INTERVAL : TEXT_TICK_INTERVAL);
    if (ts - lastTickTime >= interval) {
      if (shownLen < targetText.length) {
        let step;
        if (isCode) {
          step = Math.min(targetText.length - shownLen, CODE_CHARS_PER_TICK);
        } else if (isThink) {
          step = Math.min(targetText.length - shownLen, THINK_CHARS_PER_TICK);
        } else {
          step = Math.min(targetText.length - shownLen, TEXT_CHARS_PER_TICK);
        }
        shownLen = Math.min(targetText.length, shownLen + step);
        paint();
        scrollIfNeeded();
      }
      lastTickTime = ts;
    }
    if (shownLen < targetText.length && !(signal && signal.aborted)) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = null;
      lastTickTime = 0;
    }
  }

  function update(fullText) {
    targetText = fullText;
    if (!rafId && !(signal && signal.aborted)) rafId = requestAnimationFrame(tick);
  }

  update.flush = function(fullText) {
    targetText = fullText;
    shownLen = fullText.length;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    paint();
    nodes.forEach(ref => {
      if (ref && ref.type === 'code' && !ref.closed) {
        ref.pre.innerHTML = highlightCode(ref.prevContent, ref.lang);
        ref.closed = true;
      }
    });
    forceScrollBottom();
  };

  update.waitUntilDone = function(sig) {
    return new Promise(resolve => {
      function check() {
        if (sig && sig.aborted) { resolve(true); return; }
        if (shownLen >= targetText.length) { resolve(false); return; }
        requestAnimationFrame(check);
      }
      check();
    });
  };

  return update;
}


function fill(text) {
  if (!activeId || !sessions[activeId]) newChat();
  $input.value = text; autoResize($input); send();
}
async function sendMulti(text) {
  if (isMsgLimitReached()) {
    updateLimitBannerUI();
    toast('Limit Tercapai! Upgrade ke Paket Pro atau Max');
    return;
  }
  userScrolledUp = false; $scrollBtn.classList.remove('show');
  isStreaming = true;
  const ac = new AbortController();
  abortController = ac;
  $input.value = ''; autoResize($input); setSendLoading(true);

  const sess = sessions[activeId];
  sess.messages.push({ role:'user', content:text });
  sess.ts = Date.now(); saveSessions(); renderHistList();
  incrementMsgCount();

  document.getElementById('empty-state')?.remove();

  const models = getAllModels();
  const { turn, boxByModel } = buildMultiCanvasTurn(text, models);
  $msgs.appendChild(turn); forceScrollBottom();

  const historyMsgs = sess.messages.slice(0, -1).filter(m => typeof m.content === 'string');
  const apiMessages = historyMsgs.concat([{ role:'user', content:text }]);

  const systemMsg = [{
    role: 'system',
    content: 'Kamu adalah Qwerty, asisten yang dibuat oleh Abid. Akun TikTok pembuat lu adalah @BidzQwerty. Jawab pertanyaan pengguna dengan jelas, singkat, padat, dan akurat.' +
      ' WAJIB pake bahasa gaul Indonesia yang santai dan kekinian, JANGAN PERNAH pake bahasa formal atau baku. Contoh yang wajib lu pake:' +
      ' Saya = Gw/Gue, Enggak = Gak/Ga, Kamu = Lu/Lo, Ini = Ni, Itu = Tuh, Bentar = Tar/Santai, Baik = Oke/Sip, Bagus = Keren/Mantep, ' +
      ' Sangat = Banget/Bgt, Sekarang = Skrg, Nanti = Tar, Sudah = Udah, Belum = Blom, Tidak Bisa = Gabisa, ' +
      ' Mungkin = Kayanya/Kali, Tidak = Nga, Kenapa = Napa, Dimana = Dmn, Kapan = Kpn, Bagaimana = Gimana, ' +
      ' Tolong = Bantu, Terima Kasih = Makasih/Makasi, Sama-Sama = Sama-sama/Sip.' +
      ' Jangan pake kata "bro", "cuy", "bang", atau "gan". Boleh pake emoji sesekali secukupnya, jangan berlebihan.' +
      (userName ? ' Nama pengguna adalah "' + userName + '". Panggil sesekali secara natural.' : '') +
      (customInstructions ? '\n\n=== INSTRUKSI KHUSUS DARI USER (WAJIB DIPATUHI) ===\n' + customInstructions : '') +
      getThinkingInstruction()
  }];

  const results = new Array(models.length).fill(null);

  await Promise.allSettled(models.map(async (m, i) => {
    const body = boxByModel[m.value];
    try {
      const res = await callOxyAPI(m.value, {
        model: m.value,
        messages: [...systemMsg, ...apiMessages],
        stream: false,
        temperature: 1.0,
        ...getReasoningExtraParams(m.value)
      }, { signal: ac.signal });
      if (!res.ok) { const e = await res.json().catch(()=>{}); throw new Error((e && e.error && e.error.message) || 'HTTP ' + res.status); }
      const data = await res.json();
      const msgObj = (data.choices && data.choices[0] && data.choices[0].message) || {};
      const reasoningTxt = msgObj.reasoning_content || msgObj.reasoning || '';
      const content = (reasoningTxt ? ('<think>' + reasoningTxt + '</think>') : '') + (msgObj.content || (reasoningTxt ? '' : '(kosong)'));
      const clean = stripThinkBlocks(content);
      results[i] = { model: m.value, label: m.label, content: clean, error: null };
      body.innerHTML = '';
      renderMDFull(content, body);
      if (data.usage) { sess.tokens = (sess.tokens || 0) + (data.usage.total_tokens || 0); $tokenInfo.textContent = '~' + sess.tokens + ' tok'; }
    } catch(err) {
      const msg = err.name === 'AbortError' ? 'Dihentikan' : ('Error: ' + err.message);
      results[i] = { model: m.value, label: m.label, content: '', error: msg };
      body.className = 'multi-answer-body err';
      body.textContent = msg;
    }
    if (turn.isConnected) forceScrollBottom();
  }));

  sess.messages.push({ role: 'assistant', mode: 'multi', answers: results });
  sess.ts = Date.now();

  const isFirstExchange = sess.messages.length === 2;
  if (isFirstExchange) sess.title = text.slice(0, 30) + (text.length > 30 ? '...' : '');
  saveSessions(); renderHistList(); updateTopbarTitle();

  isStreaming = false; abortController = null; setSendLoading(false);
  $scrollBtn.classList.remove('show'); $input.blur();
}

async function send() {
  let text = $input.value.trim();
  const usingImageMode = imageGenModeActive;
  if (usingImageMode && !text) text = 'gambar acak yang unik dan keren';
  if (!text || isStreaming) return;
  if (isMsgLimitReached()) {
    updateLimitBannerUI();
    toast('Limit Tercapai! Upgrade ke Paket Pro atau Max');
    return;
  }
  if (!activeId || !sessions[activeId]) {
    const id = uid();
    sessions[id] = { id, title:'Chat baru', messages:[], tokens:0, ts:Date.now(), mode: chatMode };
    activeId = id; saveSessions(); renderHistList();
  }
  if (sessions[activeId].mode === 'multi' && !usingImageMode) {
    if (pendingAttachment && pendingAttachment.type === 'image') {
      toast('Mode Multi Chat belum bisa baca gambar, ganti ke Normal Chat dulu');
      return;
    }
    await sendMulti(text); return;
  }
  userScrolledUp = false; $scrollBtn.classList.remove('show');
  isStreaming = true;
  const ac = new AbortController();
  abortController = ac;
  $input.value = ''; autoResize($input); setSendLoading(true);

  const sess = sessions[activeId];

  let userMsgContent;
  const attach = pendingAttachment;
  if (attach) {
    const parts = [];
    if (attach.type === 'image') {
      parts.push({ type: 'image_url', image_url: { url: 'data:' + attach.mediaType + ';base64,' + attach.base64 } });
    } else if (attach.type === 'pdf') {
      parts.push({ type: 'text', text: '[File PDF dilampirkan: ' + attach.name + ', ' + formatFileSize(attach.size) + '. Isi PDF gabisa dibaca otomatis, bilang ke user kalo mau dianalisis mending copas teksnya langsung ke chat.]' });
    } else if (attach.textContent != null) {
      parts.push({ type: 'text', text: '[File dilampirkan: ' + attach.name + ', ' + formatFileSize(attach.size) + ']\nIsi file:\n```\n' + attach.textContent + '\n```' });
    } else {
      parts.push({ type: 'text', text: '[File dilampirkan: ' + attach.name + ', ' + formatFileSize(attach.size) + '. Isi file ini gabisa dibaca otomatis (format binary), kasih tau user kalo mau dianalisis mending copas isinya langsung ke chat.]' });
    }
    parts.push({ type: 'text', text });
    userMsgContent = parts;
  } else {
    userMsgContent = text;
  }

  sess.messages.push({ role:'user', content: typeof userMsgContent === 'string' ? userMsgContent : text });
  sess.ts = Date.now(); saveSessions(); renderHistList();
  incrementMsgCount();

  // Draft placeholder buat balasan AI, biar kalo app ke-reload pas lagi jalan (keluar app bentar dll),
  // isi yang udah sempet nyampe tetep kesimpen di localStorage, gak ilang pas balik lagi.
  sess.messages.push({ role:'assistant', content:'', draft:true });
  const draftIdx = sess.messages.length - 1;
  let lastDraftSaveAt = 0;
  function saveDraftThrottled(force) {
    const now = Date.now();
    if (!force && now - lastDraftSaveAt < 700) return;
    lastDraftSaveAt = now;
    if (sess.messages[draftIdx] && sess.messages[draftIdx].draft) {
      sess.messages[draftIdx].content = full;
      saveSessions();
    }
  }
  activeDraftFlush = () => saveDraftThrottled(true);

  const userRow = document.createElement('div');
  userRow.className = 'msg-row user';
  const userCol = document.createElement('div');
  userCol.className = 'user-msg-col';
  if (attach && attach.type !== 'image') {
    const fileBox = document.createElement('div');
    fileBox.className = 'msg-file-box';
    fileBox.innerHTML = FILE_ICON_SVG
      + '<div class="msg-file-box-info"><div class="msg-file-box-name">' + escHtml(attach.name) + '</div><div class="msg-file-box-size">' + formatFileSize(attach.size) + '</div></div>';
    userCol.appendChild(fileBox);
  }
  const userBub = document.createElement('div');
  userBub.className = 'bubble user-bubble';
  userBub.style.userSelect = 'none';
  userBub.style.webkitUserSelect = 'none';
  if (attach && attach.type === 'image') {
    userBub.innerHTML = '<img src="data:' + attach.mediaType + ';base64,' + attach.base64 + '" style="max-width:200px;max-height:160px;border-radius:10px;display:block;margin-bottom:6px;">';
    userBub.innerHTML += renderMDInline(text);
  } else {
    userBub.innerHTML = renderMDInline(text);
  }
  const liveMsgIdx = sess.messages.length - 1;
  const liveText = text;
  attachLongPress(userBub, (x, y) => {
    showCtxMenu(x, y, [
      { label: 'Salin', icon: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="8" height="8" rx="1.5"/><path d="M2 10V2h8"/></svg>', action: () => navigator.clipboard.writeText(liveText).then(() => toast('Disalin!')) },
      { label: 'Edit', icon: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2l4 4-7 7H1v-4l7-7z"/></svg>', action: () => startEditBubble(userBub, userCol, liveMsgIdx, liveText) },
    ]);
  });
  userCol.appendChild(userBub);
  userRow.appendChild(userCol);
  document.getElementById('empty-state')?.remove();
  $msgs.appendChild(userRow); forceScrollBottom();

  clearAttachment();
  if (usingImageMode) deactivateImageGenMode();

  const aiRow = document.createElement('div');
  aiRow.className = 'msg-row ai';
  let aiContent = document.createElement('div');
  aiContent.className = 'ai-content';
  aiContent.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
  aiRow.appendChild(aiContent); $msgs.appendChild(aiRow); forceScrollBottom();

  if (usingImageMode) {
    aiContent.innerHTML = imageGenLoadingHTML('Lagi bikin gambar...');
    const imgUrl = await generateImage(text, (attempt, max) => {
      aiContent.innerHTML = imageGenLoadingHTML(attempt > 1 ? 'Nyoba lagi (' + attempt + '/' + max + ')...' : 'Lagi bikin gambar...');
    });
    aiContent.innerHTML = '';
    let aiFull;
    if (imgUrl) {
      renderAIImage(aiContent, imgUrl, text);
      aiFull = '![' + text.replace(/[\[\]]/g,'') + '](' + imgUrl + ')';
    } else {
      aiContent.innerHTML = '<span style="color:#ef4444">Limit Reached</span>';
      aiFull = 'Limit Reached untuk generate gambar: ' + text;
    }
    forceScrollBottom();
    sess.messages.push({ role:'assistant', content: aiFull }); sess.ts = Date.now();

    const isFirstExchange = sess.messages.length === 2;
    if (isFirstExchange) {
      sess.title = text.slice(0, 30) + (text.length > 30 ? '...' : '');
      saveSessions(); renderHistList(); updateTopbarTitle();
      generateAITitle(text, aiFull).then(aiTitle => {
        if (aiTitle && sessions[activeId]) {
          sessions[activeId].title = aiTitle;
          saveSessions(); renderHistList(); updateTopbarTitle();
        }
      });
    } else { saveSessions(); renderHistList(); }

    isStreaming = false; abortController = null; setSendLoading(false);
    $scrollBtn.classList.remove('show'); $input.blur();
    return;
  }

  let full = '', first = true, streamUpdate = null;
  let reasoningBuf = '', contentBuf = '', reasoningClosed = false;
  function composeFull() {
    if (!reasoningBuf) return contentBuf;
    return '<think>' + reasoningBuf + (reasoningClosed ? '</think>' : '') + contentBuf;
  }

  activeStream = {
    sessionId: activeId,
    full: '',
    rebind(container) {
      aiContent = container;
      if (full) {
        streamUpdate = makeStreamingRenderer(aiContent, ac.signal);
        streamUpdate.flush(full);
        first = false;
      } else {
        aiContent.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
        streamUpdate = null;
        first = true;
      }
    }
  };

  const apiMessages = sess.messages.slice(0, -2).concat([{ role:'user', content: userMsgContent }]);

  let searchResults = null;
  let searchContext = '';
  if (webSearchEnabled) {
    aiContent.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div><div style="font-size:11.5px;color:var(--text-muted);margin-top:6px;">Mencari di web...</div>';
    searchResults = await performWebSearch(text);
    if (searchResults) {
      searchContext = '\n\nHasil pencarian web terkini untuk pertanyaan pengguna:\n' +
        searchResults.map((r,i) => (i+1) + '. ' + r.text + (r.url ? ' (' + r.url + ')' : '')).join('\n') +
        '\n\nGunakan informasi di atas jika relevan untuk menjawab. Jangan mengarang sumber/URL selain yang diberikan.';
    }
    aiContent.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
  }

const systemMsg = [
  {
    role: 'system',
    content: 'Kamu adalah Qwerty, asisten serba bisa yang dibuat oleh Abid. Akun TikTok pembuat lu adalah @BidzQwerty. Lu bisa diajak ngobrol dan bantu apa aja, mulai dari obrolan santai, curhat, nanya info, sampe hal teknis. Salah satu keahlian lu yang paling jago adalah coding tingkat lanjut, tapi itu BUKAN satu-satunya topik yang lu kuasai.' +
      ' PENTING BANGET: jawab SESUAI topik yang user tanya/omongin. Kalo user ngobrol hal yang gak nyambung sama koding (misal curhat, nanya info umum, ngobrol santai, dll), JANGAN alihin ke topik koding, jangan tiba-tiba nyaranin ngoding atau nyinggung-nyinggung soal kode kalo emang gak diminta. Ikutin arah obrolan user, jangan maksain topik lu sendiri.' +
      (userName ? ' Nama pengguna adalah "' + userName + '". Panggil pengguna dengan nama itu sesekali secara natural, jangan berlebihan.' : '') +
      ' PENTING: JANGAN PERNAH pake kata "bro", "cuy", "bang", atau "gan" dalam balasan apapun, gak peduli situasinya gimana. Panggil user dengan nama dia kalo ada, atau gak usah pake panggilan sama sekali.' +
      ' Bahasa lu WAJIB bahasa gaul Indonesia yang santai, kekinian, kayak ngobrol sama temen deket. JANGAN PERNAH pake bahasa formal, baku, atau kaku kayak robot. Contoh yang wajib lu pake:' +
      ' Saya = Gw/Gue, Enggak = Gak/Ga, Kamu = Lu/Lo, Ini = Ni, Itu = Tuh, Bentar = Tar/Santai, Baik = Oke/Sip, Bagus = Keren/Mantep, ' +
      ' Sangat = Banget/Bgt, Sekarang = Skrg, Nanti = Tar, Sudah = Udah, Belum = Blom, Tidak Bisa = Gabisa, ' +
      ' Mungkin = Kayanya/Kali, Tidak = Nga, Kenapa = Napa, Dimana = Dmn, Kapan = Kpn, Bagaimana = Gimana, ' +
      ' Tolong = Bantu, Terima Kasih = Makasih/Makasi, Sama-Sama = Sama-sama/Sip, ' +
      ' Selamat Pagi = Pagi, Selamat Siang = Siang, Selamat Sore = Sore, Selamat Malam = Malam, ' +
      ' Sampai Jumpa = Dah/Cya, Baiklah = Oke deh, Sebenarnya = Sebenernya, Memang = Emang, Sebaiknya = Lebih baik, ' +
      ' Yang = Yg, Dengan = Sama/Ama, Untuk = Buat/Utk, Karena = Soalnya/Krn, Seperti = Kayak/Kek, Banyak = Banyak/Byk, Ternyata = Ternyata/Tnyata, Iya = Iya/Ya/Yoi, Serius = Serius/Beneran.' +
      ' Lu boleh pake emoji sesekali biar gak kaku, secukupnya aja, jangan berlebihan.' +
      ' Jangan pernah pake titik koma atau tanda baca yang berlebihan. Pake titik aja atau sering-sering pake "...".' +
      ' ' +
      ' === KALO USER MINTA/NANYA SOAL KODE (dan HANYA kalo itu yang diminta) ===' +
      ' ' +
      ' Lu adalah developer expert. Kalo user minta kode, lu HARUS kasih kode yang kompleks dan tingkat lanjut, bukan kode template basic atau contoh tutorial pemula. Pikirin struktur yang rapi, best practice, dan fitur-fitur yang lengkap.' +
      ' Kode lu harus RAPI: indentasi konsisten, penamaan variabel/fungsi yang jelas, dipisah per bagian/komentar singkat kalo perlu, gampang dibaca.' +
      ' Kalo bikin UI/tampilan, pilih PALET WARNA yang nyambung/matching satu sama lain (gak asal warna nabrak), perhatiin kontras dan keserasian biar hasilnya enak dipandang.' +
      ' KALO USER MINTA KODE HTML (apapun bentuknya, mau itu landing page, web app, komponen, dll), lu WAJIB gabungin HTML + CSS + JS jadi SATU FILE aja. Jangan pernah dipisah ke file .css atau .js terpisah kecuali user secara spesifik minta dipisah.' +
      ' Kasih kode langsung, gak usah banyak basa-basi atau muter-muter di penjelasan. Penjelasan singkat aja kalo emang perlu, fokus ke kodenya.' +
      ' Aturan-aturan di atas HANYA berlaku pas user emang minta/nanya soal kode. Kalo topik obrolannya bukan soal itu, abaikan semua aturan coding ini dan jawab natural sesuai konteks obrolan.' +
      ' ' +
      ' === SOAL GENERATE GAMBAR ===' +
      ' ' +
      ' Lu SENDIRI gabisa generate gambar langsung lewat chat biasa. Kalo user minta dibuatin/gambarin sesuatu, lu HARUS bilang kalo mereka harus pencet tombol "Generate Image" yang ada di chatbox dulu, baru ketik deskripsi gambarnya di situ. Jangan pernah pura-pura bisa generate gambar sendiri atau pake format tag apapun.' +
      ' ' +
      (customInstructions ? '\n\n=== INSTRUKSI KHUSUS DARI USER (WAJIB DIPATUHI, prioritas tinggi) ===\n' + customInstructions + '\n' : '') +
      searchContext +
      getThinkingInstruction()
  }
];


  try {
    const hasImageAttach = attach && attach.type === 'image';
    let modelForThisRequest = selectedModel.value;
    let finalApiMessages = apiMessages;

    if (hasImageAttach && !VISION_CAPABLE_MODELS.includes(selectedModel.value)) {
      let imageDesc = '';
      try {
        imageDesc = await describeImageWithVision(attach);
      } catch (e) {
        imageDesc = '';
      }
      const lastMsg = apiMessages[apiMessages.length - 1];
      const keptParts = (Array.isArray(lastMsg.content) ? lastMsg.content : []).filter(p => p.type !== 'image_url');
      keptParts.unshift({ type: 'text', text: imageDesc ? ('[Gambar yang dilampirkan user]\n' + imageDesc + '\n') : '[User melampirkan gambar, tapi gagal dibaca]\n' });
      finalApiMessages = apiMessages.slice(0, -1).concat([{ role: lastMsg.role, content: keptParts }]);
    }

    const res = await callOxyAPI(modelForThisRequest, {
      model: modelForThisRequest,
      messages: [...systemMsg, ...finalApiMessages],
      stream: true,
      temperature: 1.0,
      ...getReasoningExtraParams(modelForThisRequest)
    }, { signal: ac.signal });
    if (!res.ok) { const e = await res.json().catch(()=>{}); throw new Error((e&&e.error&&e.error.message)||'HTTP '+res.status); }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let sseBuffer = '';
    while (true) {
      if (ac.signal.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      sseBuffer += dec.decode(value, { stream:true });
      const parts = sseBuffer.split('\n');
      sseBuffer = parts.pop(); // simpen baris terakhir yang mungkin belum lengkap, sambung di iterasi berikutnya
      const lines = parts.filter(l => l.startsWith('data: '));
      for (const line of lines) {
        const d = line.slice(6).trim();
        if (d === '[DONE]') break;
        try {
          const p = JSON.parse(d);
          const dl = p.choices?.[0]?.delta || {};
          const reasoningDelta = thinkingEnabled ? (dl.reasoning_content || dl.reasoning || '') : '';
          const delta = dl.content || '';
          if (reasoningDelta) {
            if (first) { aiContent.innerHTML = ''; streamUpdate = makeStreamingRenderer(aiContent, ac.signal); first = false; }
            reasoningBuf += reasoningDelta;
            full = composeFull(); streamUpdate(full);
            if (activeStream) activeStream.full = full;
            saveDraftThrottled(false);
            if (aiContent.isConnected) forceScrollBottom();
          }
          if (delta) {
            if (first) { aiContent.innerHTML = ''; streamUpdate = makeStreamingRenderer(aiContent, ac.signal); first = false; }
            if (reasoningBuf && !reasoningClosed) reasoningClosed = true;
            contentBuf += delta;
            full = composeFull(); streamUpdate(full);
            if (activeStream) activeStream.full = full;
            saveDraftThrottled(false);
            if (aiContent.isConnected) forceScrollBottom();
          }
          if (p.usage) { sess.tokens = (sess.tokens||0) + (p.usage.total_tokens||0); $tokenInfo.textContent = '~' + sess.tokens + ' tok'; }
        } catch(err) {}
      }
    }
  } catch(err) {
    if (err.name === 'AbortError') {
      if (full) {
        if (!streamUpdate) { aiContent.innerHTML = ''; renderMDFull(full, aiContent); }
        sess.messages[draftIdx] = { role:'assistant', content:full };
        sess.ts = Date.now(); saveSessions();
      } else {
        aiContent.innerHTML = '<span style="color:#999;font-size:13px;font-style:italic">Dihentikan</span>';
        sess.messages.splice(draftIdx, 1); saveSessions();
      }
      if (activeStream && activeStream.sessionId === activeId) activeStream = null;
      isStreaming = false; abortController = null; setSendLoading(false); activeDraftFlush = null;
      $scrollBtn.classList.remove('show'); $input.blur();
      return;
    }

    aiContent.innerHTML = '<span style="color:#ef4444">Error: ' + escHtml(err.message) + '</span>';
    sess.messages.splice(draftIdx, 1); saveSessions(); toast('Error: ' + err.message, 3500);
    if (activeStream && activeStream.sessionId === activeId) activeStream = null;
    isStreaming = false; abortController = null; setSendLoading(false); activeDraftFlush = null;
    $scrollBtn.classList.remove('show'); $input.blur();
    return;
  }

  if (reasoningBuf && !reasoningClosed) {
    reasoningClosed = true; full = composeFull();
    if (activeStream) activeStream.full = full;
    if (streamUpdate) streamUpdate(full);
  }
  const wasStopped = streamUpdate ? await streamUpdate.waitUntilDone(ac.signal) : false;
  if (!wasStopped) {
    aiContent.innerHTML = '';
    renderMDFull(full, aiContent);
    if (webSearchEnabled) {
      let srcs = extractSources(stripThinkBlocks(full));
      if (!srcs.length && searchResults) {
        srcs = searchResults.filter(r => r.url).map(r => {
          try {
            const u = new URL(r.url);
            return { url: r.url, domain: u.hostname.replace(/^www\./,''), title: r.text.slice(0, 60) };
          } catch(e) { return null; }
        }).filter(Boolean);
      }
      const srcEl = buildSourcesEl(srcs);
      if (srcEl) aiContent.appendChild(srcEl);
    }
  }

  if (activeStream && activeStream.sessionId === activeId) activeStream = null;
  if (aiContent.isConnected) { forceScrollBottom(); $scrollBtn.classList.remove('show'); }
  sess.messages[draftIdx] = { role:'assistant', content:full }; sess.ts = Date.now();

  const isFirstExchange = sess.messages.length === 2;
  if (isFirstExchange) {
    sess.title = text.slice(0, 30) + (text.length > 30 ? '...' : '');
    saveSessions(); renderHistList(); updateTopbarTitle();
    generateAITitle(text, full).then(aiTitle => {
      if (aiTitle && sessions[activeId]) {
        sessions[activeId].title = aiTitle;
        saveSessions(); renderHistList(); updateTopbarTitle();
      }
    });
  } else { saveSessions(); renderHistList(); }

  isStreaming = false; abortController = null; setSendLoading(false); activeDraftFlush = null;
  $scrollBtn.classList.remove('show'); $input.blur();
}

$input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
  if (e.key === 'Backspace' && imageGenModeActive && $input.value.length === 0) { e.preventDefault(); deactivateImageGenMode(); }
});
$input.addEventListener('input', () => autoResize($input));
function handleSendBtn() {
  if (isStreaming) { abortController?.abort(); abortController = null; }
  else if (isMsgLimitReached()) { updateLimitBannerUI(); toast('Limit Tercapai! Upgrade ke Paket Pro atau Max'); }
  else send();
}

setPillModel(selectedModel);
buildModelDD();
updateChatModeTabsUI();
if (activeId && sessions[activeId]) {
  renderHistList(); renderMessages(); updateTopbarTitle();
  $tokenInfo.textContent = sessions[activeId].tokens ? '~' + sessions[activeId].tokens + ' tok' : '';
} else {
  renderHistList(); showEmptyState();
}
renderSidebarAccount();
updateLimitBannerUI();
if (!userName) { showWelcomeOverlay(); }

let wasOffline = !navigator.onLine;
let onlineBannerTimer = null;
function updateOnlineStatus() {
  const offline = !navigator.onLine;
  document.getElementById('offline-banner').classList.toggle('show', offline);
  if (!offline && wasOffline) {
    const banner = document.getElementById('online-banner');
    banner.classList.add('show');
    clearTimeout(onlineBannerTimer);
    onlineBannerTimer = setTimeout(() => banner.classList.remove('show'), 2500);
  }
  wasOffline = offline;
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// ==== Cek status server (SERVER_URL) ====
let serverCheckTimer = null;
async function checkServerHealth() {
  try {
    const res = await fetch(SERVER_URL, { method: 'GET', signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error('bad status');
    document.getElementById('server-down-banner').classList.remove('show');
  } catch (err) {
    document.getElementById('server-down-banner').classList.add('show');
  }
}
checkServerHealth();
serverCheckTimer = setInterval(checkServerHealth, 30000); // cek ulang tiap 30 detik
