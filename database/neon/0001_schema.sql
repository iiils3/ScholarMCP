-- ScholarMCP / Neon PostgreSQL / baseline schema
-- Auth is deliberately externalized. `user_id` stores the stable subject from the auth layer.
create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  auth_subject text unique not null,
  email text,
  display_name text,
  major text,
  study_language text not null default 'ar',
  ui_language text not null default 'ar',
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  name text not null,
  exam_date timestamptz,
  color text,
  icon text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  name text not null,
  mime_type text,
  extension text,
  size_bytes bigint not null default 0,
  page_count integer not null default 0,
  object_key text,
  parse_status text not null default 'pending',
  parse_error text,
  extracted_text text,
  extracted_chars integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists material_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  material_id uuid not null references materials(id) on delete cascade,
  page_number integer,
  chunk_index integer not null,
  content text not null,
  created_at timestamptz not null default now(),
  unique(material_id, chunk_index)
);

create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  definition text,
  source_ref text,
  mastery integer not null default 0 check (mastery between 0 and 100),
  attempts integer not null default 0,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  confidence double precision not null default 0,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(course_id, title)
);

create table if not exists mastery_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  topic_id uuid references topics(id) on delete set null,
  kind text not null,
  correct boolean,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  material_id uuid references materials(id) on delete set null,
  topic_label text,
  front text not null,
  back text not null,
  source_ref text,
  truth_status text not null default 'supported',
  interval_days integer not null default 0,
  due_at timestamptz not null default now(),
  interactions integer not null default 0,
  lapses integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists flashcard_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  flashcard_id uuid not null references flashcards(id) on delete cascade,
  rating text not null,
  previous_interval_days integer not null default 0,
  next_interval_days integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  material_id uuid references materials(id) on delete set null,
  title text not null,
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  quiz_id uuid references quizzes(id) on delete set null,
  course_id uuid not null references courses(id) on delete cascade,
  score integer not null default 0,
  total integer not null default 0,
  answers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  instructions text not null,
  rubric text,
  due_at timestamptz,
  checklist jsonb not null default '[]'::jsonb,
  outline text,
  draft text,
  assessment jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  material_id uuid references materials(id) on delete set null,
  type text not null,
  title text not null,
  truth_status text not null default 'supported',
  estimated_coverage integer,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists deadlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  course_id uuid references courses(id) on delete cascade,
  title text not null,
  kind text not null,
  due_at timestamptz not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  title text not null default 'محادثة المادة',
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null,
  content text not null,
  truth_status text,
  citations jsonb not null default '[]'::jsonb,
  mode text,
  created_at timestamptz not null default now()
);

create table if not exists study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  mode text not null,
  steps jsonb not null default '[]'::jsonb,
  score integer,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists glossary_terms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  term text not null,
  translation text not null,
  created_at timestamptz not null default now(),
  unique(course_id, term)
);

create index if not exists idx_courses_user on courses(user_id);
create index if not exists idx_materials_course on materials(course_id);
create index if not exists idx_material_chunks_material on material_chunks(material_id, chunk_index);
create index if not exists idx_topics_course_mastery on topics(course_id, mastery);
create index if not exists idx_mastery_events_course on mastery_events(course_id, created_at desc);
create index if not exists idx_flashcards_due on flashcards(user_id, due_at);
create index if not exists idx_deadlines_due on deadlines(user_id, due_at);
create index if not exists idx_artifacts_course on artifacts(course_id, created_at desc);
