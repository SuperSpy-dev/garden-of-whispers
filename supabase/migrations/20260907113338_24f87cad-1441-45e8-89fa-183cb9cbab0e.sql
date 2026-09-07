CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  subtitle text,
  image_url text,
  avatar_style text NOT NULL DEFAULT 'lorelei',
  avatar_seed text,
  rank_title text,
  description text,
  list_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  published boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_public_read ON public.profiles
  FOR SELECT TO anon, authenticated USING (published = true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT true;

DROP POLICY IF EXISTS cards_public_read ON public.cards;
CREATE POLICY cards_public_read ON public.cards
  FOR SELECT TO anon, authenticated USING (published = true);

ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS answer_published boolean NOT NULL DEFAULT false;
UPDATE public.questions SET answer_published = true WHERE answer IS NOT NULL;