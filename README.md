# HR SaaS Platform — Project README

A multi-tenant HR management platform: one Node.js/Express backend serving three separate Flutter clients — an **Employee Mobile App**, a **Company Admin Panel**, and a **Platform Owner Dashboard**.

---

## 1. Architecture

**Multi-tenancy model:** shared database, shared schema, `company_id` on every tenant-owned table, enforced by **Postgres Row Level Security (RLS)** — not just application-layer checks. Every request sets `app.current_company_id` (and `app.is_platform_owner` for owner-level requests) as a Postgres session variable before querying, so even a bug in a controller can't leak cross-tenant data.

**Auth:** Supabase Auth issues the initial credential check → backend looks up the matching `users` row → issues its own JWT (access + refresh) with `company_id`, `role`, and a **permissions array** embedded. Every subsequent request is authorized off that JWT, not a fresh DB round-trip.

**RBAC:** Real permission-based access control (`employee.view`, `task.assign`, `payroll.manage`, etc.), not just role-string checks. Roles are `platform_owner`, `company_admin`, `hr_manager`, `employee`. Permissions are seeded and mapped per role in `role_permissions`.

---

## 2. Repository / folder structure

```
hr-saas/
├── database/
│   ├── schema.sql              # Core schema + RLS policies (run first)
│   ├── rbac_seed.sql           # Permissions + role_permissions mapping
│   ├── migration_phase3.sql    # Employee profile fields, assets, services, meetings
│   ├── migration_phase4.sql    # gender, chat tables
│   └── migration_phase6.sql    # attendance breaks/selfies/notes, office geofence
│
├── backend/                    # Node.js / Express API — deployed on Railway
│   └── src/
│       ├── server.js
│       ├── config/db.js        # RLS-aware Postgres query helper
│       ├── middleware/         # auth, tenant scoping, employee context resolution
│       ├── controllers/        # one per module (see §5)
│       ├── routes/
│       └── utils/              # notify.js, logActivity.js
│
├── apps/
│   ├── admin_panel/            # Flutter Web — Company Admin
│   ├── mobile_app/             # Flutter Android/iOS — Employee
│   └── owner_dashboard/        # Flutter Web — Platform Owner
```

Each Flutter app follows the same internal pattern:
```
lib/
├── main.dart
├── app/
│   ├── app_router.dart         # GoRouter, one entry per destination
│   └── (shell widget)          # NavigationRail (web) or BottomNav (mobile)
├── core/
│   ├── api_client.dart         # Dio instance, points at the backend URL
│   ├── theme/
│   │   ├── app_colors.dart
│   │   └── app_theme.dart
│   └── widgets/shared_widgets.dart  # LoadingView, ErrorView, EmptyView, StatusChip...
└── features/
    └── <feature_name>/
        ├── <feature>_provider.dart  # Riverpod StateNotifier + API calls
        └── <feature>_screen.dart
```

---

## 3. Tech stack

| Layer | Choice |
|---|---|
| Mobile/Web UI | Flutter, Riverpod, GoRouter, Dio, Material 3 |
| Backend | Node.js, Express |
| Database | Supabase Postgres, accessed via the **connection pooler** (not the direct-connect host — see §8) |
| Auth | Supabase Auth + custom JWT (access 15m / refresh 30d) |
| File storage | Supabase Storage (`avatars`, `receipts`, `selfies` buckets) |
| PDF export | `pdf` + `printing` packages (client-side, no backend involvement) |
| Geolocation | `geolocator` |
| Hosting | Railway (backend) |

---

## 4. Environment variables (`backend/.env`)

```
PORT=                                  # do NOT set manually on Railway — it injects its own
NODE_ENV=production

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=             # server-side only, full DB access — treat as a secret

# Use the POOLER connection string, not the direct one — see §8
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres

JWT_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
```

Each Flutter app's `lib/core/api_client.dart` has `baseUrl` hardcoded to the deployed backend URL — update all three if the backend URL ever changes.

---

## 5. Backend modules (all under `/api`)

| Module | Base path | Notes |
|---|---|---|
| Auth | `/auth` | login, refresh |
| Employees | `/employees`, `/employees/directory`, `/employees/me` | Full CRUD (admin) + self-service profile + lightweight company directory (any employee) |
| Departments / Branches | `/departments`, `/branches` | |
| Tasks | `/tasks`, `/tasks/:id/comments` | Assign, edit, delete, status, completion-report comments |
| Attendance | `/attendance/*` | Check-in/out, breaks, selfie + geofence, `/summary` for the dashboard card, `/office-location` |
| Leave | `/leave`, `/leave/types` | Self-scoped unless `leave.approve` held |
| Payroll | `/payroll` | Self-scoped unless `payroll.manage` held; includes computed `total_hours` from attendance |
| Assets | `/assets` | `?mine=true` for self-scoped "my assigned assets" |
| Services | `/services` | Company service catalog |
| Expenses | `/expenses`, `/expenses/categories` | Receipt upload (base64), self-scoped list |
| Meetings | `/meetings` | Google Meet link + department/employee-level sharing |
| Chat | `/chat/conversations`, `/chat/conversations/:id/messages` | 1:1 dedup, polling-based (no websockets) |
| Notifications | `/notifications` | List, mark read, mark all read — written by `notify()` from other actions |
| Dashboard | `/dashboard/overview` | Company-level stats + activity feed |
| Company Settings | `/company-settings` | Office geofence lat/lng/radius |
| **Platform Owner only** | `/platform/companies`, `/platform/dashboard/overview` | Create company + first admin together, suspend/activate/delete, platform-wide stats |

**Self-scoping pattern used throughout:** a plain `employee` role often lacks the "view all" permission (e.g. `employee.view`, `reports.view`). Rather than blocking them, list endpoints check for that permission and silently force-scope the query to `req.auth.employeeId` if it's absent — so self-service screens (My Tasks, My Leave, My Expenses, My Payroll) work without over-granting permissions.

---

## 6. Setup — from zero

### 6.1 Supabase
1. Create a project.
2. SQL Editor → run `schema.sql`, then `rbac_seed.sql`, then each `migration_phase*.sql` in order.
3. Create Storage buckets: `avatars`, `receipts`, `selfies` (all public) — or run the `insert into storage.buckets...` statements embedded in the migration files.
4. Note your **pooler** connection string (Project Settings → Database → Connection Pooling) — required, see §8.

### 6.2 Backend
```bash
cd backend
cp .env.example .env   # fill in real values
npm install
npm start
```

### 6.3 Platform owner account (you)
Supabase → Authentication → create yourself a user → in SQL Editor:
```sql
insert into users (id, company_id, role_id, email, full_name, status)
select '<your-auth-user-uuid>', null, r.id, 'you@example.com', 'Your Name', 'active'
from roles r where r.name = 'platform_owner';
```

### 6.4 Each Flutter app
```bash
cd apps/<app_name>
flutter pub get
flutter run            # or -d chrome for the two web apps
```

---

## 7. Deployment

**Backend → Railway.** Connect the GitHub repo, leave Root Directory blank, Build Command `npm install`, Start Command `npm start`, add all env vars from §4. **Do not set `PORT`** manually.

**Flutter web apps (admin_panel, owner_dashboard)** → any static host after `flutter build web`, or Vercel.

**Mobile app** → build + submit via Play Console / App Store Connect per platform.

---

## 8. Known issues & permanent fixes already applied (read before debugging blind)

- **Direct Supabase DB connection fails with `ENOTFOUND`/`ENETUNREACH`** on some networks (including Railway's) — the direct-connect host is IPv6-only. **Always use the pooler connection string** (port `6543`, host `aws-0-<region>.pooler.supabase.com`), never `db.<ref>.supabase.co:5432`.
- **`express-rate-limit` throws `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`** behind Railway's proxy — fixed by `app.set('trust proxy', 1)` right after `const app = express()`.
- **macOS is case-insensitive, Linux (Railway) isn't** — a locally-working `require('./middleware/employeeContext.middleware')` can 404/crash in production if the actual filename's case doesn't match exactly. If you ever rename a file, use `git mv`, then verify with `git ls-tree -r HEAD --name-only`.
- **Railway occasionally serves a stale build** despite a clean `git status` and successful-looking deploy logs — if a fresh push doesn't change behavior, add a temporary unique marker to `/health`'s response and check for it before trusting any other diagnosis. If stuck, deleting and recreating the Railway service (not just the domain) has reliably fixed this.
- **`GET /employees` requires `employee.view`**, which a plain `employee` doesn't have — this is why several endpoints (tasks, leave, payroll, expenses, attendance) implement the self-scoping fallback described in §5, and why `/employees/directory` exists as a permission-free alternative for "pick a coworker" UI (chat, etc).

---

## 9. Known simplifications (not bugs — deliberate scope cuts)

- **No real map tiles** on the Clock-In Area screen — geofence math (`geolocator` distance calculation) is real and functional; the background is a decorative grid, not live Google Maps (would need an API key + billing you'd provide).
- **Payroll breakdown fields** (Tax, Reimbursement, Bonus, Overtime) shown on the payslip are partly **derived/defaulted** — the `payroll` table only stores `gross_pay`/`net_pay`. Tax is inferred as the gap between them; Reimbursement/Bonus default to $0 until those become real tracked columns.
- **Employee schedule times** (09:00–05:00 shown on Clock-In Area) are a hardcoded placeholder — no per-employee schedule model exists yet.
- **Country/State/City fields** on Personal Data are plain text inputs styled like dropdowns, not real cascading location-data pickers.
- **Office asset "photo"** shows a generic icon by type, not a real per-asset product photo — no photo storage field on `assets` yet.
- Illustrated mascot/character artwork from mockups (rainbow credit card, winged clock, etc.) is approximated with icons — custom illustration assets weren't available to generate here.

---

## 10. What's built vs. what's still open

**Built:** auth, RBAC, multi-tenancy, employees (incl. gender/avatar/education), departments, branches, tasks (assign/edit/delete/comments), attendance (clock in/out, breaks, selfie, geofence), leave, payroll (view + admin create), assets, services, expenses (with receipts, categories, mockup-matched UI), meetings, chat (1:1, polling), notifications, admin dashboard, company settings (geofence config), platform owner (company create/suspend/activate/delete, platform stats).

**Not yet built:** subscription/plan management UI, feature flags, platform-wide analytics beyond 4 stat cards, support ticket handling, audit log viewer, real-time chat (currently polling every 4s), structured location pickers, per-employee work schedules, payroll line-item tracking (bonus/reimbursement as real fields), real map integration.

---

## 11. Test accounts pattern

Every employee is created with a **one-time-shown password** returned directly in the `POST /employees` response (`loginCredentials`) — there is no email-invite flow currently; credentials must be communicated to the employee out-of-band by whoever created the account.