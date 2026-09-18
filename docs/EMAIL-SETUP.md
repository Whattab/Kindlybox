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

## Deliverability (staying out of spam)

Once SMTP works, mail is *delivered* — but a young sending domain often lands in
**spam** until its reputation builds. Auth emails arriving in spam are a
deliverability issue, not a delivery failure.

**DNS (checked 2026-09):**

| Record | Status |
|---|---|
| DKIM `resend._domainkey.kindlybox.com` | ✅ valid Resend key |
| SPF `send.kindlybox.com` | ✅ `v=spf1 include:amazonses.com ~all` (Resend sends via SES) |
| DMARC `_dmarc.kindlybox.com` | ⚠️ **two records published — must be one** |

**Fix the duplicate DMARC (highest impact).** When a domain publishes more than
one DMARC record, receivers ignore DMARC entirely — so it's as if you have none.
In Hostinger → DNS, delete the bare record and keep the complete one:

- ❌ delete: `v=DMARC1; p=none`
- ✅ keep: `v=DMARC1; p=none; rua=mailto:dmarc@kindlybox.com; adkim=r; aspf=r`

With DKIM + SPF already aligned, a single DMARC record gives Gmail a clean pass.

**Reputation moves:**
- In Gmail, open the spam email → **Not spam**, and add the sender
  (`noreply@kindlybox.com`) to Contacts. Trains your own account immediately.
- Reputation builds with volume + engagement over days/weeks — early spam
  placement usually self-corrects once the domain has a track record.

**Branded templates** (plain, link-only emails look phishy and get filtered).
Paste these into Supabase → Authentication → Email Templates:
- Reset Password → [`email-templates/reset-password.html`](email-templates/reset-password.html)
- Confirm signup → [`email-templates/confirm-signup.html`](email-templates/confirm-signup.html)

The two emails verify through **different** routes, so their links differ — paste
each file into its matching template, don't swap them:

| Email | App route | Link variable |
|---|---|---|
| Reset Password | `/auth/confirm` (token_hash / OTP) | `{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=recovery` |
| Confirm signup | `/auth/callback` (code / PKCE) | `{{ .ConfirmationURL }}` |

> Write the query separators as `&amp;`, not raw `&`. Gmail mangles an unescaped
> `&` in an href, so the clicked button loses the token (copy-pasting the URL
> still works — that's the tell).

> Using the default `{{ .ConfirmationURL }}` for **reset** produces an
> "Authentication Error" page: it routes through Supabase's verify endpoint and
> reaches `/auth/confirm` with no token to check. The reset template is built for
> the token_hash flow instead.

Both render in Gmail/Outlook/Apple Mail (table layout + inline CSS).

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
