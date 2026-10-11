
create type public.app_role as enum ('manager','employee');
create type public.emp_type as enum ('full_time','part_time');
create type public.request_status as enum ('pending','approved','denied');
create type public.emergency_status as enum ('open','resolved','cancelled');
create type public.schedule_status as enum ('draft','published');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'manager'));

create table public.store_settings (
  id int primary key default 1 check (id = 1),
  store_name text not null default 'My Store',
  open_hour int not null default 9 check (open_hour between 0 and 23),
  close_hour int not null default 21 check (close_hour between 1 and 24),
  setup_complete boolean not null default false,
  updated_at timestamptz not null default now(),
  check (close_hour > open_hour)
);
grant select, insert, update on public.store_settings to authenticated;
grant all on public.store_settings to service_role;
alter table public.store_settings enable row level security;
create policy "read settings" on public.store_settings for select to authenticated using (true);
create policy "manager write settings" on public.store_settings for all to authenticated using (public.has_role(auth.uid(),'manager')) with check (public.has_role(auth.uid(),'manager'));
insert into public.store_settings (id) values (1);

create table public.job_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  min_staff int not null default 1 check (min_staff >= 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.job_roles to authenticated;
grant all on public.job_roles to service_role;
alter table public.job_roles enable row level security;
create policy "read roles" on public.job_roles for select to authenticated using (true);
create policy "manager write roles" on public.job_roles for all to authenticated using (public.has_role(auth.uid(),'manager')) with check (public.has_role(auth.uid(),'manager'));

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  full_name text not null,
  email text not null unique,
  emp_type public.emp_type not null default 'part_time',
  job_role_id uuid references public.job_roles(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.employees to authenticated;
grant all on public.employees to service_role;
alter table public.employees enable row level security;
create policy "manager all employees" on public.employees for all to authenticated using (public.has_role(auth.uid(),'manager')) with check (public.has_role(auth.uid(),'manager'));
create policy "employee read self" on public.employees for select to authenticated using (user_id = auth.uid());

create or replace function public.my_employee_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.employees where user_id = auth.uid() and active limit 1
$$;

create table public.default_availability (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  dow int not null check (dow between 0 and 6),
  start_hour int not null check (start_hour between 0 and 23),
  end_hour int not null check (end_hour between 1 and 24),
  check (end_hour > start_hour)
);
create index on public.default_availability(employee_id);
grant select, insert, update, delete on public.default_availability to authenticated;
grant all on public.default_availability to service_role;
alter table public.default_availability enable row level security;
create policy "manager all default" on public.default_availability for all to authenticated using (public.has_role(auth.uid(),'manager')) with check (public.has_role(auth.uid(),'manager'));
create policy "employee own default" on public.default_availability for all to authenticated using (employee_id = public.my_employee_id()) with check (employee_id = public.my_employee_id());

create table public.weekly_submissions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  week_start date not null,
  submitted_at timestamptz not null default now(),
  unique (employee_id, week_start)
);
grant select on public.weekly_submissions to authenticated;
grant all on public.weekly_submissions to service_role;
alter table public.weekly_submissions enable row level security;
create policy "read submissions" on public.weekly_submissions for select to authenticated using (employee_id = public.my_employee_id() or public.has_role(auth.uid(),'manager'));

create table public.weekly_availability (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  week_start date not null,
  dow int not null check (dow between 0 and 6),
  start_hour int not null check (start_hour between 0 and 23),
  end_hour int not null check (end_hour between 1 and 24),
  check (end_hour > start_hour)
);
create index on public.weekly_availability(week_start);
grant select on public.weekly_availability to authenticated;
grant all on public.weekly_availability to service_role;
alter table public.weekly_availability enable row level security;
create policy "read weekly" on public.weekly_availability for select to authenticated using (employee_id = public.my_employee_id() or public.has_role(auth.uid(),'manager'));

-- Atomic, one-time submission inside the window [week_start-14, week_start-7]
create or replace function public.submit_week_availability(_week_start date, _slots jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare _emp uuid := public.my_employee_id(); _today date := (now() at time zone 'America/Chicago')::date; s jsonb;
begin
  if _emp is null then raise exception 'Not an active employee'; end if;
  if extract(isodow from _week_start) <> 1 then raise exception 'Week must start on a Monday'; end if;
  if _today < _week_start - 14 then raise exception 'Submissions for this week are not open yet'; end if;
  if _today > _week_start - 7 then raise exception 'The deadline for this week has passed'; end if;
  if exists (select 1 from public.weekly_submissions where employee_id = _emp and week_start = _week_start) then
    raise exception 'You already submitted availability for this week'; end if;
  for s in select * from jsonb_array_elements(coalesce(_slots,'[]'::jsonb)) loop
    insert into public.weekly_availability(employee_id, week_start, dow, start_hour, end_hour)
    values (_emp, _week_start, (s->>'dow')::int, (s->>'start_hour')::int, (s->>'end_hour')::int);
  end loop;
  insert into public.weekly_submissions(employee_id, week_start) values (_emp, _week_start);
end $$;
grant execute on function public.submit_week_availability(date, jsonb) to authenticated;

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  status public.schedule_status not null default 'draft',
  ai_summary text,
  gaps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
grant select, insert, update, delete on public.schedules to authenticated;
grant all on public.schedules to service_role;
alter table public.schedules enable row level security;
create policy "manager all schedules" on public.schedules for all to authenticated using (public.has_role(auth.uid(),'manager')) with check (public.has_role(auth.uid(),'manager'));
create policy "employee read published" on public.schedules for select to authenticated using (status = 'published');

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  job_role_id uuid references public.job_roles(id) on delete set null,
  shift_date date not null,
  start_hour int not null check (start_hour between 0 and 23),
  end_hour int not null check (end_hour between 1 and 24),
  check (end_hour > start_hour)
);
create index on public.shifts(schedule_id);
create index on public.shifts(employee_id, shift_date);
grant select, insert, update, delete on public.shifts to authenticated;
grant all on public.shifts to service_role;
alter table public.shifts enable row level security;
create policy "manager all shifts" on public.shifts for all to authenticated using (public.has_role(auth.uid(),'manager')) with check (public.has_role(auth.uid(),'manager'));
create policy "employee read own published shifts" on public.shifts for select to authenticated using (
  employee_id = public.my_employee_id() and exists (select 1 from public.schedules s where s.id = schedule_id and s.status = 'published'));

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text not null default '',
  status public.request_status not null default 'pending',
  manager_note text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
grant select, insert, update, delete on public.leave_requests to authenticated;
grant all on public.leave_requests to service_role;
alter table public.leave_requests enable row level security;
create policy "manager all leave" on public.leave_requests for all to authenticated using (public.has_role(auth.uid(),'manager')) with check (public.has_role(auth.uid(),'manager'));
create policy "employee read own leave" on public.leave_requests for select to authenticated using (employee_id = public.my_employee_id());
create policy "employee create own leave" on public.leave_requests for insert to authenticated with check (employee_id = public.my_employee_id() and status = 'pending');

create table public.emergencies (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  reason text not null default '',
  status public.emergency_status not null default 'open',
  suggestions jsonb,
  replacement_employee_id uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.emergencies to authenticated;
grant all on public.emergencies to service_role;
alter table public.emergencies enable row level security;
create policy "manager all emergencies" on public.emergencies for all to authenticated using (public.has_role(auth.uid(),'manager')) with check (public.has_role(auth.uid(),'manager'));
create policy "employee read own emergencies" on public.emergencies for select to authenticated using (employee_id = public.my_employee_id());
create policy "employee create own emergency" on public.emergencies for insert to authenticated with check (
  employee_id = public.my_employee_id() and status = 'open'
  and exists (select 1 from public.shifts sh where sh.id = shift_id and sh.employee_id = public.my_employee_id()));

-- New accounts: first account becomes manager; otherwise must match an invited employee email.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role = 'manager') then
    insert into public.user_roles(user_id, role) values (new.id, 'manager');
  elsif exists (select 1 from public.employees where lower(email) = lower(new.email) and user_id is null) then
    update public.employees set user_id = new.id where lower(email) = lower(new.email) and user_id is null;
    insert into public.user_roles(user_id, role) values (new.id, 'employee');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Demo data
insert into public.job_roles (name, min_staff, sort_order) values ('Manager',2,1),('Cashier',5,2),('Stocker',10,3);

insert into public.employees (full_name, email, emp_type, job_role_id)
select
  (array['Ava','Liam','Mia','Noah','Sofia','Mateo','Emma','Diego','Isla','Lucas','Zoe','Ethan','Lena','Omar','Ruby','Jonah','Maya','Caleb','Nora','Elias','Ivy','Owen','Leah','Samuel','Aria'])[((g-1) % 25)+1]
  || ' ' ||
  (array['Garcia','Nguyen','Smith','Patel','Lopez','Kim','Brown','Rivera','Johnson','Chen'])[((g-1) % 10)+1],
  'demo' || g || '@example.com',
  (case
    when g <= 6 then (case when g <= 5 then 'full_time' else 'part_time' end)
    when g <= 22 then (case when g <= 12 then 'full_time' else 'part_time' end)
    else (case when g <= 32 then 'full_time' else 'part_time' end)
  end)::public.emp_type,
  (select id from public.job_roles where name = (case when g <= 6 then 'Manager' when g <= 22 then 'Cashier' else 'Stocker' end))
from generate_series(1,50) g;

-- Varied default availability: full-timers broad, part-timers patterned.
insert into public.default_availability (employee_id, dow, start_hour, end_hour)
select e.id, d.dow,
  case when e.emp_type = 'full_time' then (case when (e.rn + d.dow) % 2 = 0 then 8 else 12 end)
       else (array[8,12,15,9,13])[((e.rn + d.dow) % 5)+1] end,
  case when e.emp_type = 'full_time' then (case when (e.rn + d.dow) % 2 = 0 then 18 else 22 end)
       else least(24, (array[8,12,15,9,13])[((e.rn + d.dow) % 5)+1] + 8) end
from (select id, emp_type, row_number() over (order by email) as rn from public.employees) e
cross join generate_series(0,6) as d(dow)
where (e.emp_type = 'full_time' and (e.rn + d.dow) % 7 <> 0)
   or (e.emp_type = 'part_time' and (e.rn + d.dow) % 3 <> 0);
