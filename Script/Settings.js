// ── Credential helpers (localStorage-backed) ──────────────────────────────────
function getCreds() {
  return {
    username: localStorage.getItem('spuc_username') || 'admin',
    password: localStorage.getItem('spuc_password') || 'admin'
  };
}

function setCreds(username, password) {
  localStorage.setItem('spuc_username', username);
  localStorage.setItem('spuc_password', password);
}

// ── Preferences helpers ────────────────────────────────────────────────────────
function getPref(key, def) {
  const v = localStorage.getItem('spuc_pref_' + key);
  if (v === null) return def;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}

function savePref(key, value) {
  localStorage.setItem('spuc_pref_' + key, value);
  showToast('Preference saved');
}

// ── Init ───────────────────────────────────────────────────────────────────────
(function init() {
  const { username } = getCreds();
  document.getElementById('displayUsername').textContent = username;
  document.getElementById('sessionUsername').textContent = username;

  // Session start time
  if (!sessionStorage.getItem('spuc_session_start')) {
    sessionStorage.setItem('spuc_session_start', new Date().toISOString());
  }
  const start = new Date(sessionStorage.getItem('spuc_session_start'));
  document.getElementById('sessionTime').textContent = start.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  document.getElementById('lastActivity').textContent = new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  // Load preferences into toggles
  document.getElementById('prefClock').checked      = getPref('showClock', true);
  document.getElementById('prefAnimations').checked = getPref('animations', true);
  document.getElementById('prefCompact').checked    = getPref('compactTable', false);
  document.getElementById('prefAutoLogout').checked = getPref('autoLogout', false);
  document.getElementById('prefCurrency').value     = getPref('currency', 'PHP');

  // Password strength listener
  document.getElementById('newPwInput').addEventListener('input', function () {
    updateStrength(this.value);
  });
})();

// ── Toggle password visibility ─────────────────────────────────────────────────
function toggleVis(inputId, btn) {
  const input = document.getElementById(inputId);
  input.type = input.type === 'password' ? 'text' : 'password';
  btn.textContent = input.type === 'password' ? '👁' : '🙈';
}

// ── Password strength meter ────────────────────────────────────────────────────
function updateStrength(pw) {
  const fill  = document.getElementById('pwStrengthFill');
  const label = document.getElementById('pwStrengthLabel');
  let score = 0;
  if (pw.length >= 8)  score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  const levels = [
    { pct: '0%',   color: 'transparent', text: '' },
    { pct: '25%',  color: '#ef4444',     text: 'WEAK' },
    { pct: '50%',  color: '#f97316',     text: 'FAIR' },
    { pct: '75%',  color: '#eab308',     text: 'GOOD' },
    { pct: '100%', color: '#22c55e',     text: 'STRONG' }
  ];
  const lvl = levels[score];
  fill.style.width      = pw.length ? lvl.pct : '0%';
  fill.style.background = lvl.color;
  label.textContent     = pw.length ? lvl.text : '';
  label.style.color     = lvl.color;
}

// ── Change Username ────────────────────────────────────────────────────────────
function changeUsername() {
  const currentInput = document.getElementById('currentUsernameInput').value.trim();
  const newInput     = document.getElementById('newUsernameInput').value.trim();
  const pwInput      = document.getElementById('usernameConfirmPw').value;
  const msg          = document.getElementById('usernameMsg');
  const { username, password } = getCreds();

  msg.className = 'form-msg';

  if (!currentInput || !newInput || !pwInput) {
    return showMsg(msg, 'error', 'All fields are required.');
  }
  if (currentInput !== username) {
    return showMsg(msg, 'error', 'Current username is incorrect.');
  }
  if (pwInput !== password) {
    return showMsg(msg, 'error', 'Password confirmation is incorrect.');
  }
  if (newInput.length < 3) {
    return showMsg(msg, 'error', 'Username must be at least 3 characters.');
  }
  if (newInput === username) {
    return showMsg(msg, 'error', 'New username is the same as current.');
  }

  setCreds(newInput, password);
  document.getElementById('displayUsername').textContent = newInput;
  document.getElementById('sessionUsername').textContent = newInput;
  document.getElementById('currentUsernameInput').value = '';
  document.getElementById('newUsernameInput').value = '';
  document.getElementById('usernameConfirmPw').value = '';
  showMsg(msg, 'success', '✓ Username updated successfully.');
  showToast('Username changed successfully');
}

// ── Change Password ────────────────────────────────────────────────────────────
function changePassword() {
  const currentPw  = document.getElementById('currentPwInput').value;
  const newPw      = document.getElementById('newPwInput').value;
  const confirmPw  = document.getElementById('confirmPwInput').value;
  const msg        = document.getElementById('passwordMsg');
  const { username, password } = getCreds();

  msg.className = 'form-msg';

  if (!currentPw || !newPw || !confirmPw) {
    return showMsg(msg, 'error', 'All fields are required.');
  }
  if (currentPw !== password) {
    return showMsg(msg, 'error', 'Current password is incorrect.');
  }
  if (newPw.length < 6) {
    return showMsg(msg, 'error', 'New password must be at least 6 characters.');
  }
  if (newPw !== confirmPw) {
    return showMsg(msg, 'error', 'New passwords do not match.');
  }
  if (newPw === password) {
    return showMsg(msg, 'error', 'New password is the same as current.');
  }

  setCreds(username, newPw);
  document.getElementById('currentPwInput').value = '';
  document.getElementById('newPwInput').value = '';
  document.getElementById('confirmPwInput').value = '';
  updateStrength('');
  showMsg(msg, 'success', '✓ Password updated successfully.');
  showToast('Password changed successfully');
}

// ── Logout ─────────────────────────────────────────────────────────────────────
function openLogout() {
  document.getElementById('logoutOverlay').classList.remove('hidden');
  document.getElementById('logoutModal').classList.remove('hidden');
}

function closeLogout() {
  document.getElementById('logoutOverlay').classList.add('hidden');
  document.getElementById('logoutModal').classList.add('hidden');
}

function confirmLogout() {
  sessionStorage.removeItem('spuc_session_start');
  location.href = '../index.html';
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function showMsg(el, type, text) {
  el.textContent = text;
  el.className = 'form-msg ' + type;
  setTimeout(() => { el.className = 'form-msg hidden'; }, 4000);
}

let _toastTimer = null;
function showToast(text) {
  const toast = document.getElementById('toast');
  toast.textContent = text;
  toast.classList.remove('hidden');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.add('hidden'), 2800);
}

// ── Auto-logout on inactivity ──────────────────────────────────────────────────
let _inactivityTimer = null;

function resetInactivity() {
  if (!getPref('autoLogout', false)) return;
  clearTimeout(_inactivityTimer);
  _inactivityTimer = setTimeout(() => {
    sessionStorage.removeItem('spuc_session_start');
    location.href = '../index.html';
  }, 30 * 60 * 1000);
}

document.addEventListener('mousemove', resetInactivity);
document.addEventListener('keydown', resetInactivity);
resetInactivity();
