CREATE TABLE public.promises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locator_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.promises TO service_role;
ALTER TABLE public.promises ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.site_content (
  id integer PRIMARY KEY DEFAULT 1,
  main_heading text NOT NULL DEFAULT 'Garden Of Secrets',
  footer_tagline text NOT NULL DEFAULT 'Kept quietly, between us.',
  footer_paragraph text NOT NULL DEFAULT 'Please do not tell anyone about this web. No new information will be provided.',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_content_singleton CHECK (id = 1)
);
GRANT SELECT ON public.site_content TO anon, authenticated;
GRANT ALL ON public.site_content TO service_role;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_content_public_read" ON public.site_content FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('image','link','heading','paragraph')),
  value text NOT NULL,
  label text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cards TO anon, authenticated;
GRANT ALL ON public.cards TO service_role;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cards_public_read" ON public.cards FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.site_content (id) VALUES (1);
INSERT INTO public.cards (kind, value, label, position) VALUES
  ('heading', 'The first secret', NULL, 0),
  ('paragraph', 'Everything written here stays here.', NULL, 1);