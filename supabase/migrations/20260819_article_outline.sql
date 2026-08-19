-- ============================================================================
-- KindlyBox Gift Intelligence Engine — Phase 2.1: the outline stage
-- ----------------------------------------------------------------------------
-- Adds a review point between "approve the idea" and "here is 900 words":
--
--   opportunity -> OUTLINE (you edit + approve the plan) -> DRAFT -> REVIEW
--                                                                -> PUBLISHED
--
-- Safe to re-run.
-- ============================================================================

-- The plan for the article, editable before a word is written:
--   { angle, sections: [{heading, purpose}], internal_links: [{href, label}] }
alter table public.articles
  add column if not exists outline jsonb not null default '{}'::jsonb;

-- OUTLINE joins the status set. The old constraint has to go first.
alter table public.articles
  drop constraint if exists articles_status_check;

alter table public.articles
  add constraint articles_status_check
  check (status in ('OUTLINE','DRAFT','REVIEW','PUBLISHED','ARCHIVED'));

-- The public read policy still only exposes PUBLISHED rows, so outlines are as
-- invisible as drafts. Nothing to change there.
