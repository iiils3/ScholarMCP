-- Apply after 0001 and 0002. Credits are provisioned separately after a measured pilot.
alter table ai_jobs add column if not exists idempotency_key text;
create unique index if not exists idx_ai_jobs_user_idempotency
  on ai_jobs(user_id, idempotency_key) where idempotency_key is not null;

create index if not exists idx_materials_user_course
  on materials(user_id, course_id, id);
