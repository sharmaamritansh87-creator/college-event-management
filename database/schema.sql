-- =====================================================================
--  Campus Event Management System  -  DATABASE SCHEMA  (MySQL 8 / MariaDB 10.4+)
--  Run this file first.  It (re)creates the database and all tables.
--  WARNING: it drops existing tables with the same names.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS campus_events
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE campus_events;

-- Drop in reverse order of dependency (children first)
DROP TABLE IF EXISTS feedback;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS registrations;
DROP TABLE IF EXISTS club_news;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS users;

-- ---------------------------------------------------------------------
-- USERS : students, organizers (club heads) and admins share one table;
--         the "role" column decides what each person can do.
-- ---------------------------------------------------------------------
CREATE TABLE users (
  user_id        INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  email          VARCHAR(150) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,              -- bcrypt hash, never plain text
  role           ENUM('student','organizer','admin') NOT NULL DEFAULT 'student',
  department     VARCHAR(100) DEFAULT NULL,
  student_id     VARCHAR(30)  DEFAULT NULL,          -- roll number (students)
  club_name      VARCHAR(100) DEFAULT NULL,          -- only for organizers
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- EVENTS : created by an organizer (needs admin approval) or by an admin
-- ---------------------------------------------------------------------
CREATE TABLE events (
  event_id               INT AUTO_INCREMENT PRIMARY KEY,
  title                  VARCHAR(150) NOT NULL,
  description            TEXT NOT NULL,
  category               ENUM('Cultural','Technical','Workshop','Sports','General') NOT NULL,
  mode                   ENUM('On campus','Online','Hybrid') NOT NULL DEFAULT 'On campus',
  club_name              VARCHAR(100) NOT NULL,
  venue                  VARCHAR(150) NOT NULL,
  event_datetime         DATETIME NOT NULL,
  registration_deadline  DATETIME NOT NULL,
  capacity               INT NOT NULL,
  status                 ENUM('Pending','Published','Cancelled') NOT NULL DEFAULT 'Pending',
  created_by             INT NOT NULL,                -- FK -> users (organizer)
  created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_events_creator FOREIGN KEY (created_by)
      REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT chk_events_capacity CHECK (capacity > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- REGISTRATIONS : which student registered for which event.
-- UNIQUE(user_id, event_id) is the database-level guard against
-- duplicate registrations (the API also checks it first).
-- ---------------------------------------------------------------------
CREATE TABLE registrations (
  registration_id  INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT NOT NULL,                      -- FK -> users (student)
  event_id         INT NOT NULL,                      -- FK -> events
  registered_on    DATETIME DEFAULT CURRENT_TIMESTAMP,
  status           ENUM('Registered','Cancelled') NOT NULL DEFAULT 'Registered',
  video_url        VARCHAR(500) DEFAULT NULL,         -- participation video link
  video_note       VARCHAR(255) DEFAULT NULL,
  CONSTRAINT uq_user_event UNIQUE (user_id, event_id),
  CONSTRAINT fk_reg_user  FOREIGN KEY (user_id)  REFERENCES users(user_id)   ON DELETE CASCADE,
  CONSTRAINT fk_reg_event FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- ATTENDANCE : one row per registration once the organizer marks it.
-- No row = "Pending".
-- ---------------------------------------------------------------------
CREATE TABLE attendance (
  attendance_id    INT AUTO_INCREMENT PRIMARY KEY,
  registration_id  INT NOT NULL UNIQUE,
  status           ENUM('Present','Absent') NOT NULL,
  marked_by        INT DEFAULT NULL,
  marked_on        DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_att_reg  FOREIGN KEY (registration_id) REFERENCES registrations(registration_id) ON DELETE CASCADE,
  CONSTRAINT fk_att_user FOREIGN KEY (marked_by)       REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- FEEDBACK : one rating per registration (after the event is over)
-- ---------------------------------------------------------------------
CREATE TABLE feedback (
  feedback_id      INT AUTO_INCREMENT PRIMARY KEY,
  registration_id  INT NOT NULL UNIQUE,
  rating           TINYINT NOT NULL,
  comments         TEXT,
  suggestions      TEXT,
  submitted_on     DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fb_reg FOREIGN KEY (registration_id) REFERENCES registrations(registration_id) ON DELETE CASCADE,
  CONSTRAINT chk_fb_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- CLUB_NEWS : announcements posted by organizers / admins
-- ---------------------------------------------------------------------
CREATE TABLE club_news (
  news_id    INT AUTO_INCREMENT PRIMARY KEY,
  title      VARCHAR(150) NOT NULL,
  content    TEXT NOT NULL,
  club_name  VARCHAR(100) NOT NULL,
  posted_by  INT NOT NULL,
  posted_on  DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_news_user FOREIGN KEY (posted_by) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;
