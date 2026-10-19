PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS enrolments;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS students;


-- 1. TABLES

--student
CREATE TABLE students (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    email           TEXT    NOT NULL UNIQUE,
    date_registered TEXT    NOT NULL DEFAULT CURRENT_DATE
);

-- Course
CREATE TABLE courses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT    NOT NULL UNIQUE,
    title       TEXT    NOT NULL,
    description TEXT,
    credits     INTEGER NOT NULL DEFAULT 3 CHECK (credits > 0)
);


CREATE TABLE enrolments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id  INTEGER NOT NULL,
    course_id   INTEGER NOT NULL,
    grade       TEXT    CHECK (grade IS NULL OR grade IN ('A', 'B', 'C', 'D', 'F')),
    enrolled_on TEXT    NOT NULL DEFAULT CURRENT_DATE,
    FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
    FOREIGN KEY (course_id)  REFERENCES courses  (id) ON DELETE CASCADE,
    UNIQUE (student_id, course_id)
);

CREATE INDEX idx_enrolments_course_id ON enrolments (course_id);


-- 2. SAMPLE DATA

INSERT INTO students (name, email, date_registered) VALUES
    ('Amina Hassan',  'amina.hassan@example.com',  '2026-01-12'),
    ('Daniel Okoye',  'daniel.okoye@example.com',  '2026-01-12'),
    ('Sofia Ramirez', 'sofia.ramirez@example.com', '2026-01-19'),
    ('Liam Chen',     'liam.chen@example.com',     '2026-02-02'),
    ('Grace Mwangi',  'grace.mwangi@example.com',  '2026-02-16');

INSERT INTO courses (code, title, description, credits) VALUES
    ('CS101', 'Introduction to Computer Science', 'Programming fundamentals, algorithms and problem solving.', 4),
    ('CS201', 'Database Systems',                 'Relational modelling, SQL and transaction processing.',        4),
    ('MA150', 'Mathematics for Computing',         'Discrete mathematics, logic and linear algebra.',             3),
    ('EN105', 'Academic Writing',                 'Essay structure, referencing and academic integrity.',        2);


INSERT INTO enrolments (student_id, course_id, grade, enrolled_on) VALUES
    (1, 1, 'A',    '2026-02-20'),
    (1, 2, 'B',    '2026-02-20'),
    (2, 1, 'C',    '2026-02-21'),
    (2, 3, 'B',    '2026-02-21'),
    (3, 2, 'A',    '2026-02-24'),
    (4, 1, 'B',    '2026-02-25'),
    (4, 3, NULL,   '2026-02-25');


-- QUERY 1: All courses for one student, looked up by name.
SELECT s.name  AS student,
       c.code  AS course_code,
       c.title AS course_title,
       e.grade
FROM students s
JOIN enrolments e ON e.student_id = s.id
JOIN courses c     ON c.id = e.course_id
WHERE s.name = 'Amina Hassan'
ORDER BY c.code;

-- QUERY 2: All students on one course.
SELECT c.code    AS course_code,
       c.title   AS course_title,
       s.name    AS student,
       s.email   AS email,
       e.grade   AS grade
FROM courses c
JOIN enrolments e ON e.course_id = c.id
JOIN students s   ON s.id = e.student_id
WHERE c.code = 'CS101'
ORDER BY s.name;

-- QUERY 3: Number of students per course (courses with no students show 0).
SELECT c.code            AS course_code,
       c.title           AS course_title,
       COUNT(e.student_id) AS student_count
FROM courses c
LEFT JOIN enrolments e ON e.course_id = c.id
GROUP BY c.id, c.code, c.title
ORDER BY student_count DESC, c.code;

-- QUERY 4: Students who have no enrolments at all.
SELECT s.id    AS student_id,
       s.name  AS name,
       s.email AS email
FROM students s
LEFT JOIN enrolments e ON e.student_id = s.id
WHERE e.id IS NULL
ORDER BY s.name;

-- QUERY 5: Update one enrolment's grade.
UPDATE enrolments
SET grade = 'B'
WHERE student_id = 2 AND course_id = 1;

-- Check the update took effect.
SELECT s.name AS student, c.code AS course_code, e.grade
FROM enrolments e
JOIN students s ON s.id = e.student_id
JOIN courses c  ON c.id = e.course_id
WHERE e.student_id = 2 AND e.course_id = 1;
