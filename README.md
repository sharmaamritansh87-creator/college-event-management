# CollegeWorld – Campus Event Management System

A web application where **students** discover and register for campus events, **club heads (organizers)** create events and mark attendance, and an **admin** approves events, manages users and downloads reports.

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, JavaScript (plain, no framework) + Bootstrap 5 |
| Backend | Node.js + Express (REST API) |
| Database | MySQL (tables with primary/foreign keys) |
| Security | bcrypt password hashing, JWT login tokens, role-based access control |

---

## 1. Folder structure

```
campus-event-management/
├── README.md                  <- you are here
├── database/                  <- DATABASE
│   ├── schema.sql             <- creates the database and 6 tables
│   └── seed.sql               <- dummy data (users, events, registrations ...)
├── backend/                   <- BACKEND (Node.js + Express)
│   ├── package.json           <- dependencies + npm scripts
│   ├── .env.example           <- copy to ".env" and edit
│   ├── server.js              <- starts the server, mounts routes, serves the frontend
│   ├── config/
│   │   └── db.js              <- MySQL connection pool
│   ├── middleware/
│   │   └── auth.js            <- login check + role check
│   ├── routes/
│   │   ├── auth.js            <- sign up, log in, current user
│   │   ├── events.js          <- list / create / edit / delete events, participants
│   │   ├── registrations.js   <- register, cancel, video link, feedback, certificate data
│   │   ├── attendance.js      <- mark Present / Absent
│   │   ├── news.js            <- club announcements
│   │   └── admin.js           <- statistics, users, report data
│   ├── utils/                 <- small helpers (validation, errors, shared SQL)
│   └── scripts/
│       └── setup-db.js        <- one command to build the database + load dummy data
└── frontend/                  <- FRONTEND (HTML + CSS + JavaScript)
    ├── index.html             <- login + sign up
    ├── student.html           <- Student Portal
    ├── organizer.html         <- Club Head Portal
    ├── admin.html             <- Admin Portal
    ├── certificate.html       <- printable participation certificate
    ├── css/
    │   └── style.css          <- our own styles
    └── js/
        ├── common.js          <- shared helpers: api(), session, toast, navbar, CSV
        ├── modals.js          <- shared pop-ups: event form, participants/attendance
        ├── login.js  student.js  organizer.js  admin.js  certificate.js
```

---

## 2. Setup (about 5 minutes)

### Prerequisites
* **Node.js 18 or newer** – https://nodejs.org (check with `node -v`)
* **MySQL 8** (or XAMPP / MariaDB 10.4+) running on your computer
* An internet connection when you open the site (Bootstrap and fonts load from a CDN)

### Steps

```bash
# 1. open a terminal in the backend folder
cd campus-event-management/backend

# 2. install the libraries
npm install

# 3. create your settings file
cp .env.example .env          # Windows (cmd):  copy .env.example .env
#    now open .env and set DB_PASSWORD (XAMPP: leave it empty) and JWT_SECRET

# 4. create the database, tables and dummy data (run this once)
npm run setup

# 5. start the app
npm start
```

Open **http://localhost:3000** in your browser.

> Always open the site through `http://localhost:3000`, **not** by double-clicking the HTML files. The pages talk to the API on the same address.

> **Reset the demo data** any time by running `npm run setup` again (it wipes and recreates the tables).

> **Prefer phpMyAdmin / MySQL Workbench?** Import `database/schema.sql`, then open `database/seed.sql`, replace every `{{DEMO_PASSWORD_HASH}}` with a bcrypt hash of your password, and import it. `npm run setup` does this for you automatically, so it is the easier route.

---

## 3. Demo accounts (password for all: `demo123`)

| Role | Email | Notes |
|---|---|---|
| Admin | admin@college.edu | Approves events, manages users, reports |
| Club Head | clubhead@college.edu | Music Club |
| Club Head | codingclub@college.edu | Coding Club (owns the *Gaming Night* event awaiting approval) |
| Student | student@college.edu | Rahul Verma |
| Students | priya@ / aman@ / sneha@ / rohit@college.edu | extra students for participant lists |

The login page also has **click-to-fill** buttons for Admin, Club Head and Student.

The dummy data deliberately includes every situation you want to demonstrate:

| Situation | Event in the data |
|---|---|
| Normal registration | Battle of Bands, Open Mic Night, CodeSprint Hackathon 5.0 |
| **Event full** | Web Development Workshop (3 of 3 seats taken) |
| **Registration closed** (deadline passed) | Campus Photography Walk |
| **Past event** with attendance, feedback, certificate | Tech Quiz 2026, Poetry Slam |
| **Pending approval** (admin must approve) | Gaming Night |

Event dates are generated relative to *today*, so upcoming events are always upcoming whenever you run `npm run setup`.

---

## 4. What each role can do

**Student** – sign up / log in · browse events · filter by category (Cultural, Technical, Workshop, Sports, General) · search · register (with confirmation) · cancel registration · see "My Registrations" · submit/update a participation video link · give feedback and a 1-5 rating after an event · download a certificate (only if marked Present) · read club news.

**Club Head (organizer)** – create events (sent to the admin for approval) · edit / delete own events · see participants · mark each student Present / Absent or *Mark all present* · export the participant list as CSV · view average ratings · post and delete club announcements.

**Admin** – dashboard statistics (events, registrations, attendance %, students, club heads, category chart, most popular events) · approve, cancel, re-publish or delete **any** event · create events directly · add users, change roles, delete users · download the events report as CSV.

---

## 5. How it works (architecture)

```
 Browser (HTML + CSS + JS + Bootstrap)
        │   fetch("/api/...")  with  Authorization: Bearer <JWT>
        ▼
 Express server  (server.js)
   ├── middleware/auth.js   -> who are you? what is your role?
   ├── routes/*.js          -> business rules + validation
   └── config/db.js         -> mysql2 connection pool (parameterized queries)
        ▼
 MySQL database (users, events, registrations, attendance, feedback, club_news)
```

1. The **browser** pages call the REST API using `fetch` (see `frontend/js/common.js → api()`).
2. After login the server returns a **JWT token**; the browser stores it and sends it with every request (session management).
3. `middleware/auth.js` verifies the token, loads the user from MySQL and checks the **role** before a route runs (role-based access control).
4. Routes validate input, run **parameterized SQL** (`?` placeholders – protects against SQL injection) and return JSON.
5. Express also serves the `frontend/` folder, so one command runs the whole project.

### Database tables

| Table | Purpose | Key relations |
|---|---|---|
| `users` | students, organizers, admins (`role` column) | – |
| `events` | event details, capacity, deadline, status | `created_by` → users |
| `registrations` | who registered for what, video link | `user_id` → users, `event_id` → events, **UNIQUE(user_id, event_id)** |
| `attendance` | Present / Absent per registration | `registration_id` → registrations |
| `feedback` | rating + comments per registration | `registration_id` → registrations |
| `club_news` | announcements | `posted_by` → users |

### The tricky parts (good for your viva)

| Challenge | How it is solved |
|---|---|
| **Duplicate registrations** | API checks for an existing row first; the database `UNIQUE(user_id, event_id)` key is a second safety net. A cancelled registration is re-activated instead of duplicated. |
| **Event capacity** | Registration runs in a **transaction** that locks the event row (`SELECT … FOR UPDATE`), counts active registrations and only then inserts, so two students cannot take the last seat together. |
| **Authentication** | Passwords stored as **bcrypt hashes**; login returns a signed **JWT**; the token is checked on every request. |
| **Authorization** | `requireRole()` middleware + ownership checks (a club head can only edit/mark attendance for *their own* events). |
| **Database relationships** | Foreign keys with `ON DELETE CASCADE`; many-to-many between students and events through `registrations`. |
| **Form validation** | Checked in the browser for quick feedback **and** again on the server (never trust the browser). |
| **XSS protection** | All user text is escaped (`esc()` in `common.js`) before it is shown on the page. |

---

## 6. API reference

All routes except `/api/auth/*` need the header `Authorization: Bearer <token>`.

| Method & URL | Who | What it does |
|---|---|---|
| `POST /api/auth/register` | public | student sign up |
| `POST /api/auth/login` | public | log in, returns token + user |
| `GET /api/auth/me` | any | current user |
| `GET /api/events` | any | published events + my registration info |
| `GET /api/events/manage` | organizer, admin | events I manage (admin: all) |
| `POST /api/events` | organizer, admin | create event (organizer → Pending, admin → Published) |
| `PUT /api/events/:id` | owner, admin | edit event |
| `PATCH /api/events/:id/status` | admin | approve / cancel / re-publish |
| `DELETE /api/events/:id` | owner, admin | delete event |
| `GET /api/events/:id/participants` | owner, admin | registered students + attendance |
| `POST /api/registrations` | student | register `{event_id}` |
| `POST /api/registrations/:id/cancel` | student | cancel registration |
| `PUT /api/registrations/:id/video` | student | save video link |
| `POST /api/registrations/:id/feedback` | student | rating + comments |
| `GET /api/registrations/:id/certificate` | student | certificate data (only if Present) |
| `PUT /api/attendance` | owner, admin | mark one student `{registration_id, status}` |
| `POST /api/attendance/mark-all` | owner, admin | mark everyone Present `{event_id}` |
| `GET /api/news` / `POST` / `DELETE /:id` | any / organizer, admin | announcements |
| `GET /api/admin/stats` | admin | dashboard numbers |
| `GET /api/admin/report` | admin | data for the CSV report |
| `GET/POST /api/admin/users`, `PUT /users/:id/role`, `DELETE /users/:id` | admin | user management |

---

## 7. 5-minute demo script

1. **Login page** → click *Student* → Sign in.
2. **Student Portal** → show category pills with live counts, try the search box. Register for *Battle of Bands* (confirmation dialog → toast → card turns **Registered**).
3. Point out **Web Development Workshop = "Event full"** and **Photography Walk = "Registration closed"**.
4. Submit a **video link**; open **My Registrations** and **Club News**.
5. Choose *Show: Past events* → give **feedback** on *Tech Quiz 2026* → open the **Certificate**.
6. Log out → **Club Head** (Music Club) → open **Participants** for *Battle of Bands*, mark attendance, **export CSV**. Create a new event → it shows *Pending approval*.
7. Log out → **Admin** → see statistics → **Manage Events** → approve *Gaming Night* → **Users** tab → **Download report (CSV)**.

---

## 8. Test checklist

| # | Test | Expected |
|---|---|---|
| 1 | Log in with a wrong password | "Incorrect email or password." |
| 2 | Sign up with an email that already exists | "An account with this email already exists." |
| 3 | Student registers for an event | Card shows *Registered*, seat count goes up |
| 4 | Register for the same event again (e.g. in a second tab) | "You are already registered…" |
| 5 | Register for *Web Development Workshop* | "Event full" – no Register button; the API also refuses |
| 6 | Register for *Photography Walk* | "Registration closed" |
| 7 | Cancel a registration | Card goes back to *Register*, seat freed |
| 8 | Student opens `admin.html` | Redirected to the Student Portal |
| 9 | Club head tries to edit another club's event (API) | 403 "You can only manage events created by you." |
| 10 | Create an event with the deadline after the event date | Validation error |
| 11 | Mark a student Present → student opens the past event | *Participated* + Certificate button |
| 12 | Admin approves a Pending event | It appears in the Student Portal |

---

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| `JWT_SECRET is missing` | You did not create `backend/.env`. Run `cp .env.example .env`. |
| `Access denied for user 'root'` | Put your MySQL password in `DB_PASSWORD` in `.env`. |
| `ECONNREFUSED` / cannot connect | MySQL is not running – start it (XAMPP Control Panel → MySQL → Start). |
| `Unknown database 'campus_events'` | Run `npm run setup` once. |
| Page looks unstyled | You are offline – Bootstrap loads from a CDN. |
| "Cannot reach the server" in the browser | Start the backend (`npm start`) and use `http://localhost:3000`. |
| Port 3000 already in use | Change `PORT` in `.env` and open the new port. |

---

## 10. Notes

* Brand name "CollegeWorld" appears in the page `<title>`s, `common.js` (navbar) and `index.html` – search and replace to rename it.
* Everything in `seed.sql` is made-up data. Real students sign up through the website.
* Possible next steps (also in your report's future scope): QR-code attendance, e-mail/SMS notifications, calendar integration, payment gateway, cloud deployment.
