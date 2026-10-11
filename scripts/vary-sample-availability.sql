-- Run as a database administrator. Updates only unclaimed demo1..demo50 workers.
-- No roles, staffing requirements, hour caps, published schedules, or real accounts change.
begin;

create temporary table sample_profiles on commit drop as
select e.id as employee_id, d.dow,
  greatest(0, s.open_hour - 1 + ((substring(e.email from '[0-9]+')::int - 1 + d.dow) % 2)) as start_hour,
  least(24, s.close_hour + ((substring(e.email from '[0-9]+')::int - 1 + d.dow) % 3)) as end_hour
from public.employees e
cross join public.store_settings s
cross join generate_series(0, 6) as d(dow)
where s.id = 1 and e.active and e.user_id is null
  and e.email ~* '^demo([1-9]|[1-4][0-9]|50)@example[.]com$';

update public.default_availability a
set start_hour = p.start_hour, end_hour = p.end_hour
from sample_profiles p
where a.employee_id = p.employee_id and a.dow = p.dow;

insert into public.default_availability (employee_id, dow, start_hour, end_hour)
select p.employee_id, p.dow, p.start_hour, p.end_hour from sample_profiles p
where not exists (
  select 1 from public.default_availability a where a.employee_id = p.employee_id and a.dow = p.dow
);

create temporary table sample_week_profiles on commit drop as
select p.*, w.week_start from sample_profiles p
join public.weekly_submissions w on w.employee_id = p.employee_id
where w.week_start >= date_trunc('week', current_date)::date
  and not exists (
    select 1 from public.schedules s where s.week_start = w.week_start and s.status = 'published'
  );

update public.weekly_availability a
set start_hour = p.start_hour, end_hour = p.end_hour
from sample_week_profiles p
where a.employee_id = p.employee_id and a.dow = p.dow and a.week_start = p.week_start;

insert into public.weekly_availability (employee_id, week_start, dow, start_hour, end_hour)
select p.employee_id, p.week_start, p.dow, p.start_hour, p.end_hour from sample_week_profiles p
where not exists (
  select 1 from public.weekly_availability a
  where a.employee_id = p.employee_id and a.week_start = p.week_start and a.dow = p.dow
);

commit;
-- Regenerate the draft in Shiftboard to use the updated availability.
