# Spendly

A personal budgeting app for Android that answers one question: **how much can I safely spend today?**

You tell it your monthly allowance or salary, and it works out a daily "safe to spend" figure from what's left of your budget and how many days remain. It also tracks transactions, category budgets, savings goals, recurring bills, and money lent to or borrowed from friends, and imports bank statements from CSV.

Built with React Native (Expo), TypeScript, and Supabase.

## Features

**Budgeting**
- Monthly allowance or salary as recurring income, added automatically on the chosen day
- A daily "safe to spend" figure, with spending ring, weekly bars, and recent activity on Home
- Category limits with progress bars, and budget alerts at 80% and 100%
- Optional carry-forward of last month's unspent money

**Tracking**
- Transactions with category, payment method, notes, tags, and receipt photos
- Recurring expenses (rent, subscriptions) that log themselves every month
- Lent and borrowed tracker with partial repayments, kept separate from spending
- Search and filter by type, period, category, and tag

**Savings**
- Goals with a target and progress ("About 6 more months")
- Automatic monthly contributions taken out of an income source, so ₹10,000 with ₹2,000 saved leaves an ₹8,000 budget

**Insights**
- Weekly and monthly totals compared with the previous period, like for like
- Averages per day, week, and month
- Category donut, daily spending bars, a pace line, and spending by tag

**Data**
- CSV import with column mapping that is remembered per bank, a review step, merchant-based auto-categorization, and duplicate protection
- CSV export, with spreadsheet formula injection neutralized
- In-app account deletion that removes all data and receipt photos
- Light and dark themes

## Tech stack

| Layer | Choice |
| --- | --- |
| App | Expo SDK 57, React Native 0.86, TypeScript, Expo Router |
| Data fetching | TanStack Query |
| Forms | React Hook Form, Zod |
| Charts | Hand-drawn with `react-native-svg` |
| Backend | Supabase: PostgreSQL, Auth, Storage, Row Level Security |
| Build and release | EAS Build |

There is no custom server. The app talks to Supabase directly, and all access control lives in the database.

## Design decisions

- **Money is stored as integer paise**, never floating point, so amounts never drift. Parsing and formatting go through one small tested module.
- **Security lives in the database.** Every table carries a `user_id` and has Row Level Security policies, so a user can only ever read or change their own rows. Composite foreign keys also stop a row from referencing another user's category or goal.
- **Server functions are idempotent.** Adding recurring income and expenses, carry-forward, and goal contributions are Postgres functions that are safe to call repeatedly. Opening the app twice, or on two phones, never double-adds a month. They also catch up on months missed while the app was closed.
- **Aggregation happens in SQL.** Spending by category, daily totals, and tag totals are computed in the database, so the phone never downloads every transaction to add them up.
- **Dates are plain calendar dates**, not timestamps, so "today" and daily grouping can't shift with timezones.
- **Imports are safe to repeat.** Each row gets a fingerprint stored under a unique index, so importing the same statement twice adds nothing, while two genuine identical purchases on the same day both survive.
- **Receipts are private.** Photos go into a private storage bucket with one folder per user, and are shown through short-lived signed links.

## Project structure

```
src/
  app/           screens, file-based routes (tabs, auth, forms)
  features/      budget, transactions, categories, savings, import, insights,
                 recurring, loans, tags, receipts: data hooks and pure logic
  components/    shared UI: forms, charts, tab bar, pickers
  lib/           Supabase client, auth, dates, money, theme preference
  constants/     theme tokens
supabase/
  migrations/    schema, security policies, and server functions, in order
  verify-live.mjs   security smoke test against a real project
docs/            privacy policy
```

## Getting started

You need Node 20 or newer and a free [Supabase](https://supabase.com) project.

1. Install dependencies.

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your Supabase project URL and the **anon (publishable)** key from *Project Settings, API*. Never put a `service_role` or secret key in the app.

3. In the Supabase SQL Editor, run every file in `supabase/migrations/` in filename order.

4. While developing, turn off **Confirm email** under *Authentication, Sign In / Providers, Email* so test sign-ups work immediately.

5. Start the app and scan the QR code with Expo Go.

   ```bash
   npx expo start
   ```

Free Supabase projects pause after about a week without activity. If the app stops connecting, restore the project from the dashboard.

### Checking the security rules

After running the migrations, this signs up two throwaway users, confirms neither can read, change, or delete the other's data or receipts, then deletes both accounts:

```bash
node supabase/verify-live.mjs
```

## Building and sharing

See [RELEASE.md](RELEASE.md) for building a shareable APK with EAS, sending it to testers, and the Google Play steps.

## Status and roadmap

Spendly is in beta and focused on Android. Planned next:

- Reading PDF bank statements and asking about each payment
- Detecting UPI payments from notifications, with a quick category prompt
- A paid tier for those two features
