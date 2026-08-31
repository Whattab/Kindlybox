-- Let a quiz suggestion point at EITHER a curated gift or an affiliate product,
-- so the results can be a free blend of both. gift_id is already nullable; we add
-- an optional product_id (FK to products) and a source discriminator.
alter table public.gift_suggestions
  add column if not exists product_id uuid references public.products(id) on delete set null,
  add column if not exists source text not null default 'gift';
