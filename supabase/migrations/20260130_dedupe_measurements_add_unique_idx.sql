-- De-dupe measurements by (patient_id, measurement_date) before adding unique index.
-- Uses ctid to keep one row per day and merges non-null numeric values.
with ranked as (
  select
    ctid,
    patient_id,
    measurement_date,
    max(height_cm) over (partition by patient_id, measurement_date) as height_cm,
    max(weight_kg) over (partition by patient_id, measurement_date) as weight_kg,
    row_number() over (partition by patient_id, measurement_date order by ctid desc) as rn
  from public.measurements
)
update public.measurements m
set height_cm = r.height_cm,
    weight_kg = r.weight_kg
from ranked r
where m.ctid = r.ctid
  and r.rn = 1;

with ranked as (
  select
    ctid,
    row_number() over (partition by patient_id, measurement_date order by ctid desc) as rn
  from public.measurements
)
delete from public.measurements m
using ranked r
where m.ctid = r.ctid
  and r.rn > 1;

create unique index if not exists measurements_patient_measurement_idx
  on public.measurements (patient_id, measurement_date);
