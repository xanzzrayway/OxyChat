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
