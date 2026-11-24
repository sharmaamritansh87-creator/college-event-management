/* =====================================================================
   modals.js  -  two pop-ups shared by the Club Head and Admin portals
     openEventForm(event | null, onSaved)   create / edit an event
     openParticipants(event, onChanged)     participant list + attendance
   Needs common.js to be loaded first.
   ===================================================================== */

(function injectSharedModals() {
  document.body.insertAdjacentHTML('beforeend', `
  <!-- Event form -->
  <div class="modal fade" id="eventFormModal" tabindex="-1">
    <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content">
        <form id="eventForm" novalidate>
          <div class="modal-header">
            <h5 class="modal-title" id="eventFormTitle">Create event</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label" for="efTitle">Event name *</label>
              <input type="text" class="form-control" id="efTitle" maxlength="150">
            </div>
            <div class="mb-3">
              <label class="form-label" for="efDescription">Description *</label>
              <textarea class="form-control" id="efDescription" rows="3"></textarea>
            </div>
            <div class="row">
              <div class="col-sm-4 mb-3">
                <label class="form-label" for="efCategory">Category *</label>
                <select class="form-select" id="efCategory">
                  <option>Cultural</option><option>Technical</option><option>Workshop</option>
                  <option>Sports</option><option>General</option>
                </select>
              </div>
              <div class="col-sm-4 mb-3">
                <label class="form-label" for="efMode">Mode *</label>
                <select class="form-select" id="efMode">
                  <option>On campus</option><option>Online</option><option>Hybrid</option>
                </select>
              </div>
              <div class="col-sm-4 mb-3">
                <label class="form-label" for="efCapacity">Capacity *</label>
                <input type="number" class="form-control" id="efCapacity" min="1" max="10000" value="50">
              </div>
            </div>
            <div class="row">
              <div class="col-sm-6 mb-3">
                <label class="form-label" for="efVenue">Venue *</label>
                <input type="text" class="form-control" id="efVenue" maxlength="150">
              </div>
              <div class="col-sm-6 mb-3">
                <label class="form-label" for="efClub">Club / organizer *</label>
                <input type="text" class="form-control" id="efClub" maxlength="100">
              </div>
            </div>
            <div class="row">
              <div class="col-sm-6 mb-3">
                <label class="form-label" for="efDate">Event date &amp; time *</label>
                <input type="datetime-local" class="form-control" id="efDate">
              </div>
              <div class="col-sm-6 mb-3">
                <label class="form-label" for="efDeadline">Registration deadline *</label>
                <input type="datetime-local" class="form-control" id="efDeadline">
              </div>
            </div>
            <div class="alert alert-info py-2 mb-2 d-none" id="efApprovalNote">
              <i class="bi bi-info-circle"></i> New events are sent to the admin for approval before students can see them.
            </div>
            <div id="eventFormError" class="alert alert-danger py-2 d-none"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-soft" data-bs-dismiss="modal">Cancel</button>
            <button type="submit" class="btn btn-primary" id="eventSaveBtn">Save event</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- Participants + attendance -->
  <div class="modal fade" id="participantsModal" tabindex="-1">
    <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <h5 class="modal-title" id="pmTitle">Participants</h5>
            <div class="text-grey small" id="pmSummary"></div>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div class="d-flex gap-2 flex-wrap mb-3">
            <button class="btn btn-sm btn-primary" id="pmMarkAll"><i class="bi bi-check2-all"></i> Mark all present</button>
            <button class="btn btn-sm btn-soft" id="pmExport"><i class="bi bi-download"></i> Export participant list (CSV)</button>
          </div>
          <div id="pmBody"></div>
        </div>
      </div>
    </div>
  </div>`);
})();

/* ---------------------------------------------------------------------
   EVENT FORM
   --------------------------------------------------------------------- */
let efEditingId = null;
let efOnSaved = null;
let efUser = null;

function openEventForm(ev, onSaved) {
  efUser = getUser();
  efEditingId = ev ? ev.event_id : null;
  efOnSaved = onSaved;

  document.getElementById('eventFormTitle').textContent = ev ? 'Edit event' : 'Create event';
  document.getElementById('efTitle').value = ev ? ev.title : '';
  document.getElementById('efDescription').value = ev ? ev.description : '';
  document.getElementById('efCategory').value = ev ? ev.category : 'Cultural';
  document.getElementById('efMode').value = ev ? ev.mode : 'On campus';
  document.getElementById('efCapacity').value = ev ? ev.capacity : 50;
  document.getElementById('efVenue').value = ev ? ev.venue : '';
  document.getElementById('efDate').value = ev ? toInputValue(ev.event_datetime) : '';
  document.getElementById('efDeadline').value = ev ? toInputValue(ev.registration_deadline) : '';

  // Organizers always use their own club name; admins can type any
  const club = document.getElementById('efClub');
  if (efUser.role === 'organizer') {
    club.value = efUser.club_name || 'Student Council';
    club.disabled = true;
  } else {
    club.value = ev ? ev.club_name : 'Student Council';
    club.disabled = false;
  }

  document.getElementById('efApprovalNote').classList.toggle('d-none', !(efUser.role === 'organizer' && !ev));
  document.getElementById('eventFormError').classList.add('d-none');
  showModal('eventFormModal');
}

document.getElementById('eventForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const box = document.getElementById('eventFormError');
  box.classList.add('d-none');

  const body = {
    title: document.getElementById('efTitle').value.trim(),
    description: document.getElementById('efDescription').value.trim(),
    category: document.getElementById('efCategory').value,
    mode: document.getElementById('efMode').value,
    capacity: Number(document.getElementById('efCapacity').value),
    venue: document.getElementById('efVenue').value.trim(),
    club_name: document.getElementById('efClub').value.trim(),
    event_datetime: document.getElementById('efDate').value,
    registration_deadline: document.getElementById('efDeadline').value
  };

  // Quick checks in the browser (the server checks everything again)
  let problem = '';
  if (body.title.length < 3) problem = 'Please enter an event name (at least 3 characters).';
  else if (body.description.length < 10) problem = 'Please write a description (at least 10 characters).';
  else if (!body.venue) problem = 'Please enter the venue.';
  else if (!body.club_name) problem = 'Please enter the club / organizer name.';
  else if (!Number.isInteger(body.capacity) || body.capacity < 1) problem = 'Capacity must be a whole number of 1 or more.';
  else if (!body.event_datetime) problem = 'Please choose the event date and time.';
  else if (!body.registration_deadline) problem = 'Please choose the registration deadline.';
  else if (body.registration_deadline > body.event_datetime) problem = 'The registration deadline must be on or before the event date.';
  if (problem) {
    box.textContent = problem;
    box.classList.remove('d-none');
    return;
  }

  const btn = document.getElementById('eventSaveBtn');
  setBusy(btn, true, 'Saving...');
  try {
    const res = efEditingId
      ? await api('/events/' + efEditingId, { method: 'PUT', body })
      : await api('/events', { method: 'POST', body });
    hideModal('eventFormModal');
    showToast(res.message);
    if (efOnSaved) await efOnSaved();
  } catch (err) {
    box.textContent = err.message;
    box.classList.remove('d-none');
  } finally {
    setBusy(btn, false);
  }
});

/* ---------------------------------------------------------------------
   PARTICIPANTS + ATTENDANCE
   --------------------------------------------------------------------- */
let pmEvent = null;
let pmRows = [];
let pmOnChanged = null;

async function openParticipants(ev, onChanged) {
  pmEvent = ev;
  pmOnChanged = onChanged;
  document.getElementById('pmTitle').textContent = ev.title;
  document.getElementById('pmSummary').textContent = '';
  document.getElementById('pmBody').innerHTML = '<div class="spinner-wrap"><div class="spinner-border text-primary"></div></div>';
  showModal('participantsModal');
  try {
    await loadParticipants();
  } catch (err) {
    document.getElementById('pmBody').innerHTML = `<div class="alert alert-danger">${esc(err.message)}</div>`;
  }
}

async function loadParticipants() {
  pmRows = await api(`/events/${pmEvent.event_id}/participants`);
  drawParticipants();
}

function attendanceBadge(status) {
  if (status === 'Present') return '<span class="status-pill pill-green">Present</span>';
  if (status === 'Absent') return '<span class="status-pill pill-red">Absent</span>';
  return '<span class="status-pill pill-grey">Pending</span>';
}

function drawParticipants() {
  const present = pmRows.filter((r) => r.attendance_status === 'Present').length;
  document.getElementById('pmSummary').textContent =
    `${pmRows.length} registered of ${pmEvent.capacity} seats · ${present} present · ${formatDateTime(pmEvent.event_datetime)}`;

  const body = document.getElementById('pmBody');
  if (pmRows.length === 0) {
    body.innerHTML = '<div class="empty-state">No students have registered yet.</div>';
    return;
  }
  body.innerHTML = `
    <div class="table-card"><div class="table-responsive"><table class="table table-hover">
      <thead><tr>
        <th>#</th><th>Student</th><th>Roll no.</th><th>Registered on</th>
        <th>Video</th><th>Feedback</th><th>Attendance</th><th>Mark</th>
      </tr></thead>
      <tbody>
      ${pmRows.map((r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${esc(r.name)}</strong><div class="text-grey small">${esc(r.email)}</div></td>
          <td>${esc(r.student_id || '-')}</td>
          <td>${esc(formatDate(r.registered_on))}</td>
          <td>${r.video_url ? `<a href="${esc(r.video_url)}" target="_blank" rel="noopener">Watch <i class="bi bi-box-arrow-up-right"></i></a>` : '<span class="text-grey">-</span>'}</td>
          <td>${r.feedback_rating ? `<span class="stars">${stars(r.feedback_rating)}</span>` : '<span class="text-grey">-</span>'}</td>
          <td>${attendanceBadge(r.attendance_status)}</td>
          <td class="text-nowrap">
            <button class="btn btn-sm btn-outline-success" data-att="Present" data-reg="${r.registration_id}">Present</button>
            <button class="btn btn-sm btn-outline-danger" data-att="Absent" data-reg="${r.registration_id}">Absent</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div></div>`;
}

// Present / Absent buttons
document.getElementById('pmBody').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-att]');
  if (!btn) return;
  btn.disabled = true;
  try {
    await api('/attendance', { method: 'PUT', body: { registration_id: Number(btn.dataset.reg), status: btn.dataset.att } });
    await loadParticipants();
    if (pmOnChanged) pmOnChanged();
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
  }
});

// Mark all present
document.getElementById('pmMarkAll').addEventListener('click', async () => {
  if (pmRows.length === 0) return showToast('There are no registered students yet.', 'info');
  if (!confirm('Mark every registered student as Present?')) return;
  try {
    const res = await api('/attendance/mark-all', { method: 'POST', body: { event_id: pmEvent.event_id } });
    showToast(res.message);
    await loadParticipants();
    if (pmOnChanged) pmOnChanged();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Export participant list
document.getElementById('pmExport').addEventListener('click', () => {
  if (pmRows.length === 0) return showToast('There is nothing to export yet.', 'info');
  const headers = ['Name', 'Email', 'Roll No', 'Department', 'Registered On', 'Attendance', 'Video Link', 'Feedback Rating'];
  const rows = pmRows.map((r) => [
    r.name, r.email, r.student_id || '', r.department || '', r.registered_on,
    r.attendance_status, r.video_url || '', r.feedback_rating || ''
  ]);
  const safeName = pmEvent.title.replace(/[^a-z0-9]+/gi, '_');
  downloadCSV(`participants_${safeName}.csv`, headers, rows);
});
