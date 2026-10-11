## Architecture rules
- Scheduling logic lives in pure `src/lib/scheduler.ts` (tested); AI only summarizes/ranks, never decides hard rules — keeps caps unbreakable.
- Weekly availability is written only via the `submit_week_availability` DB function — enforces the window and lock server-side.
- Roles are in `user_roles`; first signup becomes manager, later signups link to invited `employees` rows by email (trigger `handle_new_user`).
- Busy/quiet-time staffing needs are stored as `staffing_rules` rows the scheduler honors; the AI assistant only adds/removes rules and triggers regeneration — hard caps stay in code.

