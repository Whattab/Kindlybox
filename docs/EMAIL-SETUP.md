# Email setup (Supabase Auth → Resend)

KindlyBox sends email on **two separate paths**. Only one was working, which is
why signup confirmations and password resets never arrived.

| Path | Used for | How it's configured |
|---|---|---|
| **App → Resend** | Order confirmations (`orders@kindlybox.com`) | `RESEND_API_KEY` / `RESEND_FROM_EMAIL` in env; app code |
| **Supabase Auth → SMTP** | Signup confirmation, **password reset**, magic links | Supabase dashboard (this doc) |

The app's order emails go straight through Resend and work. But **Supabase Auth**
sends its own emails (password reset, etc.) through Supabase's built-in sender by
default — which is heavily rate-limited and not meant for production. The fix is
to point Supabase Auth at Resend's SMTP so *all* email flows through one reliable
sender.

Everything needed already exists: the Resend account, the API key, and a verified
`kindlybox.com` domain (order emails prove it's verified).

---

## 1. Point Supabase Auth at Resend (one-time, ~2 min)

Supabase Dashboard → your project → **Authentication** → **Emails** →
**SMTP Settings** → enable **Custom SMTP**, then enter:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your `RESEND_API_KEY` (same value as in `.env.local`) |
| Sender email | `noreply@kindlybox.com` (any `@kindlybox.com` address works) |
| Sender name | `KindlyBox` |

Click **Save**.

> This is a **project-level** setting. There is only one Supabase project behind
> both local dev and production, so configuring it once covers both environments.

## 2. Raise the email rate limit

Supabase Dashboard → **Authentication** → **Rate Limits** → increase the
"emails per hour" limit above the low default (e.g. 100/hr). The default is tiny
and will silently drop legitimate resets.

## 3. Check the redirect URLs

Password-reset and confirmation links redirect to the URLs allow-listed under
**Authentication** → **URL Configuration**:

- **Site URL:** `https://kindlybox.com`
- **Redirect URLs:** add `http://localhost:3000/**` too if you want to test the
  full click-through flow locally.

---

## Testing

Do the end-to-end test on the **live site** (`kindlybox.com`), because the reset
link redirects to the **Site URL** above. The SMTP change itself is project-wide,
so it takes effect immediately for both environments — but the email's link lands
on production unless `localhost` is in the redirect allow-list.

1. Log out.
2. Go to **Forgot password**, enter `kindlyboxllc@gmail.com`.
3. The reset email should arrive within a minute (check spam the first time).
4. Follow the link, set a new password, log in.

---

## Email confirmation on signup

Currently **off** (`enable_confirmations = false`). Turning it on means a new user
must click a confirmation link before they can sign in — good for blocking fake /
typo signups and protecting sender reputation.

**Turn it on only AFTER step 1 above is verified working.** With confirmations on,
a broken email sender locks every new signup out of their account. Order matters:
fix SMTP → confirm a real email arrives → then enable confirmations.

To enable (production): Supabase Dashboard → **Authentication** → **Providers** →
**Email** → toggle **Confirm email** on. (The `enable_confirmations` line in
`supabase/config.toml` only affects local `supabase start`, not the hosted
project.)

Notes:
- Existing users are already confirmed — this only affects **new** signups.
- After enabling, make sure the signup UI shows a clear "check your email to
  confirm" state so users aren't confused by not being logged in immediately.
