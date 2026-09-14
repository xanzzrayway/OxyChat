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

// ====== Task Sheet: daftar task/file yang lagi/udah dikerjain AI pas ngoding (dibuka dari pill "Membuat ...") ======
let activeTaskSheetContainer = null;
function openTaskSheet(container) {
  activeTaskSheetContainer = container;
  renderTaskSheetList();
  document.getElementById('task-sheet-backdrop').classList.add('show');
  document.getElementById('task-sheet').classList.add('show');
}
function closeTaskSheet() {
  activeTaskSheetContainer = null;
  document.getElementById('task-sheet-backdrop').classList.remove('show');
  document.getElementById('task-sheet').classList.remove('show');
}
function isTaskSheetOpen() {
  return document.getElementById('task-sheet').classList.contains('show');
}
function renderTaskSheetList() {
  const list = document.getElementById('task-sheet-list');
  if (!activeTaskSheetContainer || !activeTaskSheetContainer.isConnected || !activeTaskSheetContainer._getCodeTasks) {
    closeTaskSheet();
    return;
  }
  const thinkTask = activeTaskSheetContainer._getThinkTask ? activeTaskSheetContainer._getThinkTask() : null;
  const tasks = activeTaskSheetContainer._getCodeTasks();
  const titleEl = document.getElementById('task-sheet-title');
  const allDone = (!thinkTask || thinkTask.closed) && tasks.length > 0 && tasks.every(t => t.closed);
  titleEl.textContent = allDone ? 'Selesai Mengerjakan' : 'Sedang Mengerjakan';
  list.innerHTML = '';

  // Baris timeline: [node ikon + garis penghubung] + [label]. Ikon polos (currentColor), tanpa kotak/border.
  function addRow(iconHtml, iconColor, labelText, closed, onClick) {
    const row = document.createElement('div');
    row.className = 'task-card ' + (closed ? 'done' : 'active');
    const node = document.createElement('div');
    node.className = 'task-card-node';
    node.style.color = iconColor;
    const icon = document.createElement('span');
    icon.className = 'task-card-icon-plain';
    icon.innerHTML = iconHtml;
    const connector = document.createElement('span');
    connector.className = 'task-card-connector';
    node.appendChild(icon); node.appendChild(connector);
    const text = document.createElement('span');
    text.className = 'task-card-text';
    text.textContent = labelText;
    row.appendChild(node); row.appendChild(text);
    if (onClick) { row.classList.add('clickable'); row.onclick = onClick; }
    list.appendChild(row);
    return row;
  }

  if (thinkTask) {
    addRow(
      '<svg viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="6.5" cy="6.5" r="5.2"/><path d="M6.5 4v2.6l1.7 1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      '#7c3aed', 'Berpikir', thinkTask.closed,
      () => openThinkModal(thinkTask.content, thinkTask.ref)
    );
  }
  tasks.forEach(t => {
    const meta = fileIconMeta(t.title, t.lang);
    addRow(meta.svg, meta.color, 'Membuat ' + t.title, t.closed,
      t.closed ? () => openModal(t.title, t.lang, t.content) : null
    );
  });
  if (allDone) {
    const row = addRow(
      '<svg viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.7 6.7l2.6 2.6L10.3 3.7"/></svg>',
      '#16a34a', 'Selesai Mengerjakan', true, null
    );
    row.classList.add('final');
  }
}

// Pesan yang direndernya dari riwayat (bukan lagi streaming) berarti semua taskx udah pasti kelar,
// jadi pill-nya langsung "Task Selesai" — gak perlu nunjukin "Thinking" lagi.
function buildThinkBlock(content, container) {
  const pill = document.createElement('div');
  pill.className = 'think-pill done';
  pill.innerHTML = '<span class="think-icon"><svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.7 6.7l2.6 2.6L10.3 3.7"/></svg></span>'
    + '<span class="think-label">Task Selesai</span><span class="think-chevron">&gt;</span>';
  pill.onclick = () => openTaskSheet(container);
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
  updateModalTitleBox(false);
  document.getElementById('code-modal').classList.add('open');
}
function updateModalTitleBox(showingPreview) {
  const el = document.getElementById('modal-title-text');
  if (el) el.textContent = modalCodeTitle + ' · ' + (showingPreview ? 'Preview' : 'Kode');
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
  updateModalTitleBox(tab === 'preview');
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
  php:'php', ruby:'rb', rb:'rb', sql:'sql', yaml:'yml', yml:'yml', kotlin:'kt', swift:'swift',
  txt:'txt', text:'txt', plaintext:'txt', plain:'txt', md:'md', markdown:'md'
};
// Nama file default per bahasa — dipake pas belum ada penanda nama file eksplisit di kodenya.
const DEFAULT_FILE_NAME = {
  html:'index.html', htm:'index.html', xml:'data.xml',
  css:'style.css', scss:'style.scss', sass:'style.sass',
  js:'script.js', javascript:'script.js', jsx:'App.jsx',
  ts:'script.ts', typescript:'script.ts', tsx:'App.tsx',
  py:'main.py', python:'main.py',
  json:'data.json', bash:'script.sh', shell:'script.sh', sh:'script.sh',
  java:'Main.java', c:'main.c', cpp:'main.cpp', 'c++':'main.cpp', cs:'Program.cs',
  go:'main.go', rust:'main.rs', rs:'main.rs',
  php:'index.php', ruby:'main.rb', rb:'main.rb', sql:'query.sql',
  yaml:'config.yml', yml:'config.yml', kotlin:'Main.kt', swift:'main.swift',
  txt:'notes.txt', text:'notes.txt', plaintext:'notes.txt', plain:'notes.txt',
  md:'README.md', markdown:'README.md'
};
// Nama file langsung ketauan begitu ada penanda di kodenya, gak perlu nunggu kode selesai.
// Kalo AI gak nulis nama bahasa di fence-nya (```` ``` ```` doang, tanpa "css"/"js" dst), tebak dari isi kodenya.
function sniffLangFromContent(code) {
  const c = (code || '').trim();
  if (!c) return '';
  if (/^<!doctype html/i.test(c) || /<html[\s>]/i.test(c) || (/<[a-z][\s\S]*>/i.test(c) && /<\/[a-z]+>/i.test(c) && !/^[.#@]/.test(c))) return 'html';
  if (/^\s*[.#@a-zA-Z][^{}]*\{[\s\S]*[:;][\s\S]*\}/.test(c) && !/function|const |let |=>|console\./.test(c)) return 'css';
  if (/\b(function|const|let|var|console\.log|=>|document\.|window\.)\b/.test(c)) return 'js';
  if (/^\s*(def |import |print\()/m.test(c)) return 'python';
  return '';
}
function guessTitleFromCode(code, lang) {
  let l = (lang || '').toLowerCase();
  const fname = code.match(/(?:\/\/|#|<!--)\s*(?:file|filename)\s*:\s*([\w.\-\/]+)/i);
  if (fname) return fname[1].trim();
  // Nama file baku (index.html/style.css/script.js/dst) didahuluin buat semua bahasa —
  // sebelumnya HTML bisa kepancing ambil isi tag <title> jadi nama file, dan kode yang ada kata
  // function/def/class malah ikut nama fungsi itu. Sekarang selalu konsisten pake nama baku.
  if (!DEFAULT_FILE_NAME[l]) {
    const sniffed = sniffLangFromContent(code);
    if (sniffed && DEFAULT_FILE_NAME[sniffed]) l = sniffed;
  }
  if (DEFAULT_FILE_NAME[l]) return DEFAULT_FILE_NAME[l];
  const f = code.match(/(?:function|def|class)\s+([A-Za-z_][A-Za-z0-9_]*)/);
  const ext = LANG_EXT[l] || (l && l !== 'code' ? l : '');
  if (f && ext) return f[1] + '.' + ext;
  if (f) return f[1];
  if (ext) return 'file.' + ext;
  return 'file.txt';
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
// Warna "logo" per tipe file, dipake di badge (bukan logo brand asli, cuma badge warna + nama).
const FILE_ICON_COLORS = {
  html:'#e34c26', htm:'#e34c26', xml:'#e34c26', css:'#2965f1', scss:'#c76494', sass:'#c76494',
  js:'#d7b30f', javascript:'#d7b30f', jsx:'#61dafb', ts:'#3178c6', typescript:'#3178c6', tsx:'#3178c6',
  py:'#3776ab', python:'#3776ab', json:'#8a8a8a', bash:'#4eaa25', shell:'#4eaa25', sh:'#4eaa25',
  java:'#ea2d2e', c:'#5c6bc0', cpp:'#00599c', 'c++':'#00599c', cs:'#68217a', go:'#00add8',
  rust:'#dea584', rs:'#dea584', php:'#787cb5', ruby:'#cc342d', rb:'#cc342d', sql:'#e38c00',
  yaml:'#cb171e', yml:'#cb171e', kotlin:'#7f52ff', swift:'#f05138',
  txt:'#78716c', text:'#78716c', plaintext:'#78716c', md:'#083fa1', markdown:'#083fa1'
};
// Ikon SVG asli per bahasa (vektor, digambar sendiri — bukan teks/badge doang) buat ditaro di atas badge warna.
const LANG_ICON_SVG = {
  html: '<path fill="currentColor" d="M1.5 0h21l-1.91 21.563L11.977 24l-8.564-2.438L1.5 0zm7.031 9.75-.232-2.718 10.059.003.23-2.622L5.412 4.41l.698 8.01h9.126l-.326 3.426-2.91.804-2.955-.81-.188-2.11H6.248l.33 4.171L12 19.351l5.379-1.443.744-8.157H8.531z"/>',
  htm: '<path fill="currentColor" d="M1.5 0h21l-1.91 21.563L11.977 24l-8.564-2.438L1.5 0zm7.031 9.75-.232-2.718 10.059.003.23-2.622L5.412 4.41l.698 8.01h9.126l-.326 3.426-2.91.804-2.955-.81-.188-2.11H6.248l.33 4.171L12 19.351l5.379-1.443.744-8.157H8.531z"/>',
  xml: '<path d="M8 7L4 12l4 5M16 7l4 5-4 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  css: '<path fill="currentColor" d="M1.5 0h21l-1.91 21.563L11.977 24l-8.565-2.438L1.5 0zm17.09 4.413L5.41 4.41l.213 2.622 10.125.002-.255 2.716h-6.64l.24 2.573h6.182l-.366 3.523-2.91.804-2.956-.81-.188-2.11h-2.61l.29 3.855L12 19.288l5.373-1.53L18.59 4.414z"/>',
  scss: '<rect x="5" y="5" width="14" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="8.7" y="8.7" width="6.6" height="6.6" rx="1.2" fill="currentColor"/>',
  sass: '<rect x="5" y="5" width="14" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="8.7" y="8.7" width="6.6" height="6.6" rx="1.2" fill="currentColor"/>',
  js: '<text x="12" y="16.5" font-family="Arial,sans-serif" font-weight="800" font-size="10.5" fill="currentColor" text-anchor="middle">JS</text>',
  javascript: '<text x="12" y="16.5" font-family="Arial,sans-serif" font-weight="800" font-size="10.5" fill="currentColor" text-anchor="middle">JS</text>',
  jsx: '<text x="12" y="16.5" font-family="Arial,sans-serif" font-weight="800" font-size="9" fill="currentColor" text-anchor="middle">JSX</text>',
  ts: '<text x="12" y="16.5" font-family="Arial,sans-serif" font-weight="800" font-size="10.5" fill="currentColor" text-anchor="middle">TS</text>',
  typescript: '<text x="12" y="16.5" font-family="Arial,sans-serif" font-weight="800" font-size="10.5" fill="currentColor" text-anchor="middle">TS</text>',
  tsx: '<text x="12" y="16.5" font-family="Arial,sans-serif" font-weight="800" font-size="9" fill="currentColor" text-anchor="middle">TSX</text>',
  py: '<path fill="currentColor" d="M11.727 0a16.43 16.43 0 00-2.834.248l.098-.014C6.568.662 6.129 1.558 6.129 3.21v2.182h5.726v.727H3.981l-.066-.001A3.576 3.576 0 00.408 8.999l-.004.023c-.256.872-.403 1.874-.403 2.91s.147 2.038.422 2.985l-.019-.076c.407 1.695 1.379 2.902 3.04 2.902h1.969v-2.616a3.64 3.64 0 013.574-3.557h5.722a2.885 2.885 0 002.863-2.885v-.026.001-5.452A3.204 3.204 0 0014.724.233L14.71.232a17.319 17.319 0 00-2.879-.234h-.107.005zM8.631 1.755h.017a1.091 1.091 0 11-1.091 1.094v-.008c0-.596.48-1.08 1.074-1.086h.001z"/><path fill="currentColor" d="M18.287 6.119v2.542a3.672 3.672 0 01-3.572 3.63H8.991A2.922 2.922 0 006.129 15.2v5.453c0 1.551 1.349 2.464 2.862 2.91.855.277 1.839.437 2.86.437s2.005-.16 2.927-.456l-.068.019c1.44-.417 2.862-1.258 2.862-2.91v-2.184h-5.719v-.727h8.582c1.664 0 2.284-1.161 2.863-2.902.28-.87.441-1.871.441-2.91s-.161-2.04-.46-2.979l.019.07c-.411-1.656-1.2-2.902-2.863-2.902zm-3.216 13.807h.017a1.091 1.091 0 11-1.091 1.091v-.011c0-.595.48-1.077 1.074-1.08z"/>',
  python: '<path fill="currentColor" d="M11.727 0a16.43 16.43 0 00-2.834.248l.098-.014C6.568.662 6.129 1.558 6.129 3.21v2.182h5.726v.727H3.981l-.066-.001A3.576 3.576 0 00.408 8.999l-.004.023c-.256.872-.403 1.874-.403 2.91s.147 2.038.422 2.985l-.019-.076c.407 1.695 1.379 2.902 3.04 2.902h1.969v-2.616a3.64 3.64 0 013.574-3.557h5.722a2.885 2.885 0 002.863-2.885v-.026.001-5.452A3.204 3.204 0 0014.724.233L14.71.232a17.319 17.319 0 00-2.879-.234h-.107.005zM8.631 1.755h.017a1.091 1.091 0 11-1.091 1.094v-.008c0-.596.48-1.08 1.074-1.086h.001z"/><path fill="currentColor" d="M18.287 6.119v2.542a3.672 3.672 0 01-3.572 3.63H8.991A2.922 2.922 0 006.129 15.2v5.453c0 1.551 1.349 2.464 2.862 2.91.855.277 1.839.437 2.86.437s2.005-.16 2.927-.456l-.068.019c1.44-.417 2.862-1.258 2.862-2.91v-2.184h-5.719v-.727h8.582c1.664 0 2.284-1.161 2.863-2.902.28-.87.441-1.871.441-2.91s-.161-2.04-.46-2.979l.019.07c-.411-1.656-1.2-2.902-2.863-2.902zm-3.216 13.807h.017a1.091 1.091 0 11-1.091 1.091v-.011c0-.595.48-1.077 1.074-1.08z"/>',
  json: '<text x="12" y="16.5" font-family="Arial,sans-serif" font-weight="800" font-size="11" fill="currentColor" text-anchor="middle">{ }</text>',
  php: '<text x="12" y="15.5" font-family="Georgia,serif" font-style="italic" font-weight="700" font-size="8.5" fill="currentColor" text-anchor="middle">php</text>',
  java: '<path d="M6 10h10v5a5 5 0 0 1-5 5h-0a5 5 0 0 1-5-5v-5z" fill="currentColor"/><path d="M16 11h1.4a2.4 2.4 0 0 1 0 4.8H16" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M9 7c0-1 1-1 1-2M12.5 7c0-1 1-1 1-2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none"/>',
  c: '<text x="12" y="16.5" font-family="Arial,sans-serif" font-weight="800" font-size="12" fill="currentColor" text-anchor="middle">C</text>',
  cpp: '<text x="12" y="16" font-family="Arial,sans-serif" font-weight="800" font-size="8.5" fill="currentColor" text-anchor="middle">C++</text>',
  'c++': '<text x="12" y="16" font-family="Arial,sans-serif" font-weight="800" font-size="8.5" fill="currentColor" text-anchor="middle">C++</text>',
  cs: '<text x="12" y="16" font-family="Arial,sans-serif" font-weight="800" font-size="9.5" fill="currentColor" text-anchor="middle">C#</text>',
  go: '<text x="12" y="16" font-family="Arial,sans-serif" font-weight="800" font-size="9.5" fill="currentColor" text-anchor="middle">GO</text>',
  rust: '<text x="12" y="16" font-family="Arial,sans-serif" font-weight="800" font-size="9" fill="currentColor" text-anchor="middle">RS</text>',
  rs: '<text x="12" y="16" font-family="Arial,sans-serif" font-weight="800" font-size="9" fill="currentColor" text-anchor="middle">RS</text>',
  ruby: '<path d="M12 4l6 5-6 11-6-11 6-5z" fill="currentColor"/>',
  rb: '<path d="M12 4l6 5-6 11-6-11 6-5z" fill="currentColor"/>',
  sql: '<ellipse cx="12" cy="6.3" rx="6" ry="2.1" fill="currentColor"/><path d="M6 6.3v9c0 1.16 2.7 2.1 6 2.1s6-.94 6-2.1v-9" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M6 11c0 1.16 2.7 2.1 6 2.1s6-.94 6-2.1" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.65"/>',
  yaml: '<path d="M6 7.5h6M6 11.5h9M6 15.5h7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  yml: '<path d="M6 7.5h6M6 11.5h9M6 15.5h7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  kotlin: '<text x="12" y="16.5" font-family="Arial,sans-serif" font-weight="800" font-size="11" fill="currentColor" text-anchor="middle">K</text>',
  swift: '<text x="12" y="16" font-family="Arial,sans-serif" font-weight="800" font-size="8.5" fill="currentColor" text-anchor="middle">SW</text>',
  bash: '<rect x="4" y="5" width="16" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M7.3 9.8l2.8 2.5-2.8 2.5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.3 14.8h4.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  shell: '<rect x="4" y="5" width="16" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M7.3 9.8l2.8 2.5-2.8 2.5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.3 14.8h4.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  sh: '<rect x="4" y="5" width="16" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M7.3 9.8l2.8 2.5-2.8 2.5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.3 14.8h4.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  markdown: '<text x="12" y="16" font-family="Arial,sans-serif" font-weight="800" font-size="9.5" fill="currentColor" text-anchor="middle">M↓</text>',
  md: '<text x="12" y="16" font-family="Arial,sans-serif" font-weight="800" font-size="9.5" fill="currentColor" text-anchor="middle">M↓</text>'
};
const LANG_ICON_DEFAULT = '<path d="M7 3h7l4 4v14H7V3z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M14 3v4h4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M9 12h6M9 15h6M9 18h4" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>';
function fileIconMeta(title, lang) {
  const l = (lang || '').toLowerCase();
  let ext = ((title || '').match(/\.([a-z0-9]+)$/i) || [])[1];
  if (!ext) ext = LANG_EXT[l] || (l && l !== 'code' ? l : 'txt');
  ext = ext.toLowerCase();
  const color = FILE_ICON_COLORS[ext] || FILE_ICON_COLORS[l] || '#6b7280';
  const inner = LANG_ICON_SVG[ext] || LANG_ICON_SVG[l] || LANG_ICON_DEFAULT;
  const svg = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
  return { ext, color, svg };
}
// Kartu file yang muncul begitu kode kelar dibuat: [logo] nama file / Kode (bahasa). Klik buka modal full-code.
function buildCodeFileCard(title, lang, code) {
  const meta = fileIconMeta(title, lang);
  const card = document.createElement('div');
  card.className = 'code-file-card';
  const icon = document.createElement('span');
  icon.className = 'code-file-card-icon';
  icon.style.background = meta.color;
  icon.innerHTML = meta.svg;
  const info = document.createElement('span');
  info.className = 'code-file-card-info';
  const name = document.createElement('span');
  name.className = 'code-file-card-name';
  name.textContent = title;
  const sub = document.createElement('span');
  sub.className = 'code-file-card-sub';
  sub.textContent = 'Kode (' + guessLangLabel(lang) + ')';
  info.appendChild(name);
  info.appendChild(sub);
  card.appendChild(icon);
  card.appendChild(info);
  card.onclick = () => openModal(title, lang, code);
  return card;
}
function buildCodeBlock(lang, code) {
  const title = guessTitleFromCode(code, lang);
  return buildCodeFileCard(title, lang, code);
}
function parseFenceParts(text) {
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
  return parts;
}
function appendFenceParts(text, container) {
  parseFenceParts(text).forEach(p => {
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
  const codeParts = parseFenceParts(rest).filter(p => p.type === 'code');
  container._getThinkTask = () => thinkContent ? { closed: true, content: thinkContent, ref: null } : null;
  container._getCodeTasks = () => codeParts.map(p => ({
    title: guessTitleFromCode(p.code, p.lang), lang: p.lang, content: p.code, closed: true
  }));
  if (thinkContent) container.appendChild(buildThinkBlock(thinkContent, container));
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

