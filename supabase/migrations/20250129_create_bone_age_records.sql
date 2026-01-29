create table if not exists public.bone_age_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  measured_at date not null,
  bone_age text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists bone_age_records_patient_measured_idx
  on public.bone_age_records (patient_id, measured_at);
