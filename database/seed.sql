-- =====================================================================
--  Campus Event Management System  -  DUMMY DATA
--  Run AFTER schema.sql.  All people here are made up.
--  Dates are relative to NOW(), so the demo always has upcoming events.
--
--  NOTE: {{DEMO_PASSWORD_HASH}} is replaced with a bcrypt hash of the
--  password "demo123" by `npm run setup` (backend/scripts/setup-db.js).
--  If you import this file manually, replace it yourself first.
-- =====================================================================
USE campus_events;

-- ----------------------------- USERS ---------------------------------
-- 1 admin, 2 organizers (club heads), 5 students   (password: demo123)
INSERT INTO users (user_id, name, email, password_hash, role, department, student_id, club_name) VALUES
(1, 'Prof. Vikram Malhotra', 'admin@college.edu',      '{{DEMO_PASSWORD_HASH}}', 'admin',     'Administration',         NULL,      NULL),
(2, 'Ananya Sen',            'clubhead@college.edu',   '{{DEMO_PASSWORD_HASH}}', 'organizer', 'Computer Science',       NULL,      'Music Club'),
(3, 'Karan Bhatia',          'codingclub@college.edu', '{{DEMO_PASSWORD_HASH}}', 'organizer', 'Information Technology', NULL,      'Coding Club'),
(4, 'Rahul Verma',           'student@college.edu',    '{{DEMO_PASSWORD_HASH}}', 'student',   'Computer Science',       'CS2301',  NULL),
(5, 'Priya Singh',           'priya@college.edu',      '{{DEMO_PASSWORD_HASH}}', 'student',   'Electronics',            'EC2305',  NULL),
(6, 'Aman Gupta',            'aman@college.edu',       '{{DEMO_PASSWORD_HASH}}', 'student',   'Mechanical',             'ME2311',  NULL),
(7, 'Sneha Kapoor',          'sneha@college.edu',      '{{DEMO_PASSWORD_HASH}}', 'student',   'Information Technology', 'IT2322',  NULL),
(8, 'Rohit Mehta',           'rohit@college.edu',      '{{DEMO_PASSWORD_HASH}}', 'student',   'Civil',                  'CE2330',  NULL);

-- ----------------------------- EVENTS --------------------------------
INSERT INTO events (event_id, title, description, category, mode, club_name, venue, event_datetime, registration_deadline, capacity, status, created_by) VALUES
-- Upcoming, open for registration
(1, 'Battle of Bands', 'Inter-college band competition. Register your band and rock the stage!',
    'Cultural', 'On campus', 'Music Club', 'Main Auditorium',
    DATE_ADD(NOW(), INTERVAL 10 DAY), DATE_ADD(NOW(), INTERVAL 8 DAY), 80, 'Published', 2),
(2, 'Open Mic Night', 'Poetry, singing and storytelling. Walk-in performers welcome.',
    'Cultural', 'On campus', 'Music Club', 'Amphitheatre',
    DATE_ADD(NOW(), INTERVAL 14 DAY), DATE_ADD(NOW(), INTERVAL 13 DAY), 60, 'Published', 2),
(3, 'CodeSprint Hackathon 5.0', '24-hour hackathon. Team size 2-4. Exciting prizes and internship interviews.',
    'Technical', 'Online', 'Coding Club', 'Online (Google Meet)',
    DATE_ADD(NOW(), INTERVAL 20 DAY), DATE_ADD(NOW(), INTERVAL 18 DAY), 100, 'Published', 3),
(5, 'Inter-Department Cricket Tournament', 'Knock-out cricket tournament. Each department fields one team of 11.',
    'Sports', 'On campus', 'Sports Committee', 'College Sports Ground',
    DATE_ADD(NOW(), INTERVAL 12 DAY), DATE_ADD(NOW(), INTERVAL 9 DAY), 120, 'Published', 1),
(6, 'Alumni Meet & Career Talk', 'Hear from alumni working in top companies and ask your career questions.',
    'General', 'On campus', 'Student Council', 'Seminar Hall',
    DATE_ADD(NOW(), INTERVAL 9 DAY), DATE_ADD(NOW(), INTERVAL 7 DAY), 150, 'Published', 1),

-- FULL event (capacity 3, 3 registrations) -> demonstrates "Event full"
(4, 'Web Development Workshop', 'Hands-on HTML, CSS and JavaScript workshop for beginners. Bring your laptop.',
    'Workshop', 'Hybrid', 'Coding Club', 'Computer Lab 2',
    DATE_ADD(NOW(), INTERVAL 6 DAY), DATE_ADD(NOW(), INTERVAL 4 DAY), 3, 'Published', 3),

-- Registration deadline already passed -> demonstrates "Registration closed"
(7, 'Campus Photography Walk', 'Explore the campus with your camera. Best photos win a goodie bag.',
    'General', 'On campus', 'Student Council', 'Library Entrance',
    DATE_ADD(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY), 40, 'Published', 1),

-- PAST events -> demonstrate attendance, feedback and certificates
(8, 'Tech Quiz 2026', 'Inter-department technical quiz covering programming, hardware and general tech.',
    'Technical', 'On campus', 'Coding Club', 'Room 204',
    DATE_SUB(NOW(), INTERVAL 10 DAY), DATE_SUB(NOW(), INTERVAL 12 DAY), 50, 'Published', 3),
(9, 'Poetry Slam', 'An evening of spoken-word poetry by students.',
    'Cultural', 'On campus', 'Music Club', 'Amphitheatre',
    DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_SUB(NOW(), INTERVAL 22 DAY), 60, 'Published', 2),

-- PENDING event -> the admin can approve it from the Admin portal
(10, 'Gaming Night', 'Casual esports night: FIFA, Valorant and board games.',
    'General', 'On campus', 'Coding Club', 'Student Activity Centre',
    DATE_ADD(NOW(), INTERVAL 25 DAY), DATE_ADD(NOW(), INTERVAL 23 DAY), 50, 'Pending', 3);

-- --------------------------- REGISTRATIONS ---------------------------
INSERT INTO registrations (registration_id, user_id, event_id, registered_on, status, video_url, video_note) VALUES
(1,  4, 1, DATE_SUB(NOW(), INTERVAL 2 DAY), 'Registered', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Our band rehearsal clip'),
(2,  5, 1, DATE_SUB(NOW(), INTERVAL 2 DAY), 'Registered', NULL, NULL),
(3,  6, 1, DATE_SUB(NOW(), INTERVAL 1 DAY), 'Registered', NULL, NULL),
(4,  4, 2, DATE_SUB(NOW(), INTERVAL 1 DAY), 'Registered', NULL, NULL),
(5,  7, 3, DATE_SUB(NOW(), INTERVAL 1 DAY), 'Registered', NULL, NULL),
-- Web Development Workshop is FULL (3 of 3)
(6,  5, 4, DATE_SUB(NOW(), INTERVAL 3 DAY), 'Registered', NULL, NULL),
(7,  7, 4, DATE_SUB(NOW(), INTERVAL 3 DAY), 'Registered', NULL, NULL),
(8,  8, 4, DATE_SUB(NOW(), INTERVAL 2 DAY), 'Registered', NULL, NULL),
-- A cancelled registration (does not count towards capacity)
(9,  6, 4, DATE_SUB(NOW(), INTERVAL 4 DAY), 'Cancelled',  NULL, NULL),
-- Past event: Tech Quiz 2026
(10, 4, 8, DATE_SUB(NOW(), INTERVAL 15 DAY), 'Registered', NULL, NULL),
(11, 5, 8, DATE_SUB(NOW(), INTERVAL 15 DAY), 'Registered', NULL, NULL),
(12, 6, 8, DATE_SUB(NOW(), INTERVAL 14 DAY), 'Registered', NULL, NULL),
(13, 7, 8, DATE_SUB(NOW(), INTERVAL 14 DAY), 'Registered', NULL, NULL),
-- Past event: Poetry Slam
(14, 4, 9, DATE_SUB(NOW(), INTERVAL 25 DAY), 'Registered', 'https://www.youtube.com/watch?v=jNQXAC9IVRw', 'My poem performance'),
(15, 8, 9, DATE_SUB(NOW(), INTERVAL 25 DAY), 'Registered', NULL, NULL);

-- ---------------------------- ATTENDANCE -----------------------------
INSERT INTO attendance (registration_id, status, marked_by, marked_on) VALUES
(10, 'Present', 3, DATE_SUB(NOW(), INTERVAL 10 DAY)),
(11, 'Present', 3, DATE_SUB(NOW(), INTERVAL 10 DAY)),
(12, 'Absent',  3, DATE_SUB(NOW(), INTERVAL 10 DAY)),
(13, 'Present', 3, DATE_SUB(NOW(), INTERVAL 10 DAY)),
(14, 'Present', 2, DATE_SUB(NOW(), INTERVAL 20 DAY)),
(15, 'Present', 2, DATE_SUB(NOW(), INTERVAL 20 DAY));

-- ----------------------------- FEEDBACK ------------------------------
-- (Rahul's registration 10 has NO feedback yet, so you can demo submitting one)
INSERT INTO feedback (registration_id, rating, comments, suggestions, submitted_on) VALUES
(11, 5, 'Great questions and well organised.',          'Add a team round next time.', DATE_SUB(NOW(), INTERVAL 9 DAY)),
(13, 4, 'Enjoyed it, a few questions were too easy.',   NULL,                          DATE_SUB(NOW(), INTERVAL 9 DAY)),
(14, 5, 'Loved the atmosphere!',                        'More such evenings please.',  DATE_SUB(NOW(), INTERVAL 19 DAY)),
(15, 4, 'Good event.',                                  NULL,                          DATE_SUB(NOW(), INTERVAL 19 DAY));

-- ----------------------------- CLUB NEWS -----------------------------
INSERT INTO club_news (news_id, title, content, club_name, posted_by, posted_on) VALUES
(1, 'Band registrations are open!', 'Battle of Bands registrations close in 8 days. Bring your best setlist and a 2-minute demo clip.', 'Music Club', 2, DATE_SUB(NOW(), INTERVAL 1 DAY)),
(2, 'Hackathon problem statements released', 'CodeSprint 5.0 problem statements are on the Coding Club notice board. Teams of 2-4 only.', 'Coding Club', 3, DATE_SUB(NOW(), INTERVAL 2 DAY)),
(3, 'Cricket trials this Friday', 'Department team trials will be held on the sports ground at 4 PM. Carry your ID cards.', 'Sports Committee', 1, DATE_SUB(NOW(), INTERVAL 3 DAY)),
(4, 'Certificates for Tech Quiz', 'Participants of Tech Quiz 2026 can now download their certificates from the Student Portal.', 'Coding Club', 3, DATE_SUB(NOW(), INTERVAL 5 DAY));
