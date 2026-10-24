# Deployment guide: GitHub → Vercel → Neon

This guide takes the project from your Mac to a live HTTPS website that the robot can talk to. Do the steps in order. It takes about 45 minutes the first time.

**What you will have at the end**

- A private GitHub repository with the code.
- The website running on Vercel at `https://<project-name>.vercel.app`.
- A Neon PostgreSQL database for production (separate from your local one).
- The Raspberry Pi (or the desktop simulator) talking to the live site.

**Costs:** Vercel's Hobby plan and Neon's free plan cost nothing for a school project. Only the AI services cost money: about half a US cent per robot conversation turn.

## Before you start

- [ ] A GitHub account (github.com).
- [ ] A Vercel account. Sign up at vercel.com with **"Continue with GitHub"**.
- [ ] An Anthropic API key and an OpenAI API key. Creating **new keys just for production** is recommended. Set a monthly spending limit in each provider's dashboard.
- [ ] The project works locally (`npm run dev`), and the first commit exists (`git log` shows `feat: add AI companion robot integration`).

> **Never put secrets in git.** `.env.local`, `.env.production.local` and `raspberry-pi/.env` are ignored by git on purpose. Secrets go into Vercel's settings page and your local `.env*` files only.

---

## Step 1: Put the code on GitHub (private)

1. Open **github.com/new**.
2. Repository name: for example `tubitak-robot`. Select **Private**.
3. **Do not** tick "Add a README", ".gitignore" or "license". The project already has them.
4. Click **Create repository**. Copy the HTTPS address it shows (`https://github.com/<you>/tubitak-robot.git`).
5. In Terminal:

   ```bash
   cd ~/Developer/TUBITAK
   git remote add origin https://github.com/<you>/tubitak-robot.git
   git push -u origin main
   ```

6. When git asks for a password, GitHub needs an **access token**, not your account password:
   GitHub → your photo → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**. Give it access to this one repository with **Contents: Read and write**. Paste the token as the password. macOS saves it in the Keychain, so you only do this once.
   (Easier alternative: install **GitHub Desktop** and use *File → Add Local Repository*, then *Publish*.)

Check: the repository page on GitHub shows your files and **no** `.env.local` file.

## Step 2: Create the Vercel project

1. On vercel.com: **Add New… → Project → Import Git Repository**. Allow Vercel to access the repository if asked, then click **Import**.
2. Vercel detects **Next.js** automatically. Leave the build settings as they are.
3. Open **Environment Variables** on the same screen and add these three (the rest come in steps 3 and 4):

   | Name | Value |
   |---|---|
   | `BETTER_AUTH_SECRET` | a **new** random value: run `openssl rand -base64 32` in Terminal and paste the output. Don't reuse your local one. |
   | `ANTHROPIC_API_KEY` | your production Anthropic key |
   | `OPENAI_API_KEY` | your production OpenAI key |

4. Click **Deploy**.

> **The first build is expected to fail** with `DATABASE_URL is not set`, because there is no database yet. That's fine: you'll click Redeploy in step 6.

Write down the project's production address: **Project → Settings → Domains**, for example `https://tubitak-robot.vercel.app`.

## Step 3: Create the Neon database (through Vercel)

1. In the Vercel project: **Storage → Create Database → Neon** (from the Marketplace). Accept the Neon terms.
2. **Region:** choose **Frankfurt (eu-central-1)**. It's the closest to Turkey.
3. Connect it to this project for **Production** and **Preview** only. Leave **Development** unticked, because your Mac keeps using its own local database. Vercel then adds `DATABASE_URL` (pooled, used by the app) and `DATABASE_URL_UNPOOLED` (direct, used for migrations) automatically.
   If Neon offers **"Create a database branch for each Preview deployment"**, turn it on. Test deployments then get their own copy and never touch production data.
4. Put the app's functions in the same region: **Project → Settings → Functions → Function Region → Frankfurt (fra1)**. The app and the database are then close together, which makes every page and robot reply faster.

Nothing from your local database needs to move. Your local data is development and demo data (demo accounts with a published password, test chats). Production starts empty: you'll create a fresh admin and register the robot again.

## Step 4: The remaining environment variables

**Project → Settings → Environment Variables.** When you're done, the list should look like this:

| Name | Needed? | Value / note |
|---|---|---|
| `DATABASE_URL` | required | set by Neon in step 3 |
| `DATABASE_URL_UNPOOLED` | required | set by Neon in step 3 |
| `BETTER_AUTH_SECRET` | required | from step 2. Sign-in won't work in production without it. |
| `ANTHROPIC_API_KEY` | required for the robot | from step 2 |
| `OPENAI_API_KEY` | required for the robot | from step 2 |
| `BETTER_AUTH_URL` | recommended | your production address from step 2, e.g. `https://tubitak-robot.vercel.app`. It's also the address the dashboard shows to new robots. |
| `RESEND_API_KEY` | needed for sign-ups | from resend.com. Without it, teachers and students never receive their verification email. (The admin from step 5 doesn't need it.) |
| `EMAIL_FROM` | with Resend | e.g. `Sınıf Platformu <no-reply@your-domain.com>`. The domain must be verified in Resend. |
| `APP_NAME` | optional | name shown in the page title and emails |
| `OPENAI_STT_MODEL` / `OPENAI_TTS_MODEL` | optional | only to change the speech models |

**Do not add** `ROBOT_AI_MOCK` (development only) or `ADMIN_PASSWORD` (it belongs only in your local `.env.production.local`, see step 5).

Tip: tick **Sensitive** for the secret ones. They can then never be read back, only replaced.

## Step 5: Create the tables and the admin (from your Mac)

The build never changes the database, so you run the migrations yourself, once now and again whenever a new migration is added. The repository has three migrations (`drizzle/0000_init.sql`, `0001_robots.sql`, `0002_default_model_sonnet.sql`), and all of them run.

1. Download the production settings into a local file that git ignores:

   ```bash
   cd ~/Developer/TUBITAK
   npx vercel login
   npx vercel link                      # pick your team and the project
   npx vercel env pull .env.production.local --environment=production
   ```

   Always type the file name `.env.production.local`. Without it, `vercel env pull` writes to `.env.local` and replaces your local settings.
   If `DATABASE_URL_UNPOOLED` comes out empty (variables marked "Sensitive" can't be downloaded), copy it from the **Neon dashboard → Connect**: switch **Connection pooling off** for the direct address, and use it for both lines.

2. Open `.env.production.local` in your editor and add the admin account at the end. Use a **new** password of at least 12 characters (a password manager can generate one):

   ```
   ADMIN_NAME=Yönetici
   ADMIN_EMAIL=your-real-email@example.com
   ADMIN_PASSWORD=<a long new password>
   ```

3. Run the migrations, then create the admin:

   ```bash
   ENV_FILE=.env.production.local npm run db:migrate
   ENV_FILE=.env.production.local npm run db:seed
   ```

   `ENV_FILE` makes the scripts use **only** that file, so your local database isn't touched.
   For any database that isn't on your computer, the seed script stops before writing anything if you add `-- --demo` (demo accounts have a published password), or if `ADMIN_PASSWORD` is shorter than 12 characters, is the demo password, or is the same as your local admin password. If you see such a message, fix `.env.production.local` and run the command again.

4. Keep `.env.production.local` private (it's git-ignored). You can delete it when you're done and pull it again later.

## Step 6: Deploy and check the website

1. **Project → Deployments →** the failed deployment **→ ⋯ → Redeploy**. Wait until it says **Ready**.
2. Open your production address. Check:
   - [ ] The home page loads over `https://`.
   - [ ] `/giris`: sign in with the admin email and password from step 5. You land on `/admin`.
   - [ ] **Hesap** (`/hesap`): sign-out and sign-in work.

From now on, every `git push` to `main` deploys automatically.

## Step 7: Test the robot API over HTTPS (free)

1. A free "is it alive" test from Terminal:

   ```bash
   curl -i -X POST https://tubitak-robot.vercel.app/api/robot/heartbeat
   ```

   Expected: `401` with `{"success":false,"error":{"code":"UNAUTHORIZED",...}}`. That's correct, because no robot credentials were sent.
2. Register the robot on production: **/admin/robotlar → Yeni robot**. Copy the three `.env` lines it shows (`ROBOT_API_URL`, `ROBOT_DEVICE_ID`, `ROBOT_DEVICE_TOKEN`). **The token is shown only once.**

> Use the **production address** (`https://<project>.vercel.app` or your own domain) for the robot. Vercel protects the long per-deployment preview addresses with a Vercel login, so the robot would get `401` there.

## Step 8: Point the robot at Vercel

On the Raspberry Pi (or on your Mac for the desktop simulator), edit `raspberry-pi/.env` and replace the three lines with the ones from step 7:

```
ROBOT_API_URL=https://tubitak-robot.vercel.app
ROBOT_DEVICE_ID=robot_…
ROBOT_DEVICE_TOKEN=rbt_…
```

Tip: on your Mac, keep the local values in a copy (`cp raspberry-pi/.env raspberry-pi/.env.local-dev`) so you can switch back.

Then:

```bash
cd raspberry-pi
.venv/bin/python main.py --check        # free: config, microphone, speaker and "sunucu: bağlandı (<robot name>)"
.venv/bin/python main.py --desktop      # Mac simulator (on the Pi: python main.py)
```

Within about 30 seconds the robot shows as **Bağlı** on its dashboard page. The first spoken conversation is a real, paid AI call (about half a cent per turn).

---

## Later: updating the live site

- Code change: commit and `git push`. Vercel deploys automatically.
- Schema change: run `npm run db:generate` locally, commit the new file in `drizzle/`, then run `ENV_FILE=.env.production.local npm run db:migrate` **before or right after** pushing.
- Keep dependencies patched: `npm audit` now and then. (Next.js was upgraded to 16.4.3 before the first commit because 16.4.0 had critical security advisories.)

## Troubleshooting

| What you see | Cause and fix |
|---|---|
| Build fails: `DATABASE_URL is not set` | Neon isn't connected to the project yet (step 3). Connect it, then Redeploy. |
| Sign-in fails, logs mention `BETTER_AUTH_SECRET` | The variable is missing or was added after the deployment. Add it and Redeploy (environment variables apply to new deployments only). |
| Pages show an error; Vercel logs say `relation "user" does not exist` | Migrations weren't run against production (step 5). |
| New users never get the verification email | `RESEND_API_KEY` / `EMAIL_FROM` are missing, or the domain isn't verified in Resend. Without a verified domain, Resend only delivers to your own Resend account email. |
| Robot: `Robot kimliği veya anahtarı geçersiz` | It's still using the local device ID/token. Production needs its own robot (step 7). |
| Robot gets `401` with an HTML page | `ROBOT_API_URL` is a protected preview address. Use the production address. |
| Robot: `Konuşma servisi yapılandırılmamış` | `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` are missing in Vercel. Add them and Redeploy. |
| Logs show `SECURITY WARNING: The SSL modes 'prefer', 'require'…` | Harmless. It comes from the database driver; the connection *is* encrypted and verified. |
