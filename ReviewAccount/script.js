// Ambil SERVER_URL yang disimpen sama halaman utama OxyChat (localStorage, satu domain)
const SERVER_URL = (localStorage.getItem('oxychat_server_url_v1') || '').replace(/\/+$/, '');
const LS_DEVICE_ID = 'oxychat_device_id_v1';
const LS_BANNED = 'oxychat_banned_v1';

function getDeviceId() {
  let id = localStorage.getItem(LS_DEVICE_ID);
  if (!id) {
    // jaga-jaga halaman ini dibuka duluan tanpa pernah buka index.html utama
    id = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12);
    localStorage.setItem(LS_DEVICE_ID, id);
  }
  return id;
}

function goBack() {
  if (document.referrer) { window.location.href = '../index.html'; }
  else { window.location.href = '../index.html'; }
}
function backToChat() { window.location.href = '../index.html'; }

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

function fmtTime(ts) {
  if (!ts) return '-';
  try { return new Date(ts).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch (e) { return '-'; }
}

async function checkAccountStatus() {
  if (!SERVER_URL) {
    document.getElementById('status-loading').textContent = 'Server belum kesetting, buka dulu halaman utama Qwerty.';
    return;
  }
  try {
    const res = await fetch(SERVER_URL + '/api/account-status', {
      headers: { 'X-Device-Id': getDeviceId() }
    });
    const data = await res.json();
    renderStatus(data);
  } catch (e) {
    document.getElementById('status-loading').textContent = 'Gagal ngecek status, coba lagi nanti.';
  }
}

function renderStatus(data) {
  document.getElementById('status-loading').style.display = 'none';
  const content = document.getElementById('status-content');
  content.style.display = 'block';

  const badge = document.getElementById('status-badge');
  if (data.banned) {
    badge.textContent = 'Akun Diblokir Permanen';
    badge.className = 'banned';

    document.getElementById('status-reason-row').style.display = 'block';
    document.getElementById('status-reason').textContent = data.reason || 'Kami Telah Mendeteksi Jailbreak';

    if (data.trigger) {
      document.getElementById('status-trigger-row').style.display = 'block';
      document.getElementById('status-trigger').textContent = data.trigger;
    }
    if (data.ts) {
      document.getElementById('status-time-row').style.display = 'block';
      document.getElementById('status-time').textContent = fmtTime(data.ts);
    }
    document.getElementById('restore-btn').style.display = 'block';
  } else {
    badge.textContent = 'Akun Aktif, Gak Ada Pemblokiran';
    badge.className = 'ok';
    document.getElementById('restore-btn').style.display = 'none';
  }
}

async function restoreAccount() {
  const btn = document.getElementById('restore-btn');
  btn.disabled = true;
  btn.textContent = 'Memulihkan...';
  try {
    const res = await fetch(SERVER_URL + '/api/account-restore', {
      method: 'POST',
      headers: { 'X-Device-Id': getDeviceId() }
    });
    const data = await res.json();
    if (data && data.restored) {
      try { localStorage.removeItem(LS_BANNED); } catch (e) {}
      document.getElementById('restored-popup').classList.add('show');
    } else {
      toast('Gagal memulihkan akun, coba lagi.');
      btn.disabled = false;
      btn.textContent = 'Pulihkan Akun';
    }
  } catch (e) {
    toast('Gagal memulihkan akun, coba lagi.');
    btn.disabled = false;
    btn.textContent = 'Pulihkan Akun';
  }
}

checkAccountStatus();
