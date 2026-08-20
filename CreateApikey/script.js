// Ambil SERVER_URL yang disimpen sama halaman utama OxyChat (localStorage, satu domain)
const SERVER_URL = localStorage.getItem('oxychat_server_url_v1') || '';

// Katalog model publik yang bisa dipilih pas bikin API key (harus sinkron sama server.js)
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

// ==== FIX PRIVASI ====
// Setiap browser/akun punya "pemilik" sendiri: kalau udah login Google, pake email.
// Kalau belum (trial), pake ID device anonim yang di-generate sekali dan disimpen permanen.
// Ini yang bikin API key SEORANG USER GAK KELIATAN sama user lain.
function getOwnerId() {
  const email = localStorage.getItem('oxychat_useremail_v1');
  if (email) return email;
  let anonId = localStorage.getItem('oxychat_device_id_v1');
  if (!anonId) {
    anonId = 'anon-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('oxychat_device_id_v1', anonId);
  }
  return anonId;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2400);
}

function goBack() {
  window.location.href = '../';
}

function updateCurlExample() {
  const curl = 'curl -X POST ' + SERVER_URL + '/v1/chat \\\n' +
    '  -H "Authorization: Bearer YOUR_API_KEY" \\\n' +
    '  -H "Content-Type: application/json" \\\n' +
    '  -d \'{"messages":[{"role":"user","content":"halo"}],"stream":false}\'';
  document.getElementById('curl-code').textContent = curl;
}
function copyCurl() {
  navigator.clipboard.writeText(document.getElementById('curl-code').textContent);
  toast('Command cURL disalin');
}
function copyResult() {
  navigator.clipboard.writeText(document.getElementById('result-value').textContent);
  toast('API key disalin');
}

async function createApiKey() {
  const loggedInEmail = localStorage.getItem('oxychat_useremail_v1');
  if (!loggedInEmail) {
    toast('Login Google Untuk Buat ApiKey');
    return;
  }
  const nameInput = document.getElementById('name-input');
  const name = nameInput.value.trim();
  if (!name) { toast('Isi nama API key dulu'); return; }
  if (!SERVER_URL) { toast('Server belum kesetting, buka dulu halaman utama OxyChat'); return; }
  const modelId = document.getElementById('model-select').value;
  const btn = document.getElementById('create-btn');
  btn.disabled = true; btn.textContent = 'Membuat...';
  try {
    const res = await fetch(SERVER_URL + '/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, modelId, createdBy: getOwnerId() })
    });
    const data = await res.json();
    if (!res.ok) throw new Error((data.error && data.error.message) || 'Gagal bikin API key');
    document.getElementById('result-value').textContent = data.key;
    document.getElementById('result-box').classList.add('show');
    nameInput.value = '';
    toast('API key berhasil dibuat');
    loadHistory();
  } catch (err) {
    toast(err.message || 'Gagal bikin API key');
  } finally {
    btn.disabled = false; btn.textContent = 'Buat';
  }
}

async function loadHistory() {
  const list = document.getElementById('history-list');
  if (!SERVER_URL) {
    list.innerHTML = '<div id="history-empty">Server belum kesetting, buka dulu halaman utama OxyChat</div>';
    return;
  }
  try {
    const res = await fetch(SERVER_URL + '/api/keys?createdBy=' + encodeURIComponent(getOwnerId()));
    const keys = await res.json();
    if (!Array.isArray(keys) || keys.length === 0) {
      list.innerHTML = '<div id="history-empty">Belum ada API key yang kamu buat</div>';
      return;
    }
    list.innerHTML = keys.slice().reverse().map(k => {
      const modelLabel = (APIKEY_MODEL_CATALOG.find(m => m.id === k.modelId) || {}).label || k.modelId;
      return '<div class="history-item">' +
        '<div class="history-text">' +
          '<div class="history-name">' + escHtml(k.name) + ' &middot; ' + escHtml(modelLabel) + '</div>' +
          '<div class="history-meta">' + escHtml(k.key) + '</div>' +
        '</div>' +
        '<button class="history-del-btn" onclick="deleteApiKey(\'' + k.id + '\')">' +
          '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5h10M6.5 4.5V3a1 1 0 011-1h1a1 1 0 011 1v1.5M4.5 4.5v8a1 1 0 001 1h5a1 1 0 001-1v-8"/></svg>' +
        '</button>' +
      '</div>';
    }).join('');
  } catch (err) {
    list.innerHTML = '<div id="history-empty">Gagal muat riwayat, cek koneksi server</div>';
  }
}

async function deleteApiKey(id) {
  try {
    await fetch(SERVER_URL + '/api/keys/' + id + '?createdBy=' + encodeURIComponent(getOwnerId()), { method: 'DELETE' });
    toast('API key dihapus');
    loadHistory();
  } catch (err) {
    toast('Gagal hapus API key');
  }
}

// ==== init ====
document.getElementById('model-select').innerHTML =
  APIKEY_MODEL_CATALOG.map(m => '<option value="' + m.id + '">' + m.label + '</option>').join('');
updateCurlExample();
loadHistory();
