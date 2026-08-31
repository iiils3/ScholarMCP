-- ScholarMCP / Neon PostgreSQL / Student OS expansion
-- Versioned migration only. Apply to Neon production after the connected migration workflow is available.

create table if not exists grade_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  target_percent numeric(5,2) not null default 70 check (target_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, course_id)
);

create table if not exists grade_items (
  id uuid primary key default gen_random_uuid(),
  grade_plan_id uuid not null references grade_plans(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  name text not null,
  weight_percent numeric(5,2) not null default 0 check (weight_percent between 0 and 100),
  score_percent numeric(5,2) check (score_percent between 0 and 100),
  due_at timestamptz,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists syllabus_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  course_id uuid references courses(id) on delete cascade,
  material_id uuid references materials(id) on delete set null,
  instructor text,
  term text,
  grading jsonb not null default '[]'::jsonb,
  weeks jsonb not null default '[]'::jsonb,
  rules jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists lecture_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  material_id uuid references materials(id) on delete set null,
  title text not null,
  object_key text,
  duration_seconds integer,
  transcript text,
  segments jsonb not null default '[]'::jsonb,
  language text,
  processing_status text not null default 'pending',
  processing_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists exam_dna (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  source_material_ids uuid[] not null default '{}',
  question_types jsonb not null default '[]'::jsonb,
  repeated_topics jsonb not null default '[]'::jsonb,
  difficulty text,
  style_notes jsonb not null default '[]'::jsonb,
  skills jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  blueprint jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists daily_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  course_id uuid references courses(id) on delete cascade,
  mission_date date not null,
  kind text not null,
  title text not null,
  detail text,
  planned_minutes integer not null default 0 check (planned_minutes >= 0),
  priority integer not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Plans sell capacity, not basic product access. Credit rules are intentionally data-driven.
create table if not exists credit_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references app_users(id) on delete cascade,
  plan_code text not null default 'free',
  monthly_balance bigint not null default 0 check (monthly_balance >= 0),
  topup_balance bigint not null default 0 check (topup_balance >= 0),
  cycle_started_at timestamptz not null default now(),
  cycle_ends_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  wallet_id uuid not null references credit_wallets(id) on delete cascade,
  direction text not null check (direction in ('credit','debit')),
  bucket text not null check (bucket in ('monthly','topup')),
  amount bigint not null check (amount > 0),
  operation text not null,
  job_id text,
  idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists ai_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  course_id uuid references courses(id) on delete cascade,
  material_id uuid references materials(id) on delete set null,
  kind text not null,
  status text not null default 'queued',
  estimated_credits bigint not null default 0,
  charged_credits bigint not null default 0,
  input_hash text,
  cache_key text,
  result_artifact_id uuid references artifacts(id) on delete set null,
  error text,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create table if not exists study_streaks (
  user_id uuid primary key references app_users(id) on delete cascade,
  current_days integer not null default 0,
  best_days integer not null default 0,
  last_active_date date,
  total_study_minutes bigint not null default 0,
  xp bigint not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists idx_grade_items_plan on grade_items(grade_plan_id);
create index if not exists idx_syllabus_course on syllabus_imports(course_id, created_at desc);
create index if not exists idx_lecture_course on lecture_sessions(course_id, created_at desc);
create index if not exists idx_exam_dna_course on exam_dna(course_id, created_at desc);
create index if not exists idx_daily_missions_user_date on daily_missions(user_id, mission_date, completed);
create index if not exists idx_credit_ledger_user_time on credit_ledger(user_id, created_at desc);
create index if not exists idx_ai_jobs_user_status on ai_jobs(user_id, status, queued_at desc);
create index if not exists idx_ai_jobs_cache_key on ai_jobs(cache_key) where cache_key is not null;
