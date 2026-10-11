-- Baseline captured from DevMate's public schema on 2026-10-11.
-- Fresh databases only. For the existing hosted database, verify then mark this
-- version applied; never replay these CREATE TABLE statements there.
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE, name text NOT NULL,
  bio text, skills text[], location text, is_remote boolean DEFAULT true,
  experience_level text CHECK (experience_level IN ('fresher','mid','senior')), industry text,
  github_url text, linkedin_url text, portfolio_links text[], avatar_url text,
  rating numeric DEFAULT 0, total_reviews integer DEFAULT 0, badges text[], created_at timestamp DEFAULT now()
);
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, description text NOT NULL,
  type text CHECK (type IN ('paid','passion','open-source','hackathon','startup')), skills_needed text[],
  owner_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  experience_level text CHECK (experience_level IN ('fresher','mid','senior','any')), industry text,
  is_remote boolean DEFAULT true, location text,
  status text DEFAULT 'open' CHECK (status IN ('open','in-progress','completed','closed')),
  max_members integer DEFAULT 5, created_at timestamp DEFAULT now()
);
CREATE TABLE public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  applicant_id uuid REFERENCES public.users(id) ON DELETE CASCADE, message text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')), created_at timestamp DEFAULT now()
);
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sender_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES public.users(id) ON DELETE CASCADE, project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  content text NOT NULL, is_read boolean DEFAULT false, created_at timestamp DEFAULT now()
);
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reviewer_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  reviewee_id uuid REFERENCES public.users(id) ON DELETE CASCADE, project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  rating integer CHECK (rating BETWEEN 1 AND 5), comment text, created_at timestamp DEFAULT now()
);
CREATE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users(id,email,name,created_at)
  VALUES(NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),now());
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- Reproduce historical grants. The following MVP migration removes these.
GRANT ALL ON public.users,public.projects,public.applications,public.messages,public.reviews TO anon,authenticated,service_role;
