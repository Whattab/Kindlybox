-- Digital-gift creation flows (custom song / card / bundle) capture a richer,
-- structured brief than the old single-text-field form: genre, mood, story,
-- names to include, closing signature, delivery method, etc. Store it as JSON
-- so each service can carry its own shape without a column per field.
--
-- Also make buyer_email nullable: the new multi-step flow has no email field —
-- Stripe Checkout collects the buyer's email, and the webhook backfills it onto
-- the order after payment. Run in the Supabase SQL editor. Safe to re-run.

alter table public.orders
  add column if not exists brief jsonb;

alter table public.orders
  alter column buyer_email drop not null;
