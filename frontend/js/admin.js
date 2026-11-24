/* =====================================================================
   admin.js  -  Admin Portal
   Overview + CSV report, approve / cancel / delete events, manage users
   ===================================================================== */

const user = requireLogin('admin');

if (user) {
  let stats = null;
  let events = [];
  let users = [];
  let activeTab = 'overview';
  let statusFilter = 'All';
  const listArea = document.getElementById('listArea');

  renderNavbar(user, loadData);
  loadData().catch((e) => {
    listArea.innerHTML = `<div class="alert alert-danger">${esc(e.message)}</div>`;
  });

  async function loadData() {
    const [s, ev, us] = await Promise.all([api('/admin/stats'), api('/events/manage'), api('/admin/users')]);
    stats = s;
    events = ev;
    users = us;
    render();
  }

  function render() {
    document.querySelectorAll('.cw-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === activeTab));
    document.getElementById('cntEvents').textContent = events.length;
    document.getElementById('cntUsers').textContent = users.length;
    if (activeTab === 'overview') renderOverview();
    else if (activeTab === 'events') renderEvents();
    else renderUsers();
  }

  /* ---------------- Overview ---------------- */
  function renderOverview() {
    const t = stats.totals;
    const attendanceRate = t.total_registrations > 0 ? Math.round((t.total_present / t.total_registrations) * 100) + '%' : '-';
    const cards = [
      [t.total_events, 'Total events'],
      [t.upcoming_events, 'Upcoming events'],
      [t.completed_events, 'Completed events'],
      [t.pending_events, 'Awaiting approval'],
      [t.total_registrations, 'Active registrations'],
      [attendanceRate, 'Marked present'],
      [t.students, 'Students'],
      [t.organizers, 'Club heads']
    ];
    const maxCat = Math.max(1, ...stats.byCategory.map((c) => c.total));

    listArea.innerHTML = `
      <div class="row g-3 mb-4">
        ${cards.map(([n, l]) => `<div class="col-6 col-md-3"><div class="stat-card"><div class="num">${esc(n)}</div><div class="lbl">${esc(l)}</div></div></div>`).join('')}
      </div>
      <div class="row g-3">
        <div class="col-md-6">
          <div class="panel h-100">
            <h5 class="mb-3">Published events by category</h5>
            ${stats.byCategory.length === 0 ? '<div class="text-grey">No data yet.</div>' : stats.byCategory.map((c) => `
              <div class="bar-row">
                <div class="name">${esc(c.category)}</div>
                <div class="bar"><span style="width:${Math.round((c.total / maxCat) * 100)}%"></span></div>
                <div class="val">${c.total}</div>
              </div>`).join('')}
          </div>
        </div>
        <div class="col-md-6">
          <div class="panel h-100">
            <h5 class="mb-3">Most popular events</h5>
            ${stats.topEvents.length === 0 ? '<div class="text-grey">No registrations yet.</div>' : stats.topEvents.map((e, i) => `
              <div class="d-flex justify-content-between border-bottom py-2">
                <div><strong>${i + 1}. ${esc(e.title)}</strong><div class="text-grey small">${esc(e.club_name)}</div></div>
                <div class="align-self-center"><span class="status-pill pill-blue">${e.registrations} registered</span></div>
              </div>`).join('')}
          </div>
        </div>
      </div>
      <div class="panel mt-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h5 class="mb-1">Events report</h5>
          <div class="text-grey small">One row per event: registrations, attendance, average rating and status.
            Average rating overall: <strong>${t.avg_rating !== null ? esc(t.avg_rating) + ' / 5' : '-'}</strong></div>
        </div>
        <button class="btn btn-primary" id="reportBtn"><i class="bi bi-download"></i> Download report (CSV)</button>
      </div>`;
  }

  async function downloadReport(btn) {
    setBusy(btn, true, 'Preparing...');
    try {
      const rows = await api('/admin/report');
      const headers = ['Event ID', 'Title', 'Club', 'Category', 'Mode', 'Venue', 'Date & Time', 'Capacity',
        'Registered', 'Present', 'Attendance %', 'Avg Rating', 'Status', 'Created By'];
      const data = rows.map((r) => [
        r.event_id, r.title, r.club_name, r.category, r.mode, r.venue, r.event_datetime, r.capacity,
        r.registered_count, r.present_count,
        r.registered_count > 0 ? Math.round((r.present_count / r.registered_count) * 100) : 0,
        r.avg_rating !== null ? r.avg_rating : '',
        r.status === 'Published' && r.is_past ? 'Completed' : r.status,
        r.created_by_name
      ]);
      downloadCSV('events_report.csv', headers, data);
      showToast('Report downloaded.');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy(btn, false);
    }
  }

  /* ---------------- Events ---------------- */
  function statusBadge(ev) {
    if (ev.status === 'Pending') return '<span class="status-pill pill-amber">Pending</span>';
    if (ev.status === 'Cancelled') return '<span class="status-pill pill-red">Cancelled</span>';
    return ev.is_past
      ? '<span class="status-pill pill-grey">Completed</span>'
      : '<span class="status-pill pill-green">Published</span>';
  }

  function renderEvents() {
    const shown = statusFilter === 'All' ? events : events.filter((e) => e.status === statusFilter);
    listArea.innerHTML = `
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div style="min-width:200px">
          <select class="form-select" id="statusFilter">
            ${['All', 'Pending', 'Published', 'Cancelled'].map((s) => `<option ${s === statusFilter ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-primary" id="createBtn"><i class="bi bi-plus-lg"></i> Create event</button>
      </div>
      ${shown.length === 0 ? '<div class="empty-state">No events found.</div>' : `
      <div class="table-card"><div class="table-responsive"><table class="table table-hover">
        <thead><tr><th>Event</th><th>Organizer</th><th>Date &amp; time</th><th>Registered</th><th>Status</th><th class="text-end">Actions</th></tr></thead>
        <tbody>
        ${shown.map((ev) => `
          <tr>
            <td><strong>${esc(ev.title)}</strong><div class="text-grey small">${esc(ev.category)} · ${esc(ev.venue)}</div></td>
            <td>${esc(ev.club_name)}<div class="text-grey small">${esc(ev.created_by_name)}</div></td>
            <td class="text-nowrap">${esc(formatDateTime(ev.event_datetime))}</td>
            <td>${ev.registered_count} / ${ev.capacity}</td>
            <td>${statusBadge(ev)}</td>
            <td class="text-end text-nowrap">
              ${ev.status === 'Pending' ? `<button class="btn btn-sm btn-success" data-action="approve" data-id="${ev.event_id}"><i class="bi bi-check-lg"></i> Approve</button>` : ''}
              ${ev.status === 'Published' && !ev.is_past ? `<button class="btn btn-sm btn-outline-warning" data-action="cancel" data-id="${ev.event_id}">Cancel event</button>` : ''}
              ${ev.status === 'Cancelled' ? `<button class="btn btn-sm btn-outline-success" data-action="approve" data-id="${ev.event_id}">Re-publish</button>` : ''}
              <button class="btn btn-sm btn-soft" data-action="participants" data-id="${ev.event_id}" title="Participants"><i class="bi bi-people"></i></button>
              <button class="btn btn-sm btn-soft" data-action="edit" data-id="${ev.event_id}" title="Edit"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${ev.event_id}" title="Delete"><i class="bi bi-trash"></i></button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table></div></div>`}`;
  }

  async function setStatus(id, status, message) {
    try {
      const res = await api(`/events/${id}/status`, { method: 'PATCH', body: { status } });
      showToast(message || res.message);
      await loadData();
    } catch (err) { showToast(err.message, 'error'); }
  }

  /* ---------------- Users ---------------- */
  function renderUsers() {
    const roleBadge = { admin: 'pill-red', organizer: 'pill-blue', student: 'pill-grey' };
    listArea.innerHTML = `
      <div class="d-flex justify-content-end mb-3">
        <button class="btn btn-primary" id="addUserBtn"><i class="bi bi-person-plus"></i> Add user</button>
      </div>
      <div class="table-card"><div class="table-responsive"><table class="table table-hover">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Club / Dept</th><th>Registrations</th><th class="text-end">Actions</th></tr></thead>
        <tbody>
        ${users.map((u) => {
          const isMe = u.user_id === user.id;
          return `
          <tr>
            <td><strong>${esc(u.name)}</strong>${isMe ? ' <span class="text-grey small">(you)</span>' : ''}${u.student_id ? `<div class="text-grey small">${esc(u.student_id)}</div>` : ''}</td>
            <td>${esc(u.email)}</td>
            <td><span class="status-pill ${roleBadge[u.role]}">${esc(ROLE_LABELS[u.role])}</span></td>
            <td>${esc(u.role === 'organizer' ? u.club_name : (u.department || '-'))}</td>
            <td>${u.role === 'student' ? u.registrations : '-'}</td>
            <td class="text-end text-nowrap">
              ${isMe ? '<span class="text-grey small">-</span>' : `
              <select class="form-select form-select-sm d-inline-block w-auto" data-role-select="${u.user_id}" title="Change role">
                ${['student', 'organizer', 'admin'].map((r) => `<option value="${r}" ${r === u.role ? 'selected' : ''}>${esc(ROLE_LABELS[r])}</option>`).join('')}
              </select>
              <button class="btn btn-sm btn-outline-danger" data-action="deleteUser" data-id="${u.user_id}" title="Delete user"><i class="bi bi-trash"></i></button>`}
            </td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div></div>`;
  }

  /* ---------------- Events on the page ---------------- */
  document.getElementById('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.cw-tab');
    if (!btn) return;
    activeTab = btn.dataset.tab;
    render();
  });

  listArea.addEventListener('change', async (e) => {
    if (e.target.id === 'statusFilter') {
      statusFilter = e.target.value;
      renderEvents();
      return;
    }
    // Change a user's role
    const select = e.target.closest('[data-role-select]');
    if (!select) return;
    const id = Number(select.dataset.roleSelect);
    const target = users.find((u) => u.user_id === id);
    const newRole = select.value;
    let clubName = null;
    if (newRole === 'organizer') {
      clubName = prompt(`Club name for ${target.name}:`, target.club_name || '');
      if (!clubName || !clubName.trim()) { select.value = target.role; return; }
    }
    if (!confirm(`Change ${target.name} to ${ROLE_LABELS[newRole]}?`)) { select.value = target.role; return; }
    try {
      const res = await api(`/admin/users/${id}/role`, { method: 'PUT', body: { role: newRole, club_name: clubName } });
      showToast(res.message);
      await loadData();
    } catch (err) {
      showToast(err.message, 'error');
      select.value = target.role;
    }
  });

  listArea.addEventListener('click', async (e) => {
    if (e.target.closest('#reportBtn')) return downloadReport(e.target.closest('#reportBtn'));
    if (e.target.closest('#createBtn')) return openEventForm(null, loadData);
    if (e.target.closest('#addUserBtn')) return openUserModal();

    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const action = btn.dataset.action;

    if (action === 'deleteUser') {
      const u = users.find((x) => x.user_id === id);
      if (!confirm(`Delete ${u.name}? Their registrations (and events, if a club head) will be removed too.`)) return;
      try {
        const res = await api('/admin/users/' + id, { method: 'DELETE' });
        showToast(res.message);
        await loadData();
      } catch (err) { showToast(err.message, 'error'); }
      return;
    }

    const ev = events.find((x) => x.event_id === id);
    if (!ev) return;
    if (action === 'approve') setStatus(id, 'Published', `"${ev.title}" is now published.`);
    if (action === 'cancel') {
      if (confirm(`Cancel "${ev.title}"? Registered students will see it as cancelled.`)) setStatus(id, 'Cancelled');
    }
    if (action === 'participants') openParticipants(ev, loadData);
    if (action === 'edit') openEventForm(ev, loadData);
    if (action === 'delete') {
      if (!confirm(`Permanently delete "${ev.title}" and its ${ev.registered_count} registration(s)?`)) return;
      try {
        const res = await api('/events/' + id, { method: 'DELETE' });
        showToast(res.message);
        await loadData();
      } catch (err) { showToast(err.message, 'error'); }
    }
  });

  /* ---------------- Add user modal ---------------- */
  function openUserModal() {
    ['uName', 'uEmail', 'uPass', 'uClub'].forEach((id) => { document.getElementById(id).value = ''; });
    document.getElementById('uRole').value = 'organizer';
    document.getElementById('clubRow').classList.remove('d-none');
    document.getElementById('userError').classList.add('d-none');
    showModal('userModal');
  }

  document.getElementById('uRole').addEventListener('change', (e) => {
    document.getElementById('clubRow').classList.toggle('d-none', e.target.value !== 'organizer');
  });

  document.getElementById('userForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const box = document.getElementById('userError');
    const body = {
      name: document.getElementById('uName').value.trim(),
      email: document.getElementById('uEmail').value.trim(),
      password: document.getElementById('uPass').value,
      role: document.getElementById('uRole').value,
      club_name: document.getElementById('uClub').value.trim()
    };
    let problem = '';
    if (body.name.length < 2) problem = 'Please enter the name.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) problem = 'Please enter a valid email address.';
    else if (body.password.length < 6) problem = 'Password must be at least 6 characters.';
    else if (body.role === 'organizer' && !body.club_name) problem = 'A club head needs a club name.';
    if (problem) {
      box.textContent = problem;
      box.classList.remove('d-none');
      return;
    }
    const btn = document.getElementById('userSaveBtn');
    setBusy(btn, true, 'Creating...');
    try {
      const res = await api('/admin/users', { method: 'POST', body });
      hideModal('userModal');
      showToast(res.message);
      await loadData();
    } catch (err) {
      box.textContent = err.message;
      box.classList.remove('d-none');
    } finally {
      setBusy(btn, false);
    }
  });
}
