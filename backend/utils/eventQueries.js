// utils/eventQueries.js  -  the SQL column list shared by several routes.
// Besides the event columns it calculates (inside MySQL):
//   registered_count, present_count, avg_rating, is_past, deadline_passed
const EVENT_COLUMNS = `
  e.event_id, e.title, e.description, e.category, e.mode, e.club_name, e.venue,
  e.event_datetime, e.registration_deadline, e.capacity, e.status, e.created_by,
  (SELECT COUNT(*) FROM registrations r
     WHERE r.event_id = e.event_id AND r.status = 'Registered') AS registered_count,
  (SELECT COUNT(*) FROM registrations r
     JOIN attendance a ON a.registration_id = r.registration_id
     WHERE r.event_id = e.event_id AND r.status = 'Registered' AND a.status = 'Present') AS present_count,
  (SELECT ROUND(AVG(f.rating), 1) FROM feedback f
     JOIN registrations r ON r.registration_id = f.registration_id
     WHERE r.event_id = e.event_id) AS avg_rating,
  (e.event_datetime < NOW())          AS is_past,
  (e.registration_deadline < NOW())   AS deadline_passed
`;

module.exports = { EVENT_COLUMNS };
