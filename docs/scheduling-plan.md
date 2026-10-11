# Shift Scheduler for a Single Store

An app where employees submit the times they're free, and AI builds the weekly schedule so every role is always covered. It respects hour limits and gives full-timers priority.

## Who uses it

**Manager** (email + password)
- First-time setup: store name, open and close times (changeable later in Settings), and minimum staff per role. Defaults: 2 Managers, 5 Cashiers, 10 Stockers. Roles can be added or renamed.
- Employees: invite by email, set role(s), full-time (40h max) or part-time (25h max), edit details, deactivate or remove access.
- Schedule: generate a week with AI, view it as a calendar grid by day and role, drag or edit shifts by hand, then publish it to employees.
- Coverage warnings: highlights any hour where a role is under minimum, and shows who could fill the gap.
- Leave requests: approve or deny, with an optional note.
- Emergencies: see call-outs and the AI's suggested replacements, then confirm with one click.
- Dashboard: today's staff on shift, open gaps, pending requests, who hasn't submitted availability yet, and hours per employee this week.

**Employee** (invited by email, sets their own password)
- Default availability: a weekly pattern set at onboarding, editable in Settings.
- Weekly availability: free times for an upcoming week. It opens 2 weeks before that week, closes 1 week before, and locks once submitted.
- If an employee submits nothing, their default availability is used.
- My Schedule: published shifts and weekly hour total.
- Request leave: pick dates, add a reason, see if it's pending, approved or denied.
- Emergency button on an upcoming shift: "Emergency came up." The manager is alerted and the AI suggests replacements.

## Scheduling rules
- Weeks run Monday to Sunday.
- Shifts are 4 to 8 hours, at most one shift per person per day, and only within each person's free time.
- Every role's minimum must be met during all open hours.
- Weekly caps: full-time 40h, part-time 25h. Full-timers are filled first.
- Approved leave removes a person's availability for those dates.
- Emergency replacements must be free at that time, not already working, and under their hour cap. Full-timers are preferred.

## How the AI works
A built-in rules engine builds a schedule that follows every rule above. AI (Lovable AI) then reviews the result to balance hours fairly, explain any gaps it couldn't fill in plain language, and rank emergency replacements. That way hard rules like hour caps can never break.

## Demo data
The app comes with 50 sample employees (mixed full- and part-time, with varied availability) so a schedule can be generated right away.

## Technical details
- Lovable Cloud with email/password login. Roles live in a separate `user_roles` table (manager or employee), checked by a `has_role` function in access rules.
- Tables: store_settings, job_roles (with min_staff), employees (type, job roles, active), default_availability, weekly_availability (week_start, submitted_at, locked), schedules (week, status), shifts, leave_requests, emergencies.
- Submission window is enforced on the server and in database access rules: submissions are allowed from week_start minus 14 days until week_start minus 7 days, and no updates after submission. Unit tests cover the window, the hour caps, full-timer priority and the 4–8h shift length.
- Invites go through a manager-only server function that uses an admin invite. The scheduler is a server function: a greedy hour-slot fill (full-timers first, longest free blocks), then shifts are merged to 4–8h and checked. AI Gateway handles summaries and replacement ranking.
- Routes: /auth, /setup, and a signed-in area: /dashboard, /schedule, /employees, /requests, /settings (manager); /my-schedule, /availability, /leave, /settings (employee).
- Visual direction: clean, utilitarian "operations board" look with a warm neutral background, deep green as the main color, and a compact readable font pairing.
