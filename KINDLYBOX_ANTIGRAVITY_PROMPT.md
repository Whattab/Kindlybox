# KindlyBox — Antigravity Agent Instructions

## Project Overview

Build **KindlyBox** — a premium gift recommendation web app at kindlybox.com.

Users take a short quiz describing who they're buying for, the occasion, their interests, and their budget. The app emails them 3 curated gift suggestions with affiliate buy links. Registered users also get a personal dashboard to track important life events (birthdays, anniversaries) and their gift purchase history.

**Reference site**: https://www.kindlybox.com (existing WordPress site — use for brand/category inspiration, but build fresh as a Next.js app)

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth (email + Google OAuth) |
| Email | Resend (with React Email templates) |
| File Storage | Supabase Storage |
| Hosting | Vercel |
| Analytics | PostHog |

---

## Design Direction

- **Brand name**: KindlyBox
- **Tone**: Warm, premium, personal — like a thoughtful friend who always knows the right gift
- **Colour palette**: Deep forest green (#1C3A2F) as primary, warm cream (#FAF8F4) as background, gold (#C4954A) as accent
- **Typography**: Cormorant Garamond (headings, serif, elegant) + DM Sans (body, clean)
- **Feel**: Luxury gifting brand — not a generic e-commerce site

---

## Pages & Features to Build

### 1. Landing Page (`/`)
- Hero section: headline, sub-headline, CTA button "Find the Perfect Gift"
- How it works: 3 steps (Take Quiz → Get Suggestions → Buy with One Click)
- Gift categories grid: For Her, For Him, For Kids, Birthdays, Anniversaries, Weddings, Tech Lovers, Housewarming
- Social proof / testimonials section
- Footer with links

### 2. Gift Quiz (`/quiz`)
A 4-step wizard. No login required — anyone can take it.

**Step 1 — Who are you buying for?**
Options: Partner/Spouse, Parent, Close Friend, Child, Colleague, Sibling

**Step 2 — What's the occasion?**
Options: Birthday, Anniversary, Christmas, Wedding, New Baby, Just Because, Graduation, Housewarming

**Step 3 — What are their interests?**
Options (multi-select up to 3): Wellness & Nature, Books & Learning, Food & Cooking, Travel & Adventure, Tech & Gadgets, Fashion & Style, Home & Decor, Sport & Fitness

**Step 4 — What's your budget?**
Options: Under £25, £25–£50, £50–£100, £100–£200, No limit

**After quiz completion:**
- Show email capture form: "We've found 3 perfect gifts — where should we send them?"
- Capture: first name + email
- If user is logged in, skip email capture and use their account email
- Trigger email send (see Email section below)
- Show results page with the 3 gift suggestions immediately on screen too

### 3. Gift Results (`/results/[sessionId]`)
- Display 3 gift cards with: product image, name, match % score, short description, price range, "Buy Now →" button (affiliate link)
- "Save to profile" button (prompts login if not authenticated)
- "Retake Quiz" link
- Share buttons (copy link)

### 4. Auth Pages
- `/auth/login` — Email + password, Google OAuth button
- `/auth/signup` — First name, last name, email, password
- `/auth/forgot-password`
- Redirect to dashboard after login

### 5. User Dashboard (`/dashboard`)
Protected route — requires login.

**Sections:**
- Greeting: "Good morning, [First Name]"
- Stats row: Total Gifts Given, Upcoming Events, Average Spend
- Upcoming Occasions list (sorted by date, colour-coded urgency: red <7 days, amber 7–30 days, green 30+ days)
- Each occasion has a "Find Gift" button that pre-fills the quiz
- Recent Purchases grid

### 6. Occasions (`/dashboard/occasions`)
- List all saved occasions
- Add New Occasion form: title, occasion type, recipient name, recipient relationship, date, recurring (yearly toggle), budget, notes
- Edit / delete occasions
- Automated reminder scheduling: send reminder emails 7 days and 1 day before each occasion

### 7. Gift History (`/dashboard/gifts`)
- All past gift purchases logged by the user
- Fields: gift name, recipient, occasion, price paid, date, status (saved/ordered/delivered), notes
- Add manual gift entry (for gifts bought outside KindlyBox)

### 8. Profile Settings (`/dashboard/profile`)
- Edit name, email, avatar
- Default currency (GBP/USD/EUR)
- Default budget preference
- Reminder preferences: how many days before (checkboxes: 14, 7, 3, 1 day)
- Email notification preferences
- Delete account

---

## Database Schema (Supabase / PostgreSQL)

Run these migrations in order:

```sql
-- Users (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) primary key,
  email text unique not null,
  full_name text,
  first_name text,
  avatar_url text,
  timezone text default 'Europe/London',
  default_currency text default 'GBP',
  default_budget numeric,
  reminder_days int[] default '{7,1}',
  email_notifications boolean default true,
  created_at timestamptz default now()
);

-- Occasions / Events
create table public.occasions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  occasion_type text not null, -- birthday, anniversary, christmas, etc.
  recipient_name text,
  recipient_relation text, -- partner, parent, friend, child, colleague
  date date not null,
  recurring boolean default true,
  budget numeric,
  notes text,
  created_at timestamptz default now()
);

-- Reminder queue
create table public.reminders (
  id uuid default gen_random_uuid() primary key,
  occasion_id uuid references public.occasions(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  send_at timestamptz not null,
  channel text default 'email', -- email, push
  status text default 'pending', -- pending, sent, failed
  sent_at timestamptz,
  created_at timestamptz default now()
);

-- Gift catalogue
create table public.gifts (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  image_url text,
  price_min numeric not null,
  price_max numeric not null,
  tags text[], -- wellness, books, food, travel, tech, fashion, home, sport
  occasions text[], -- birthday, anniversary, christmas, wedding, etc.
  recipients text[], -- partner, parent, friend, child, colleague, sibling
  affiliate_url text,
  affiliate_network text, -- amazon, awin, etsy, other
  active boolean default true,
  created_at timestamptz default now()
);

-- Quiz sessions
create table public.quiz_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id), -- null if anonymous
  occasion_id uuid references public.occasions(id), -- optional link
  answers jsonb not null, -- { recipient, occasion, interests[], budget }
  email_captured text, -- for anonymous users
  first_name_captured text,
  created_at timestamptz default now()
);

-- Gift suggestions (output of quiz)
create table public.gift_suggestions (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.quiz_sessions(id) on delete cascade,
  gift_id uuid references public.gifts(id),
  match_score numeric, -- 0-100
  rank int, -- 1, 2, or 3
  email_sent_at timestamptz,
  clicked_at timestamptz
);

-- User purchase history
create table public.purchases (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  gift_id uuid references public.gifts(id), -- nullable (custom gift)
  occasion_id uuid references public.occasions(id),
  gift_name text, -- fallback for custom gifts
  price_paid numeric,
  purchased_at date,
  status text default 'saved', -- saved, ordered, delivered
  recipient_name text,
  notes text,
  created_at timestamptz default now()
);
```

**Enable Row Level Security on all tables.** Users can only read/write their own data.

---

## Gift Recommendation Logic

File: `lib/recommend.ts`

```typescript
// Scoring algorithm — run server-side in a Next.js API route
// POST /api/quiz/submit

interface QuizAnswers {
  recipient: string;      // partner, parent, friend, child, colleague, sibling
  occasion: string;       // birthday, anniversary, christmas, etc.
  interests: string[];    // up to 3 selected
  budget: string;         // 'under-25', '25-50', '50-100', '100-200', 'no-limit'
}

// Score each gift in the catalogue:
// +30 points if recipient matches
// +25 points if occasion matches
// +15 points per matching interest (up to 3 = 45 pts)
// budget filter: exclude gifts outside range entirely
// Return top 3 gifts sorted by score descending
// Calculate match % as: score / max_possible_score * 100
```

---

## Email Templates

Use **Resend** + **React Email** for all transactional emails.

### Email 1: Gift Suggestions (`emails/GiftSuggestions.tsx`)
Triggered after quiz completion.

Content:
- Subject: `"Your 3 perfect gifts are here, [FirstName] 🎁"`
- Header: KindlyBox logo + "We found your matches"
- 3 gift cards, each with: image, name, match %, description, price, "Buy Now →" button (affiliate link)
- Footer: "Save these to your KindlyBox profile" CTA + unsubscribe link

### Email 2: Occasion Reminder (`emails/OccasionReminder.tsx`)
Triggered by cron job when `reminders.send_at <= now()`.

Content:
- Subject: `"[Occasion] is coming up — have you found a gift?"`
- Body: "[Recipient]'s [occasion type] is in [X] days. Budget: £[amount]"
- CTA: "Find the Perfect Gift →" (links to quiz with pre-filled params)

### Email 3: Welcome (`emails/Welcome.tsx`)
Triggered on signup.

Content:
- Welcome to KindlyBox
- CTA: "Take your first quiz"
- Brief how it works

---

## API Routes

| Method | Route | Description |
|---|---|---|
| POST | `/api/quiz/submit` | Save quiz session, run recommendation, send email, return top 3 gifts |
| GET | `/api/gifts/[sessionId]` | Fetch gift suggestions for a session |
| POST | `/api/occasions` | Create new occasion + schedule reminders |
| PUT | `/api/occasions/[id]` | Update occasion |
| DELETE | `/api/occasions/[id]` | Delete occasion + reminders |
| POST | `/api/purchases` | Log a gift purchase |
| PUT | `/api/purchases/[id]` | Update purchase status |
| GET | `/api/dashboard` | Fetch all dashboard data for logged-in user |
| POST | `/api/reminders/process` | Cron endpoint — send pending reminder emails |

---

## Environment Variables Needed

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Resend (email)
RESEND_API_KEY=
RESEND_FROM_EMAIL=hello@kindlybox.com

# App
NEXT_PUBLIC_APP_URL=https://kindlybox.com

# PostHog (analytics)
NEXT_PUBLIC_POSTHOG_KEY=
```

---

## Seed Data

Populate the `gifts` table with at least 30 gift products covering all categories. Each gift must have:
- A real product name and description
- Realistic price range
- Correct tags, occasions, and recipients arrays
- A placeholder affiliate_url (format: `https://kindlybox.com/go/[gift-slug]`)

Example entries:
- Botanical Spa Set | wellness | birthday, anniversary | partner, parent | £45–£75
- Personalised Leather Journal | books | birthday, graduation | friend, colleague | £30–£50
- Artisan Coffee Subscription | food | birthday, christmas | partner, parent, colleague | £25–£60
- Wireless Noise-Cancelling Headphones | tech | birthday, christmas | partner, child | £80–£150
- Luxury Scented Candle Trio | wellness, home | birthday, housewarming | partner, parent, friend | £35–£65

---

## Existing WordPress Site

**Reference**: https://www.kindlybox.com

- Use the existing site for brand inspiration and category names only
- The existing site is on WordPress/Hostinger — the new app will replace it
- Once the Next.js app is live on Vercel, update the DNS on Hostinger to point kindlybox.com to Vercel
- Do NOT attempt to integrate with or import from the WordPress site

---

## Build Order (follow this sequence)

1. Scaffold Next.js 14 project with TypeScript + Tailwind
2. Set up Supabase project + run all migrations + enable RLS
3. Build auth pages (login, signup, forgot password)
4. Seed the gifts table with 30+ products
5. Build the quiz flow (4 steps + email capture)
6. Build the recommendation API route (`/api/quiz/submit`)
7. Build the results page
8. Set up Resend + build gift suggestion email template
9. Build the landing page
10. Build the dashboard (occasions, purchases, stats)
11. Build occasions CRUD + reminder scheduling
12. Build gift history page
13. Build profile settings page
14. Set up reminder cron job (`/api/reminders/process`)
15. Set up PostHog analytics
16. Final QA + deploy to Vercel

---

## Important Notes for the Agent

- Use **Next.js App Router** (not Pages Router)
- All database calls must go through **server components or API routes** — never expose Supabase service key to the client
- Use **Supabase Row Level Security** — every table must have RLS policies
- The quiz must work for **anonymous users** (no login required)
- Mobile-first responsive design — the quiz especially must work perfectly on phone
- Use **loading skeletons** not spinners for dashboard data
- Affiliate links must open in a **new tab** and be tracked via the `gift_suggestions.clicked_at` field
- All forms must have **proper validation** and error states
- The recommendation engine runs **server-side only**

---

*Generated for KindlyBox — https://www.kindlybox.com*
*Reference design: Giftly prototype (internal)*
