-- Resume marker for the product AI re-tag (tag-quality fix).
-- `ai_tagged_at` is stamped when scripts/ai-tag-products.ts replaces a product's
-- interests/occasions/recipients/style with AI-generated tags, so a long
-- (22k-row) background run is resumable: it processes WHERE ai_tagged_at IS NULL
-- and skips rows already done. Idempotent — safe to run on dev and prod.

alter table products add column if not exists ai_tagged_at timestamptz;

-- Partial index so the "not yet tagged" scan stays cheap as the run progresses.
create index if not exists idx_products_ai_tagged_at_null
  on products (id) where ai_tagged_at is null;
