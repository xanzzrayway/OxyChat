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

