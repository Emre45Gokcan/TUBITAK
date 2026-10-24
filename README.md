# Sınıf Platformu

A Next.js + PostgreSQL app where **teachers create classes** and **students join them with a code**. Three roles: admin, teacher and student. The UI is in Turkish; code is in English.

| | |
|---|---|
| Framework | Next.js 16 (App Router, Cache Components, Server Actions) |
| Database | PostgreSQL. Neon on Vercel; a local embedded Postgres in development |
| ORM | Drizzle ORM + drizzle-kit migrations (`drizzle/`) |
| Auth | Better Auth: email + password, email verification, password reset |
| Email | Resend. In development, without an API key, emails are printed to the terminal |
| UI | Tailwind CSS 4 + shadcn/ui (Base UI) |

## How accounts work

- **Students** sign up, verify their email and can join classes immediately.
- **Teachers** sign up the same way, but their account is `pending` until an admin approves it on `/admin`. Until then they see `/beklemede`. The teacher gets an email when approved or rejected.
- **Admins** are created with the seed script (`npm run db:seed`). An admin can approve or reject teachers, change roles, and suspend or reactivate users. Suspending signs the user out everywhere and blocks sign-in. Admins can't change their own role or status.
- **Classes** get a 7-character join code (no look-alike characters I/L/O/0/1). Teachers can regenerate the code, close a class to new joins, archive it and remove students. Students join with the code and can leave.

After sign-in, `/panel` sends each user to their home: `/admin`, `/ogretmen`, `/ogrenci` or `/beklemede`.

### Security model

- `role` and `status` live on the Better Auth `user` table as `input: false` fields, so no client request can set them. The sign-up Server Action passes the chosen account type to Better Auth's `user.create.before` hook through `AsyncLocalStorage` (`src/lib/account-intent.ts`). Registering an existing email never changes that account.
- `src/proxy.ts` only does an optimistic cookie check. The real checks are in `src/server/session.ts` (`requireUser`, `requireRole`). Every page, query (`src/server/queries/*`) and Server Action (`src/server/actions/*`) calls them itself.
- Ownership is part of the SQL `WHERE` clause. A teacher can only read or change their own classes (`manageableBy` in `src/server/queries/classrooms.ts`); other ids return 404.
- Server Actions are rate-limited in Postgres (`src/server/rate-limit.ts`). This covers sign-in, sign-up, password reset, change password and join-code attempts. Better Auth's own limiter only covers direct `/api/auth/*` requests.
- Role and status are read from the database on every request (no session cookie cache), so admin changes apply immediately.

## Local development

Requirements: Node.js 24+ (for example via [nvm](https://github.com/nvm-sh/nvm): `nvm install 24`). Docker is not needed.

```bash
npm install
cp .env.example .env.local        # then fill in BETTER_AUTH_SECRET and ADMIN_PASSWORD
openssl rand -base64 32           # use the output as BETTER_AUTH_SECRET

npm run db:local                  # terminal 1: Postgres on localhost:5433 (data in .data/)
npm run db:migrate                # terminal 2: create the tables
npm run db:seed -- --demo         # admin from .env.local + demo data
npm run dev                       # http://localhost:3000
```

Demo accounts (password `demo-sifre-123`):

| Email | Role |
|---|---|
| `ayse@example.com` | teacher (approved, owns 2 classes) |
| `mehmet@example.com` | teacher (pending approval) |
| `ali@example.com` | student (enrolled in "9-A Matematik") |
| `zeynep@example.com` | student |

The admin is `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env.local`.

With `RESEND_API_KEY` empty, verification and password-reset emails are printed in the `npm run dev` terminal. Open the link from there.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` / `test` | ESLint / route types + `tsc` / Vitest |
| `npm run db:local` | Local Postgres (embedded-postgres) |
| `npm run db:generate` | Create a migration from schema changes in `src/db/schema/` |
| `npm run db:migrate` | Apply migrations (uses `DATABASE_URL_UNPOOLED`, falling back to `DATABASE_URL`) |
| `npm run db:studio` | Drizzle Studio |
| `npm run db:seed [-- --demo]` | Create the first admin (idempotent), optionally with demo data |

Changing the schema: edit `src/db/schema/*.ts`, run `npm run db:generate`, review the SQL in `drizzle/`, then run `npm run db:migrate`. Commit the migration files.

## Project structure

```
src/
  proxy.ts                    optimistic auth redirect (no DB)
  app/
    (auth)/                   giris, kayit, eposta-dogrulama, sifremi-unuttum, sifre-sifirla
    (app)/                    signed-in area with header
      panel/                  role-based redirect
      admin/                  overview + pending teachers, kullanicilar, siniflar, robotlar
      ogretmen/               my classes, siniflar/yeni, siniflar/[id], siniflar/[id]/duzenle
      ogrenci/                join with code, my classes, siniflar/[id]
      hesap/                  name, password, sign out
    api/auth/[...all]/        Better Auth handler (email links land here)
    api/robot/                robot device API: talk, audio/[id], heartbeat
  db/schema/                  Drizzle tables (Better Auth tables + classroom, enrollment, robot*)
  lib/                        auth config, validation (Zod), email, join codes, robot constants, WAV helpers
  server/
    session.ts                getCurrentUser / requireUser / requireRole
    queries/                  authorized reads
    actions/                  authorized Server Actions
    robot/                    device auth, Claude conversation, OpenAI speech, talk pipeline
scripts/                      local-db.ts, seed.ts
raspberry-pi/                 Python client for the companion robot (see raspberry-pi/README.md)
```

With Cache Components, anything that reads the session renders inside a `<Suspense>` boundary. Pages follow one pattern: a static shell plus an async component that calls `requireRole` and loads data.

## Robot companion (Raspberry Pi)

A physical robot (Raspberry Pi 5, USB microphone, USB speaker, small LCD) talks to the app. The Pi is only a hardware client: it records push-to-talk audio, sends it here, plays the reply and shows a face. All AI runs in the web app. Setup guide: **[raspberry-pi/README.md](raspberry-pi/README.md)**.

```
Pi ──HTTPS──► POST /api/robot/talk (WAV)
               ├─ device auth (X-Robot-Id + Bearer token, SHA-256 hash in DB)
               ├─ speech-to-text           OpenAI audio API (Turkish)
               ├─ reply + emotion          Claude, structured output: {text, emotion ∈ happy|neutral|angry}
               ├─ text-to-speech           OpenAI audio API (WAV)
               └─ history (optional)       robot_message
Pi ◄────────── {success, robotId, transcript, text, emotion, audioUrl, audioExpiresAt}
Pi ──HTTPS──► GET /api/robot/audio/<id>   (only that robot, 10 minutes)
Pi ──HTTPS──► POST /api/robot/heartbeat    (every 30 s → "Bağlı" in the dashboard)
```

- **Dashboard:** `/admin/robotlar` (admins only). Register a robot to get a device ID and a token; the token is shown once and only its hash is stored. Per robot you can set the name, model (Claude Sonnet 5.5 by default; Opus 5.5 or Haiku 5.5), personality, voice, memory and enabled expressions. You can also see status and last seen, rotate the token, deactivate or delete the robot, and view or clear its history.
- **Refusals are final:** if Claude declines a request (`stop_reason: "refusal"`), the robot gives a polite "can't answer that" reply with a neutral face. The request is never re-run on another model, and failed AI requests are not retried automatically.
- **Emotion is always valid:** the Claude response is schema-constrained to the robot's enabled emotions. Anything else, including a refusal or a parse failure, falls back to `neutral`. The Pi falls back to `neutral` too.
- **Limits:** uploads ≤ 4 MB (Vercel's body limit is 4.5 MB) and ≤ 60 s; `maxDuration` 60 s; 30 turns per robot per 10 minutes; per-IP limit on unauthenticated attempts. Reply audio lives in Postgres (`robot_audio`) for 10 minutes, with no filesystem or extra storage service.
- **Development:** `ROBOT_AI_MOCK=1` in `.env.local` replaces STT/LLM/TTS with fakes (no keys, no cost; ignored on Vercel production). Then run the Pi client on your computer with a WAV file: `python main.py --wav test.wav --once --no-audio --display console`. To talk to it with your own voice, run `python main.py --desktop` (face window, Konuş button / Space, computer mic and speakers).

| Env var | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude conversation |
| `OPENAI_API_KEY` | Speech-to-text and text-to-speech |
| `OPENAI_STT_MODEL` / `OPENAI_TTS_MODEL` | Optional; default `gpt-4o-mini-transcribe` / `gpt-4o-mini-tts` |
| `ROBOT_AI_MOCK` | `1` = fake AI for local development |

## Deploying to Vercel

1. Push the repository to GitHub and import it in Vercel. The framework is detected automatically.
2. **Database:** in the Vercel project go to **Storage → Create Database → Neon** (Marketplace) and connect it to the project. This sets `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct) for all environments. Optionally turn on Neon branching so each preview deployment gets its own database branch.
3. **Environment variables** (Project → Settings → Environment Variables):

   | Name | Value |
   |---|---|
   | `BETTER_AUTH_SECRET` | output of `openssl rand -base64 32` (different from local) |
   | `BETTER_AUTH_URL` | your production URL, e.g. `https://sinif.example.com` |
   | `RESEND_API_KEY` | from resend.com |
   | `EMAIL_FROM` | e.g. `Sınıf Platformu <no-reply@your-domain.com>`. The domain must be verified in Resend |
   | `APP_NAME` | optional display name |
   | `ANTHROPIC_API_KEY` | for the robot companion's conversations (Claude) |
   | `OPENAI_API_KEY` | for the robot companion's speech-to-text and text-to-speech |

   Preview deployments work without extra configuration: their `*.vercel.app` URLs are allowed automatically via Vercel's system environment variables.
4. **Migrate and create the admin.** Migrations don't run during the build, so a preview build can't change the production schema. Run them from your machine against production:

   ```bash
   npx vercel link && npx vercel env pull .env.production.local --environment=production
   # add ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD to .env.production.local, then:
   ENV_FILE=.env.production.local npm run db:migrate
   ENV_FILE=.env.production.local npm run db:seed
   ```

   `ENV_FILE` makes the scripts read only that file. Alternatively, copy the Neon connection strings from the Neon dashboard into that file by hand. Never run `--demo` in production: the seed script refuses it for any database that isn't on your computer, and there it also requires a new admin password of at least 12 characters. Don't commit `.env*` files (they are git-ignored).
5. Deploy. Repeat step 4's migrate command whenever you add a migration, before or right after deploying. Later you can automate this in CI.

### Before going live

- Verify your sending domain in Resend; `onboarding@resend.dev` can only send to your own Resend account email.
- Use a strong `ADMIN_PASSWORD` and change it after first sign-in (`/hesap`).
