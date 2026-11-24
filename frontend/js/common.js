/* =====================================================================
   common.js  -  helper functions used by EVERY page
   1 Session (token + user in localStorage)   2 api()  3 Page guard
   4 Small utilities (escape, dates, CSV)      5 Toast   6 Navbar
   ===================================================================== */

/* ---------- 1. Session ---------- */
const TOKEN_KEY = 'cems_token';
const USER_KEY = 'cems_user';

function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function getUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch (e) { return null; }
}
function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
function logout() {
  clearSession();
  window.location.href = 'index.html';
}

const ROLE_LABELS = { student: 'Student', organizer: 'Club Head', admin: 'Admin' };

function homeFor(role) {
  if (role === 'admin') return 'admin.html';
  if (role === 'organizer') return 'organizer.html';
  return 'student.html';
}

/* ---------- 2. api() : talk to the Express backend ---------- */
// Example:  const events = await api('/events');
//           await api('/registrations', { method: 'POST', body: { event_id: 3 } });
async function api(path, options = {}) {
  // The pages must be opened through the Node server, not by double-clicking the file.
  if (window.location.protocol === 'file:') {
    throw new Error('Open the site at http://localhost:3000 (start it with "npm start" in the backend folder). Opening the HTML file directly does not work.');
  }

  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = 'Bearer ' + token;

  let res;
  try {
    res = await fetch('/api' + path, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  } catch (e) {
    throw new Error('Cannot reach the server. Is it running? (npm start)');
  }

  let data = null;
  try { data = await res.json(); } catch (e) { /* no JSON body */ }

  // Token expired / invalid -> back to login (but not for the login form itself)
  if (res.status === 401 && !options.noRedirect) {
    clearSession();
    window.location.href = 'index.html';
    throw new Error((data && data.message) || 'Please log in again.');
  }
  if (!res.ok) throw new Error((data && data.message) || 'Something went wrong.');
  return data;
}

/* ---------- 3. Page guard ---------- */
// Call at the top of each portal page: const user = requireLogin('student');
// Sends the visitor to the login page (or their own portal) if they don't belong here.
function requireLogin(role) {
  const user = getUser();
  if (!getToken() || !user) {
    window.location.href = 'index.html';
    return null;
  }
  if (user.role !== role) {
    window.location.href = homeFor(user.role);
    return null;
  }
  return user;
}

/* ---------- 4. Small utilities ---------- */
// Escape text before putting it into innerHTML (prevents XSS).
function esc(value) {
  return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-07-10 17:00:00"  ->  JavaScript Date (local time)
function parseSqlDate(str) {
  if (!str) return null;
  const d = new Date(String(str).replace(' ', 'T'));
  return isNaN(d) ? null : d;
}
function formatDate(str) {                 // Fri, 10 Jul 2026
  const d = parseSqlDate(str);
  if (!d) return '-';
  return `${DAY_NAMES[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}
function formatTime(str) {                 // 05:00 PM
  const d = parseSqlDate(str);
  if (!d) return '';
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`;
}
function formatDateTime(str) {             // Fri, 10 Jul 2026 · 05:00 PM
  return `${formatDate(str)} · ${formatTime(str)}`;
}
// "2026-07-10 17:00:00" -> "2026-07-10T17:00"  (for <input type="datetime-local">)
function toInputValue(str) {
  return str ? String(str).slice(0, 16).replace(' ', 'T') : '';
}

function stars(rating) {
  const n = Math.round(Number(rating) || 0);
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

// Download a CSV file that opens correctly in Excel.
function downloadCSV(filename, headers, rows) {
  const quote = (v) => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
  const lines = [headers.map(quote).join(',')];
  rows.forEach((r) => lines.push(r.map(quote).join(',')));
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Disable a button and show "Saving..." while a request is running.
function setBusy(button, busy, text) {
  if (!button) return;
  if (busy) {
    button.dataset.oldText = button.innerHTML;
    button.disabled = true;
    if (text) button.textContent = text;
  } else {
    button.disabled = false;
    if (button.dataset.oldText) button.innerHTML = button.dataset.oldText;
  }
}

function showModal(id) {
  bootstrap.Modal.getOrCreateInstance(document.getElementById(id)).show();
}
function hideModal(id) {
  const el = document.getElementById(id);
  const instance = bootstrap.Modal.getInstance(el);
  if (instance) instance.hide();
}

/* ---------- 5. Toast messages ---------- */
function showToast(message, type = 'success') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    document.body.appendChild(container);
  }
  const colors = { success: 'text-bg-success', error: 'text-bg-danger', info: 'text-bg-primary' };
  const el = document.createElement('div');
  el.className = `toast align-items-center border-0 ${colors[type] || colors.info}`;
  el.setAttribute('role', 'alert');
  el.innerHTML = `<div class="d-flex"><div class="toast-body">${esc(message)}</div>
    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  container.appendChild(el);
  const toast = new bootstrap.Toast(el, { delay: 3500 });
  toast.show();
  el.addEventListener('hidden.bs.toast', () => el.remove());
}

/* ---------- 6. Navbar ---------- */
// Fills <div id="navbar"></div> on each portal page.
function renderNavbar(user, onRefresh) {
  const holder = document.getElementById('navbar');
  if (!holder) return;
  holder.innerHTML = `
    <nav class="cw-navbar">
      <div class="inner">
        <a class="brand" href="${homeFor(user.role)}"><span class="brand-badge">CW</span> CollegeWorld</a>
        <div class="nav-right">
          <span class="role-badge">${esc(ROLE_LABELS[user.role] || user.role)}</span>
          <span class="text-grey d-none d-sm-inline">${esc(user.name)}</span>
          <button class="btn btn-sm btn-outline-secondary" id="navRefresh"><i class="bi bi-arrow-clockwise"></i> Refresh</button>
          <button class="btn btn-sm btn-soft" id="navLogout">Logout</button>
        </div>
      </div>
    </nav>`;
  document.getElementById('navLogout').addEventListener('click', logout);
  document.getElementById('navRefresh').addEventListener('click', async () => {
    try {
      await onRefresh();
      showToast('Data refreshed.', 'info');
    } catch (e) {
      showToast(e.message, 'error');
    }
  });
}
