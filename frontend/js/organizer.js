/* =====================================================================
   organizer.js  -  Club Head (organizer) Portal
   Create / edit / delete own events, participants + attendance, announcements
   ===================================================================== */

const user = requireLogin('organizer');

if (user) {
  let events = [];
  let myNews = [];
  let activeTab = 'events';
  const listArea = document.getElementById('listArea');

  document.getElementById('clubName').textContent = user.club_name || 'your club';
  renderNavbar(user, loadData);
  loadData().catch((e) => {
    listArea.innerHTML = `<div class="alert alert-danger">${esc(e.message)}</div>`;
  });

  async function loadData() {
    const [ev, allNews] = await Promise.all([api('/events/manage'), api('/news')]);
    events = ev;
    myNews = allNews.filter((n) => n.posted_by === user.id);
    render();
  }

  function render() {
    document.querySelectorAll('.cw-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === activeTab));
    document.getElementById('cntEvents').textContent = events.length;
    document.getElementById('cntNews').textContent = myNews.length;
    renderStats();
    if (activeTab === 'events') renderEvents(); else renderNews();
  }

  function renderStats() {
    const totalReg = events.reduce((s, e) => s + e.registered_count, 0);
    const upcoming = events.filter((e) => e.status === 'Published' && !e.is_past).length;
    const pending = events.filter((e) => e.status === 'Pending').length;
    const rated = events.filter((e) => e.avg_rating !== null);
    const avg = rated.length ? (rated.reduce((s, e) => s + Number(e.avg_rating), 0) / rated.length).toFixed(1) : '-';
    const cards = [
      [events.length, 'Events created'],
      [totalReg, 'Total registrations'],
      [upcoming, 'Upcoming (published)'],
      [pending, 'Waiting for admin approval'],
      [avg, 'Average rating (of 5)']
    ];
    document.getElementById('statRow').innerHTML = cards.map(([n, l]) => `
      <div class="col-6 col-md"><div class="stat-card"><div class="num">${esc(n)}</div><div class="lbl">${esc(l)}</div></div></div>`).join('');
  }

  function statusBadge(ev) {
    if (ev.status === 'Pending') return '<span class="status-pill pill-amber">Pending approval</span>';
    if (ev.status === 'Cancelled') return '<span class="status-pill pill-red">Cancelled</span>';
    return ev.is_past
      ? '<span class="status-pill pill-grey">Completed</span>'
      : '<span class="status-pill pill-green">Published</span>';
  }

  function renderEvents() {
    if (events.length === 0) {
      listArea.innerHTML = '<div class="empty-state"><i class="bi bi-calendar-plus fs-1 d-block mb-2"></i>You have not created any events yet. Click "Create event" to start.</div>';
      return;
    }
    listArea.innerHTML = `
      <div class="table-card"><div class="table-responsive"><table class="table table-hover">
        <thead><tr><th>Event</th><th>Date &amp; time</th><th>Registered</th><th>Present</th><th>Rating</th><th>Status</th><th class="text-end">Actions</th></tr></thead>
        <tbody>
        ${events.map((ev) => `
          <tr>
            <td><strong>${esc(ev.title)}</strong>
              <div class="text-grey small">${esc(ev.category)} · ${esc(ev.venue)}</div></td>
            <td class="text-nowrap">${esc(formatDateTime(ev.event_datetime))}</td>
            <td>${ev.registered_count} / ${ev.capacity}</td>
            <td>${ev.present_count}</td>
            <td>${ev.avg_rating !== null ? `<span class="stars">★</span> ${esc(ev.avg_rating)}` : '-'}</td>
            <td>${statusBadge(ev)}</td>
            <td class="text-end text-nowrap">
              <button class="btn btn-sm btn-soft" data-action="participants" data-id="${ev.event_id}" title="Participants and attendance"><i class="bi bi-people"></i> Participants</button>
              <button class="btn btn-sm btn-soft" data-action="edit" data-id="${ev.event_id}" title="Edit"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${ev.event_id}" title="Delete"><i class="bi bi-trash"></i></button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table></div></div>`;
  }

  function renderNews() {
    if (myNews.length === 0) {
      listArea.innerHTML = '<div class="empty-state">You have not posted any announcements yet.</div>';
      return;
    }
    listArea.innerHTML = myNews.map((n) => `
      <div class="news-card">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div>
            <h4>${esc(n.title)}</h4>
            <div class="text-grey small mb-2">${esc(formatDateTime(n.posted_on))}</div>
          </div>
          <button class="btn btn-sm btn-outline-danger" data-action="deleteNews" data-id="${n.news_id}"><i class="bi bi-trash"></i></button>
        </div>
        <p class="mb-0">${esc(n.content)}</p>
      </div>`).join('');
  }

  // ---------- Tabs ----------
  document.getElementById('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.cw-tab');
    if (!btn) return;
    activeTab = btn.dataset.tab;
    render();
  });

  // ---------- Table / card buttons ----------
  listArea.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const action = btn.dataset.action;

    if (action === 'deleteNews') {
      if (!confirm('Delete this announcement?')) return;
      try {
        const res = await api('/news/' + id, { method: 'DELETE' });
        showToast(res.message);
        await loadData();
      } catch (err) { showToast(err.message, 'error'); }
      return;
    }

    const ev = events.find((x) => x.event_id === id);
    if (!ev) return;
    if (action === 'participants') openParticipants(ev, loadData);
    if (action === 'edit') openEventForm(ev, loadData);
    if (action === 'delete') {
      const warn = ev.registered_count > 0
        ? `"${ev.title}" has ${ev.registered_count} registration(s). Deleting removes them too. Continue?`
        : `Delete "${ev.title}"?`;
      if (!confirm(warn)) return;
      try {
        const res = await api('/events/' + id, { method: 'DELETE' });
        showToast(res.message);
        await loadData();
      } catch (err) { showToast(err.message, 'error'); }
    }
  });

  // ---------- Header buttons ----------
  document.getElementById('createBtn').addEventListener('click', () => openEventForm(null, loadData));
  document.getElementById('newsBtn').addEventListener('click', () => {
    document.getElementById('newsTitle').value = '';
    document.getElementById('newsContent').value = '';
    document.getElementById('newsError').classList.add('d-none');
    showModal('newsModal');
  });

  document.getElementById('newsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const box = document.getElementById('newsError');
    const title = document.getElementById('newsTitle').value.trim();
    const content = document.getElementById('newsContent').value.trim();
    if (title.length < 3 || content.length < 5) {
      box.textContent = 'Please enter a title (3+ characters) and a message (5+ characters).';
      box.classList.remove('d-none');
      return;
    }
    const btn = document.getElementById('newsSaveBtn');
    setBusy(btn, true, 'Posting...');
    try {
      const res = await api('/news', { method: 'POST', body: { title, content } });
      hideModal('newsModal');
      showToast(res.message);
      activeTab = 'news';
      await loadData();
    } catch (err) {
      box.textContent = err.message;
      box.classList.remove('d-none');
    } finally {
      setBusy(btn, false);
    }
  });
}
