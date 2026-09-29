-- Apply after 0001 and 0002. Credits are provisioned separately after a measured pilot.
alter table ai_jobs add column if not exists idempotency_key text;
alter table ai_jobs add column if not exists provider_name text;
alter table ai_jobs add column if not exists model_code text;
alter table ai_jobs add column if not exists input_tokens integer;
alter table ai_jobs add column if not exists output_tokens integer;
alter table ai_jobs add column if not exists source_consent_at timestamptz;
create unique index if not exists idx_ai_jobs_user_idempotency
  on ai_jobs(user_id, idempotency_key) where idempotency_key is not null;

create index if not exists idx_materials_user_course
  on materials(user_id, course_id, id);
