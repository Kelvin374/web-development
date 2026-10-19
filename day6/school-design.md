# School Database - Design Notes

The schema in `school.sql` models a small school: students sign up for courses, and each
sign-up is recorded with a grade. There are three entities:

- a **student** - a person on the register
- a **course** - something the school teaches
- an **enrolment** - the *fact* that one student is taking one course, plus the grade

Run it in the [SQLite playground](https://sqliteonline.com) by pasting the whole file into the
"Execute SQL" box. The `DROP TABLE IF EXISTS` lines at the top mean it can be run again
without errors.

## The tables

### `students`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | `PRIMARY KEY AUTOINCREMENT` - the student's unique id |
| `name` | TEXT | `NOT NULL` - every student must have a name |
| `email` | TEXT | `NOT NULL UNIQUE` - the school's contact address, and the natural way to identify a student |
| `date_registered` | TEXT | `NOT NULL DEFAULT CURRENT_DATE` - when the student joined the school |

The email is `UNIQUE` so two people can never share one address, which stops the same person
being registered twice under the same email. The primary key is the surrogate key `id` because
email addresses change and a foreign key should not depend on a value the user is allowed to edit.

### `courses`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | `PRIMARY KEY AUTOINCREMENT` |
| `code` | TEXT | `NOT NULL UNIQUE` - the short course code, e.g. `CS101` |
| `title` | TEXT | `NOT NULL` - the full course name |
| `description` | TEXT | nullable - long text, so it is allowed to be empty |
| `credits` | INTEGER | `NOT NULL DEFAULT 3 CHECK (credits > 0)` - a course must be worth at least one credit |

`code` is `UNIQUE` because the school code is how staff and students refer to a course, and two
courses sharing a code would be ambiguous.

### `enrolments`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | `PRIMARY KEY AUTOINCREMENT` |
| `student_id` | INTEGER | `NOT NULL`, `FOREIGN KEY` -> `students(id)` |
| `course_id` | INTEGER | `NOT NULL`, `FOREIGN KEY` -> `courses(id)` |
| `grade` | TEXT | `CHECK (grade IS NULL OR grade IN ('A','B','C','D','F'))` |
| `enrolled_on` | TEXT | `NOT NULL DEFAULT CURRENT_DATE` |

This is the join table. It has two foreign keys and one piece of data of its own: the grade.

- The `student_id` foreign key means an enrolment can only point at a student that exists, and
  `ON DELETE CASCADE` removes a student's enrolments if the student is deleted.
- The `course_id` foreign key does the same for courses, so a course cannot be deleted while
  students are still on it (the enrolments go with it).
- `UNIQUE (student_id, course_id)` is the rule that **prevents the same student enrolling on the
  same course twice**. The pair of columns is unique across the table, so a second attempt to
  insert it fails with a `UNIQUE constraint failed` error.
- `grade` is deliberately **nullable**: a student signs up weeks before the course finishes, so
  the enrolment exists before there is anything to grade. The `CHECK` constraint then guarantees
  that whenever a grade *is* set it is one of `A`-`F` - the database rejects typos like `'Z'`.

## Relationships

**One-to-many: `students` -> `enrolments`.** One student has many enrolments (one per course
they take); each enrolment belongs to exactly one student. The `student_id` foreign key in
`enrolments` is the "many" side, and there can be many rows in `enrolments` sharing the same
`student_id`. The same relationship exists between `courses` and `enrolments` via `course_id`:
one course has many enrolments, one for each student on it.

**Many-to-many: `students` <-> `courses`.** A student takes many courses, and a course is taken
by many students. This is the interesting one, and it is exactly what the third table is for.

A join table (also called an associative or junction table) is needed because the relationship
between students and courses carries data of its own - the grade - and a relational table cannot
store one column per *relationship*, only one column per *entity*. There is no column on
`students` that can hold "the grade for Amina on CS201" and no column on `courses` that can hold
"the grade for Daniel on CS101", because the same attribute depends on both sides at once.

The alternatives do not work:

- **A comma-separated list** (`courses = 'CS101,CS201'`) cannot be indexed, cannot be searched
  with a `WHERE` clause, cannot have a foreign key on each value, and cannot store a grade per
  course.
- **Duplicating data** (one row in `students` per course) repeats the student's name and email
  for every course, so an edit to the student means updating many rows, and it breaks the
  one-to-many relationship with anything else that refers to a student.
- **A separate `grades` table** would only move the problem: it would still need a row per
  student/course pair, which is what `enrolments` already is.

`enrolments` solves all of this: one row per student/course pair, the grade attached to that
pair, and the `UNIQUE` constraint making the pair itself the identity of the row.

## Indexes

I would add an index on `enrolments(course_id)`:

```sql
CREATE INDEX idx_enrolments_course_id ON enrolments (course_id);
```

**Reason:** the `UNIQUE (student_id, course_id)` constraint already creates an index, but its
leading column is `student_id`, so it is only useful for "enrolments for this student" (query 1).
It cannot be used to find enrolments *by course*, because `student_id` is not constant across
those rows. Queries 2 ("all students on one course") and 3 ("number of students per course")
both filter and group on `course_id`. With this index SQLite can seek straight to the handful of
rows for the requested course instead of scanning the whole `enrolments` table, and it can
produce the grouped counts without a temporary sort. The table is small today, but enrolment
tables are exactly the ones that grow to millions of rows, and the index costs almost nothing to
maintain.

`students.email` and `courses.code` are already indexed by their `UNIQUE` constraints, so
lookups by email or course code are fast without adding anything extra.

## SQL or NoSQL?

I would use a **relational database (SQL)** for this system. The data is at its core a graph of
relationships - students, courses, and the links between them - and the questions the school
actually asks ("which courses is Amina on?", "how many students are on CS201?", "who has not
signed up for anything yet?") need to join across all three tables and aggregate the results,
which is exactly what `JOIN` and `GROUP BY` are for. Relational databases also enforce
referential integrity and rules such as "one enrolment per student per course" *in the
database itself*, so a bug in application code cannot leave a course pointing at a student who
does not exist or create a duplicate enrolment - with a document store such as MongoDB, those
guarantees have to be written by hand in the application layer and are only as reliable as every
code path that touches the data. A NoSQL store would earn its place at the edges of the system
(for example caching the "students per course" counts that query 3 recalculates, or storing
per-course grade analytics that are write-heavy and read-rarely), but the source of truth for
students, courses and enrolments belongs in a relational database, where the join table gives
us the many-to-many relationship and the grade handling in one place.

## Queries in `school.sql`

1. All courses for one student, by name - `students` -> `enrolments` -> `courses` (inner `JOIN`).
2. All students on one course - `courses` -> `enrolments` -> `students` (inner `JOIN`).
3. Number of students per course - `courses` `LEFT JOIN` `enrolments` with `GROUP BY`, so
   courses nobody has signed up for show `0` instead of disappearing.
4. Students with no enrolments - `students` `LEFT JOIN` `enrolments` filtered with
   `WHERE e.id IS NULL`, which keeps only the rows that found no match.
5. Update one enrolment's grade - `UPDATE enrolments SET grade = 'B' WHERE student_id = 2 AND
   course_id = 1`, changing Daniel Okoye's grade on CS101 from `C` to `B`.
