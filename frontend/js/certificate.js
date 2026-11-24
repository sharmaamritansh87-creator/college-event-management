/* =====================================================================
   certificate.js  -  shows a printable certificate for an event the
   student attended (attendance = Present).  URL:  certificate.html?id=<registration id>
   Uses the browser's Print dialog -> "Save as PDF".
   ===================================================================== */

const user = requireLogin('student');

if (user) {
  const area = document.getElementById('certArea');
  const id = new URLSearchParams(window.location.search).get('id');

  (async function load() {
    try {
      if (!id) throw new Error('No certificate was selected.');
      const c = await api(`/registrations/${encodeURIComponent(id)}/certificate`);
      const today = new Date();
      const issued = `${String(today.getDate()).padStart(2, '0')} ${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`;

      area.innerHTML = `
        <div class="cert-border">
          <div class="org">COLLEGEWORLD · CAMPUS EVENTS</div>
          <h1>Certificate of Participation</h1>
          <div class="small-line">This is to certify that</div>
          <div class="recipient">${esc(c.student_name)}</div>
          <div class="small-line">${c.student_id ? `(Roll no. ${esc(c.student_id)})` : ''}
            ${c.department ? `of the Department of ${esc(c.department)}` : ''}<br>
            has successfully participated in</div>
          <div class="event-name">${esc(c.event_title)}</div>
          <div class="small-line">organised by ${esc(c.club_name)} on ${esc(formatDate(c.event_datetime))}.</div>
          <div class="cert-sign">
            <div>Event Coordinator</div>
            <div>Dean, Student Affairs</div>
          </div>
          <div class="small-line mt-4 mb-0">Issued on ${issued}</div>
        </div>`;
      document.getElementById('printBtn').disabled = false;
    } catch (err) {
      area.innerHTML = `<div class="alert alert-danger m-4">${esc(err.message)}</div>`;
    }
  })();

  document.getElementById('printBtn').addEventListener('click', () => window.print());
}
