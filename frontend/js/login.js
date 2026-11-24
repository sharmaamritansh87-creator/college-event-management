/* =====================================================================
   login.js  -  login form, demo-account pills and student sign-up
   ===================================================================== */

// Already logged in? Go straight to your portal.
(function redirectIfLoggedIn() {
  const user = getUser();
  if (getToken() && user) window.location.href = homeFor(user.role);
})();

// Opened by double-clicking the file? Explain what to do instead.
if (window.location.protocol === 'file:') {
  const warn = document.createElement('div');
  warn.className = 'alert alert-warning';
  warn.innerHTML = '<strong>Server not running.</strong> This page was opened as a file. ' +
    'Start the backend (<code>npm start</code> in the backend folder) and open ' +
    '<a href="http://localhost:3000">http://localhost:3000</a> instead.';
  document.querySelector('.login-card').prepend(warn);
}

const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');

function showError(box, message) {
  box.textContent = message;
  box.classList.remove('d-none');
}

// ----- Demo pills: click to fill the form -----
document.querySelectorAll('.demo-pill').forEach((pill) => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.demo-pill').forEach((p) => p.classList.remove('active'));
    pill.classList.add('active');
    document.getElementById('email').value = pill.dataset.email;
    document.getElementById('password').value = 'demo123';
    loginError.classList.add('d-none');
  });
});

// ----- Login -----
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.add('d-none');

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  if (!email || !password) {
    showError(loginError, 'Please enter your email and password.');
    return;
  }

  const btn = document.getElementById('loginBtn');
  setBusy(btn, true, 'Signing in...');
  try {
    const data = await api('/auth/login', { method: 'POST', body: { email, password }, noRedirect: true });
    saveSession(data.token, data.user);
    window.location.href = homeFor(data.user.role);
  } catch (err) {
    showError(loginError, err.message);
    setBusy(btn, false);
  }
});

// ----- Sign up (students only) -----
document.getElementById('openSignup').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('signupError').classList.add('d-none');
  showModal('signupModal');
});

document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const box = document.getElementById('signupError');
  box.classList.add('d-none');

  const name = document.getElementById('suName').value.trim();
  const email = document.getElementById('suEmail').value.trim();
  const password = document.getElementById('suPass').value;
  const password2 = document.getElementById('suPass2').value;

  // Quick checks in the browser (the server checks again)
  if (name.length < 2) return showError(box, 'Please enter your full name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showError(box, 'Please enter a valid email address.');
  if (password.length < 6) return showError(box, 'Password must be at least 6 characters.');
  if (password !== password2) return showError(box, 'The two passwords do not match.');

  const btn = document.getElementById('signupBtn');
  setBusy(btn, true, 'Creating...');
  try {
    const data = await api('/auth/register', {
      method: 'POST',
      noRedirect: true,
      body: {
        name,
        email,
        password,
        department: document.getElementById('suDept').value.trim(),
        student_id: document.getElementById('suRoll').value.trim()
      }
    });
    saveSession(data.token, data.user);
    window.location.href = homeFor(data.user.role);
  } catch (err) {
    showError(box, err.message);
    setBusy(btn, false);
  }
});
