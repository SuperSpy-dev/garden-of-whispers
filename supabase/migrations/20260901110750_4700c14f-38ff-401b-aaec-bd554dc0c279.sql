ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS heading text,
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS link_url text,
  ADD COLUMN IF NOT EXISTS link_label text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS image_alt text;

ALTER TABLE public.cards ALTER COLUMN kind DROP NOT NULL;
ALTER TABLE public.cards ALTER COLUMN value DROP NOT NULL;

UPDATE public.cards SET heading = value WHERE kind = 'heading' AND heading IS NULL;
UPDATE public.cards SET body = value WHERE kind = 'paragraph' AND body IS NULL;
UPDATE public.cards SET link_url = value, link_label = label WHERE kind = 'link' AND link_url IS NULL;
UPDATE public.cards SET image_url = value, image_alt = label WHERE kind = 'image' AND image_url IS NULL;

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS answer text,
  ADD COLUMN IF NOT EXISTS answered_at timestamptz;

GRANT SELECT ON public.questions TO anon, authenticated;