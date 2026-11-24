/* =====================================================================
   student.js  -  Student Portal
   Browse events, register / cancel, video link, feedback, certificate, news
   ===================================================================== */

const user = requireLogin('student');

if (user) {
  // ---------- State ----------
  let events = [];          // all events from the server
  let news = [];            // all club news
  let activeTab = 'events'; // 'events' | 'mine' | 'news'
  let activeCategory = 'All';
  let showFilter = 'upcoming';
  let searchText = '';
  let selectedEvent = null; // the event used by the open modal

  const CATEGORIES = ['Cultural', 'Technical', 'Workshop', 'Sports', 'General'];
  const listArea = document.getElementById('listArea');

  renderNavbar(user, loadData);
  loadData().catch((e) => {
    listArea.innerHTML = `<div class="alert alert-danger">${esc(e.message)}</div>`;
  });

  // ---------- Load data from the API ----------
  async function loadData() {
    const [ev, nw] = await Promise.all([api('/events'), api('/news')]);
    events = ev;
    news = nw;
    render();
  }

  // ---------- Drawing ----------
  function render() {
    document.getElementById('eventsToolbar').classList.toggle('d-none', activeTab !== 'events');

    document.querySelectorAll('.cw-tab').forEach((t) =>
      t.classList.toggle('active', t.dataset.tab === activeTab));

    const mine = events.filter((e) => e.my_status === 'Registered');
    document.getElementById('cntEvents').textContent = events.length;
    document.getElementById('cntMine').textContent = mine.length;
    document.getElementById('cntNews').textContent = news.length;

    if (activeTab === 'events') {
      renderPills();
      renderEventList(filteredEvents(true), 'No events match your filters.');
    } else if (activeTab === 'mine') {
      renderEventList(mine, 'You have not registered for any event yet. Open "All Events" to get started.');
    } else {
      renderNews();
    }
  }

  // Events after the "show" filter and the search box (before the category filter)
  function baseFiltered() {
    const q = searchText.toLowerCase();
    return events.filter((e) => {
      if (showFilter === 'upcoming' && e.is_past) return false;
      if (showFilter === 'past' && !e.is_past) return false;
      if (!q) return true;
      return [e.title, e.club_name, e.venue, e.description, e.category]
        .some((f) => String(f).toLowerCase().includes(q));
    });
  }
  function filteredEvents(applyCategory) {
    const base = baseFiltered();
    return applyCategory && activeCategory !== 'All'
      ? base.filter((e) => e.category === activeCategory)
      : base;
  }

  function renderPills() {
    const base = baseFiltered();
    const pills = [['All', base.length]].concat(
      CATEGORIES.map((c) => [c, base.filter((e) => e.category === c).length])
    );
    document.getElementById('categoryPills').innerHTML = pills.map(([name, count]) =>
      `<button class="filter-pill ${activeCategory === name ? 'active' : ''}" data-cat="${name}">${name} (${count})</button>`
    ).join('');
  }

  function renderEventList(list, emptyText) {
    if (list.length === 0) {
      listArea.innerHTML = `<div class="empty-state"><i class="bi bi-calendar-x fs-1 d-block mb-2"></i>${esc(emptyText)}</div>`;
      return;
    }
    listArea.innerHTML = list.map(eventCard).join('');
  }

  function eventCard(ev) {
    const seatsLeft = ev.capacity - ev.registered_count;
    const percent = Math.min(100, Math.round((ev.registered_count / ev.capacity) * 100));
    const registered = ev.my_status === 'Registered';

    // ---- Work out which buttons / labels to show ----
    let actions = '';
    if (ev.status === 'Cancelled') {
      actions = '<span class="status-pill pill-red">Event cancelled</span>';
    } else if (registered) {
      if (ev.is_past) {
        if (ev.my_attendance === 'Present') actions += '<span class="status-pill pill-green">Participated</span>';
        else if (ev.my_attendance === 'Absent') actions += '<span class="status-pill pill-red">Absent</span>';
        else actions += '<span class="status-pill pill-grey">Attendance pending</span>';
      } else {
        actions += '<span class="status-pill pill-green">Registered</span>';
        actions += `<button class="btn btn-sm btn-soft" data-action="cancel" data-id="${ev.event_id}">Cancel</button>`;
      }
      actions += `<button class="btn btn-sm btn-soft" data-action="video" data-id="${ev.event_id}">${ev.my_video_url ? 'Update video link' : 'Submit video link'}</button>`;
      if (ev.is_past) {
        if (ev.my_feedback_rating) actions += `<span class="status-pill pill-blue"><span class="stars">${stars(ev.my_feedback_rating)}</span> Feedback sent</span>`;
        else actions += `<button class="btn btn-sm btn-soft" data-action="feedback" data-id="${ev.event_id}">Give feedback</button>`;
        if (ev.my_attendance === 'Present') {
          actions += `<a class="btn btn-sm btn-primary" target="_blank" href="certificate.html?id=${ev.my_registration_id}"><i class="bi bi-award"></i> Certificate</a>`;
        }
      }
    } else if (ev.is_past) {
      actions = '<span class="status-pill pill-grey">Event ended</span>';
    } else if (ev.deadline_passed) {
      actions = '<span class="status-pill pill-amber">Registration closed</span>';
    } else if (seatsLeft <= 0) {
      actions = '<span class="status-pill pill-red">Event full</span>';
    } else {
      actions = `<button class="btn btn-primary" data-action="register" data-id="${ev.event_id}">Register</button>`;
    }

    const videoLink = registered && ev.my_video_url
      ? `<div class="mt-2"><a href="${esc(ev.my_video_url)}" target="_blank" rel="noopener">View submitted video <i class="bi bi-box-arrow-up-right"></i></a></div>`
      : '';

    return `
      <div class="event-card">
        <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
          <div>
            <h3>${esc(ev.title)}</h3>
            <div class="club">${esc(ev.club_name)}</div>
          </div>
          <div><span class="tag">${esc(ev.category)}</span><span class="tag">${esc(ev.mode)}</span></div>
        </div>
        <p class="mb-0">${esc(ev.description)}</p>
        <div class="event-meta">
          <span><i class="bi bi-calendar-event"></i>${esc(formatDateTime(ev.event_datetime))}</span>
          <span><i class="bi bi-geo-alt-fill"></i>${esc(ev.venue)}</span>
          <span><i class="bi bi-people-fill"></i>${ev.registered_count} of ${ev.capacity} registered
            <span class="seats-bar"><span style="width:${percent}%"></span></span></span>
          ${ev.is_past ? '' : `<span><i class="bi bi-hourglass-split"></i>Register by ${esc(formatDate(ev.registration_deadline))}</span>`}
        </div>
        <div class="event-actions">${actions}</div>
        ${videoLink}
      </div>`;
  }

  function renderNews() {
    if (news.length === 0) {
      listArea.innerHTML = '<div class="empty-state">No club news yet.</div>';
      return;
    }
    listArea.innerHTML = news.map((n) => `
      <div class="news-card">
        <div class="d-flex justify-content-between flex-wrap gap-1">
          <h4>${esc(n.title)}</h4>
          <span class="tag">${esc(n.club_name)}</span>
        </div>
        <div class="text-grey small mb-2">${esc(formatDateTime(n.posted_on))} · by ${esc(n.posted_by_name)}</div>
        <p class="mb-0">${esc(n.content)}</p>
      </div>`).join('');
  }

  // ---------- Events: filters ----------
  document.getElementById('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.cw-tab');
    if (!btn) return;
    activeTab = btn.dataset.tab;
    render();
  });
  document.getElementById('categoryPills').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-pill');
    if (!btn) return;
    activeCategory = btn.dataset.cat;
    render();
  });
  document.getElementById('searchBox').addEventListener('input', (e) => {
    searchText = e.target.value.trim();
    render();
  });
  document.getElementById('showFilter').addEventListener('change', (e) => {
    showFilter = e.target.value;
    render();
  });

  // ---------- Events: card buttons (one listener for all cards) ----------
  listArea.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    selectedEvent = events.find((x) => x.event_id === Number(btn.dataset.id));
    if (!selectedEvent) return;

    const action = btn.dataset.action;
    if (action === 'register') openRegister();
    if (action === 'cancel') cancelRegistration(btn);
    if (action === 'video') openVideo();
    if (action === 'feedback') openFeedback();
  });

  // ---------- Register ----------
  function openRegister() {
    const ev = selectedEvent;
    document.getElementById('registerBody').innerHTML = `
      <h5 class="mb-1">${esc(ev.title)}</h5>
      <div class="text-grey mb-3">${esc(ev.club_name)}</div>
      <ul class="list-unstyled mb-3">
        <li><i class="bi bi-calendar-event text-primary"></i> ${esc(formatDateTime(ev.event_datetime))}</li>
        <li><i class="bi bi-geo-alt-fill text-primary"></i> ${esc(ev.venue)} (${esc(ev.mode)})</li>
        <li><i class="bi bi-people-fill text-primary"></i> ${ev.capacity - ev.registered_count} seat(s) left</li>
      </ul>
      <div class="p-3 rounded" style="background:#f1f5f9">
        Registering as <strong>${esc(user.name)}</strong> (${esc(user.email)})
      </div>`;
    showModal('registerModal');
  }

  document.getElementById('confirmRegisterBtn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    setBusy(btn, true, 'Registering...');
    try {
      const res = await api('/registrations', { method: 'POST', body: { event_id: selectedEvent.event_id } });
      hideModal('registerModal');
      showToast(res.message);
      await loadData();
    } catch (err) {
      hideModal('registerModal');
      showToast(err.message, 'error');
      await loadData().catch(() => {});   // refresh: someone may have taken the last seat
    } finally {
      setBusy(btn, false);
    }
  });

  // ---------- Cancel ----------
  async function cancelRegistration(btn) {
    if (!confirm(`Cancel your registration for "${selectedEvent.title}"?`)) return;
    setBusy(btn, true, 'Cancelling...');
    try {
      const res = await api(`/registrations/${selectedEvent.my_registration_id}/cancel`, { method: 'POST' });
      showToast(res.message);
      await loadData();
    } catch (err) {
      showToast(err.message, 'error');
      setBusy(btn, false);
    }
  }

  // ---------- Video link ----------
  function openVideo() {
    document.getElementById('videoEventName').textContent = selectedEvent.title;
    document.getElementById('videoUrl').value = selectedEvent.my_video_url || '';
    document.getElementById('videoNote').value = selectedEvent.my_video_note || '';
    document.getElementById('videoError').classList.add('d-none');
    showModal('videoModal');
  }

  document.getElementById('videoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const box = document.getElementById('videoError');
    const url = document.getElementById('videoUrl').value.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) {
      box.textContent = 'Please enter a valid link starting with http:// or https://';
      box.classList.remove('d-none');
      return;
    }
    const btn = document.getElementById('videoSaveBtn');
    setBusy(btn, true, 'Saving...');
    try {
      const res = await api(`/registrations/${selectedEvent.my_registration_id}/video`, {
        method: 'PUT',
        body: { video_url: url, video_note: document.getElementById('videoNote').value.trim() }
      });
      hideModal('videoModal');
      showToast(res.message);
      await loadData();
    } catch (err) {
      box.textContent = err.message;
      box.classList.remove('d-none');
    } finally {
      setBusy(btn, false);
    }
  });

  // ---------- Feedback ----------
  function openFeedback() {
    document.getElementById('feedbackEventName').textContent = selectedEvent.title;
    document.getElementById('fbRating').value = '';
    document.getElementById('fbComments').value = '';
    document.getElementById('fbSuggestions').value = '';
    document.getElementById('feedbackError').classList.add('d-none');
    showModal('feedbackModal');
  }

  document.getElementById('feedbackForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const box = document.getElementById('feedbackError');
    const rating = document.getElementById('fbRating').value;
    if (!rating) {
      box.textContent = 'Please choose a rating.';
      box.classList.remove('d-none');
      return;
    }
    const btn = document.getElementById('feedbackBtn');
    setBusy(btn, true, 'Submitting...');
    try {
      const res = await api(`/registrations/${selectedEvent.my_registration_id}/feedback`, {
        method: 'POST',
        body: {
          rating: Number(rating),
          comments: document.getElementById('fbComments').value,
          suggestions: document.getElementById('fbSuggestions').value
        }
      });
      hideModal('feedbackModal');
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
