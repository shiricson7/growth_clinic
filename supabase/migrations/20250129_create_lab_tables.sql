create table if not exists public.lab_panels (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  collected_at date not null,
  source_pdf_url text,
  extraction_method text not null,
  raw_text text,
  created_at timestamptz not null default now()
);

create unique index if not exists lab_panels_patient_collected_idx
  on public.lab_panels (patient_id, collected_at);

create table if not exists public.lab_results (
  id uuid primary key default gen_random_uuid(),
  panel_id uuid not null references public.lab_panels(id) on delete cascade,
  test_key text not null,
  value_raw text,
  value_numeric double precision,
  unit text,
  source_line text,
  created_at timestamptz not null default now(),
  unique (panel_id, test_key)
);
