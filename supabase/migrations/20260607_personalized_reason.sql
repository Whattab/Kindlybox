-- Add personalized_reason to gift_suggestions.
-- This stores the AI-generated "why we picked this gift" text so we
-- don't re-generate on every page reload or email re-send.
-- Run in Supabase SQL Editor. Safe to re-run.

alter table public.gift_suggestions
  add column if not exists personalized_reason text;
