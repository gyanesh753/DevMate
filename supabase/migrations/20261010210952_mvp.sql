BEGIN;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC,anon,authenticated;
CREATE TABLE private.migration_archive (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_table text NOT NULL, reason text NOT NULL, row_data jsonb NOT NULL, archived_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.migration_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.migration_archive FROM PUBLIC,anon,authenticated;
-- Archive complete dependent records before removing invalid sample data.
INSERT INTO private.migration_archive(source_table,reason,row_data)
SELECT 'projects','missing_owner',to_jsonb(p) FROM public.projects p WHERE owner_id IS NULL;
INSERT INTO private.migration_archive(source_table,reason,row_data)
SELECT 'applications','missing_project_owner',to_jsonb(a) FROM public.applications a JOIN public.projects p ON p.id=a.project_id WHERE p.owner_id IS NULL;
INSERT INTO private.migration_archive(source_table,reason,row_data)
SELECT 'messages','missing_project_owner',to_jsonb(m) FROM public.messages m JOIN public.projects p ON p.id=m.project_id WHERE p.owner_id IS NULL;
INSERT INTO private.migration_archive(source_table,reason,row_data)
SELECT 'reviews','missing_project_owner',to_jsonb(r) FROM public.reviews r JOIN public.projects p ON p.id=r.project_id WHERE p.owner_id IS NULL;
DELETE FROM public.projects WHERE owner_id IS NULL;
INSERT INTO private.migration_archive(source_table,reason,row_data)
SELECT 'applications','self_application',to_jsonb(a) FROM public.applications a JOIN public.projects p ON p.id=a.project_id WHERE a.applicant_id=p.owner_id;
DELETE FROM public.applications a USING public.projects p WHERE a.project_id=p.id AND a.applicant_id=p.owner_id;

DROP TRIGGER on_auth_user_created ON auth.users;
DROP FUNCTION public.handle_new_user();
ALTER TABLE public.users DROP COLUMN email;
ALTER TABLE public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.users ADD CONSTRAINT users_auth_fkey FOREIGN KEY(id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.users ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE public.projects ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE public.applications ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE public.messages ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE public.reviews ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
UPDATE public.users SET bio=COALESCE(bio,''), location=COALESCE(location,''), github_url=COALESCE(github_url,''), linkedin_url=COALESCE(linkedin_url,''), created_at=COALESCE(created_at,now());
ALTER TABLE public.users ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.users ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.users ADD CONSTRAINT users_name_length CHECK(length(btrim(name)) BETWEEN 1 AND 80);
ALTER TABLE public.users ADD CONSTRAINT users_bio_length CHECK(length(bio)<=2000);
ALTER TABLE public.users ADD CONSTRAINT users_location_length CHECK(length(location)<=120);
ALTER TABLE public.users ADD CONSTRAINT users_urls CHECK (
  (github_url='' OR (length(github_url)<=2048 AND github_url ~ '^https?://[^[:space:]]+$')) AND
  (linkedin_url='' OR (length(linkedin_url)<=2048 AND linkedin_url ~ '^https?://[^[:space:]]+$')));
UPDATE public.projects SET type=COALESCE(type,'passion'),experience_level=COALESCE(experience_level,'any'),
  is_remote=COALESCE(is_remote,true),location=COALESCE(location,''),industry=COALESCE(industry,''),status=COALESCE(status,'open'),created_at=COALESCE(created_at,now());
ALTER TABLE public.projects ALTER COLUMN owner_id SET NOT NULL, ALTER COLUMN type SET NOT NULL,
  ALTER COLUMN experience_level SET NOT NULL, ALTER COLUMN is_remote SET NOT NULL, ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN max_members SET NOT NULL, ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.projects ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(), ADD COLUMN version integer NOT NULL DEFAULT 1,
  ADD COLUMN started_at timestamptz, ADD COLUMN completed_at timestamptz, ADD COLUMN closed_at timestamptz;
ALTER TABLE public.projects ADD CONSTRAINT projects_bounds CHECK (
  length(btrim(title)) BETWEEN 1 AND 120 AND length(btrim(description)) BETWEEN 1 AND 10000 AND
  max_members BETWEEN 2 AND 20 AND version>0 AND length(industry)<=120 AND length(location)<=120 AND
  (is_remote OR length(btrim(location))>0));
ALTER TABLE public.applications DROP CONSTRAINT applications_status_check;
ALTER TABLE public.applications ADD CONSTRAINT applications_status_check CHECK(status IN ('pending','accepted','rejected','closed'));
ALTER TABLE public.applications ALTER COLUMN project_id SET NOT NULL, ALTER COLUMN applicant_id SET NOT NULL,
  ALTER COLUMN message SET NOT NULL, ALTER COLUMN status SET NOT NULL, ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.applications ADD CONSTRAINT applications_message_length CHECK(length(btrim(message)) BETWEEN 1 AND 2000);
ALTER TABLE public.applications ADD CONSTRAINT applications_once UNIQUE(project_id,applicant_id);
ALTER TABLE public.applications ADD CONSTRAINT applications_identity UNIQUE(id,project_id,applicant_id);
ALTER TABLE public.applications ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN decided_at timestamptz, ADD COLUMN decided_by uuid REFERENCES public.users(id), ADD COLUMN decision_reason text;
-- Existing terminal decisions, if present, were made by the project owner.
UPDATE public.applications a SET decided_at=a.created_at,decided_by=p.owner_id,decision_reason='legacy_decision'
FROM public.projects p WHERE a.project_id=p.id AND a.status<>'pending';
ALTER TABLE public.applications ADD CONSTRAINT applications_decision_metadata CHECK (
  (status='pending' AND decided_at IS NULL AND decided_by IS NULL AND decision_reason IS NULL) OR
  (status<>'pending' AND decided_at IS NOT NULL AND decided_by IS NOT NULL AND decision_reason IS NOT NULL));

CREATE TABLE public.skills (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 80));
CREATE UNIQUE INDEX skills_name_unique ON public.skills(lower(name));
CREATE TABLE public.project_skills (project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE, skill_id uuid NOT NULL REFERENCES public.skills(id), PRIMARY KEY(project_id,skill_id));
CREATE TABLE public.user_skills (user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, skill_id uuid NOT NULL REFERENCES public.skills(id), PRIMARY KEY(user_id,skill_id));
INSERT INTO public.skills(name)
SELECT DISTINCT ON (lower(btrim(s))) btrim(s) FROM (
 SELECT unnest(skills) s FROM public.users UNION ALL SELECT unnest(skills_needed) FROM public.projects
) values_ WHERE btrim(s)<>'' ORDER BY lower(btrim(s)),btrim(s);
INSERT INTO public.project_skills SELECT DISTINCT p.id,s.id FROM public.projects p CROSS JOIN LATERAL unnest(p.skills_needed) n JOIN public.skills s ON lower(s.name)=lower(btrim(n));
INSERT INTO public.user_skills SELECT DISTINCT u.id,s.id FROM public.users u CROSS JOIN LATERAL unnest(u.skills) n JOIN public.skills s ON lower(s.name)=lower(btrim(n));
ALTER TABLE public.projects DROP COLUMN skills_needed;
ALTER TABLE public.users DROP COLUMN skills;
CREATE TABLE public.project_members (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK(role IN ('owner','collaborator')),
  application_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id,user_id),
  CONSTRAINT membership_application FOREIGN KEY(application_id,project_id,user_id) REFERENCES public.applications(id,project_id,applicant_id),
  CONSTRAINT membership_source CHECK((role='owner' AND application_id IS NULL) OR (role='collaborator' AND application_id IS NOT NULL))
);
CREATE UNIQUE INDEX project_single_owner ON public.project_members(project_id) WHERE role='owner';
INSERT INTO public.project_members(project_id,user_id,role) SELECT id,owner_id,'owner' FROM public.projects;
INSERT INTO public.project_members(project_id,user_id,role,application_id) SELECT project_id,applicant_id,'collaborator',id FROM public.applications WHERE status='accepted';
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.projects p WHERE (SELECT count(*) FROM public.project_members m WHERE m.project_id=p.id)>p.max_members) THEN RAISE EXCEPTION 'Existing memberships exceed capacity; resolve before migration'; END IF;
END $$;

CREATE INDEX projects_feed ON public.projects(status,created_at DESC,id DESC);
CREATE INDEX projects_owner_feed ON public.projects(owner_id,created_at DESC,id DESC);
CREATE INDEX applications_project_feed ON public.applications(project_id,created_at DESC,id DESC);
CREATE INDEX applications_applicant_feed ON public.applications(applicant_id,created_at DESC,id DESC);
CREATE INDEX applications_project_status ON public.applications(project_id,status);
CREATE INDEX applications_decider ON public.applications(decided_by);
CREATE INDEX project_members_user ON public.project_members(user_id);
CREATE INDEX project_skills_skill ON public.project_skills(skill_id,project_id);
CREATE INDEX user_skills_skill ON public.user_skills(skill_id,user_id);
CREATE INDEX messages_sender ON public.messages(sender_id);
CREATE INDEX messages_receiver ON public.messages(receiver_id);
CREATE INDEX messages_project ON public.messages(project_id);
CREATE INDEX reviews_reviewer ON public.reviews(reviewer_id);
CREATE INDEX reviews_reviewee ON public.reviews(reviewee_id);
CREATE INDEX reviews_project ON public.reviews(project_id);
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE INDEX projects_title_search ON public.projects USING gin(title extensions.gin_trgm_ops);
CREATE INDEX projects_description_search ON public.projects USING gin(description extensions.gin_trgm_ops);
CREATE INDEX skills_search ON public.skills USING gin(name extensions.gin_trgm_ops);

DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='devmate_api') THEN CREATE ROLE devmate_api NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF;
END $$;
GRANT USAGE ON SCHEMA public,private TO devmate_api;
-- Auth service initialization may replace grants on its managed schema. Keep
-- application identity resolution independent of permissions on auth.*.
CREATE FUNCTION private.actor_id() RETURNS uuid LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT (NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
REVOKE ALL ON FUNCTION private.actor_id() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.actor_id() TO devmate_api;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA private REVOKE ALL ON FUNCTIONS FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.users,public.projects,public.applications,public.project_members,public.skills,public.project_skills,public.user_skills TO devmate_api;
GRANT INSERT ON public.projects,public.applications,public.project_members,public.project_skills,public.user_skills TO devmate_api;
GRANT UPDATE(name,bio,location,github_url,linkedin_url) ON public.users TO devmate_api;
GRANT UPDATE(title,description,type,experience_level,industry,is_remote,location,max_members,status) ON public.projects TO devmate_api;
GRANT UPDATE(status) ON public.applications TO devmate_api;
GRANT DELETE ON public.project_skills,public.user_skills TO devmate_api;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_read ON public.users FOR SELECT TO devmate_api USING(true);
CREATE POLICY users_edit ON public.users FOR UPDATE TO devmate_api USING(id=(SELECT private.actor_id())) WITH CHECK(id=(SELECT private.actor_id()));
CREATE POLICY projects_read ON public.projects FOR SELECT TO devmate_api USING(true);
CREATE POLICY projects_create ON public.projects FOR INSERT TO devmate_api WITH CHECK(owner_id=(SELECT private.actor_id()) AND status='open');
CREATE POLICY projects_edit ON public.projects FOR UPDATE TO devmate_api USING(owner_id=(SELECT private.actor_id())) WITH CHECK(owner_id=(SELECT private.actor_id()));
CREATE POLICY applications_read ON public.applications FOR SELECT TO devmate_api USING(applicant_id=(SELECT private.actor_id()) OR EXISTS(SELECT 1 FROM public.projects p WHERE p.id=project_id AND p.owner_id=(SELECT private.actor_id())));
CREATE POLICY applications_create ON public.applications FOR INSERT TO devmate_api WITH CHECK(applicant_id=(SELECT private.actor_id()) AND status='pending');
CREATE POLICY applications_decide ON public.applications FOR UPDATE TO devmate_api USING(EXISTS(SELECT 1 FROM public.projects p WHERE p.id=project_id AND p.owner_id=(SELECT private.actor_id()))) WITH CHECK(EXISTS(SELECT 1 FROM public.projects p WHERE p.id=project_id AND p.owner_id=(SELECT private.actor_id())));
CREATE POLICY members_read ON public.project_members FOR SELECT TO devmate_api USING(true);
CREATE POLICY members_create ON public.project_members FOR INSERT TO devmate_api WITH CHECK(EXISTS(SELECT 1 FROM public.projects p WHERE p.id=project_id AND p.owner_id=(SELECT private.actor_id())));
CREATE POLICY skills_read ON public.skills FOR SELECT TO devmate_api USING(true);
CREATE POLICY project_skills_read ON public.project_skills FOR SELECT TO devmate_api USING(true);
CREATE POLICY project_skills_create ON public.project_skills FOR INSERT TO devmate_api WITH CHECK(EXISTS(SELECT 1 FROM public.projects p WHERE p.id=project_id AND p.owner_id=(SELECT private.actor_id()) AND p.status IN ('open','in-progress')));
CREATE POLICY project_skills_delete ON public.project_skills FOR DELETE TO devmate_api USING(EXISTS(SELECT 1 FROM public.projects p WHERE p.id=project_id AND p.owner_id=(SELECT private.actor_id()) AND p.status IN ('open','in-progress')));
CREATE POLICY user_skills_read ON public.user_skills FOR SELECT TO devmate_api USING(true);
CREATE POLICY user_skills_create ON public.user_skills FOR INSERT TO devmate_api WITH CHECK(user_id=(SELECT private.actor_id()));
CREATE POLICY user_skills_delete ON public.user_skills FOR DELETE TO devmate_api USING(user_id=(SELECT private.actor_id()));

CREATE FUNCTION private.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.users(id,name) VALUES(NEW.id,left(COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'name'),''),'New member'),80));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC,anon,authenticated,devmate_api;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();
-- Applicants must serialize with owner actions, but must never receive UPDATE
-- privileges/policies on other people's projects. This narrowly scoped function
-- only locks a public project row; it cannot modify it or select private data.
CREATE FUNCTION private.lock_project(project uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF private.actor_id() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.projects WHERE id=project FOR UPDATE;
END $$;
REVOKE ALL ON FUNCTION private.lock_project(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.lock_project(uuid) TO devmate_api;
CREATE FUNCTION private.guard_project() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.owner_id<>OLD.owner_id OR NEW.id<>OLD.id OR NEW.created_at<>OLD.created_at THEN RAISE EXCEPTION 'Project identity is immutable'; END IF;
  IF OLD.status IN ('closed','completed') THEN RAISE EXCEPTION 'Project is final'; END IF;
  IF NEW.max_members<>OLD.max_members AND OLD.status<>'open' THEN RAISE EXCEPTION 'Recruitment is closed'; END IF;
  IF NEW.status<>OLD.status AND NOT ((OLD.status='open' AND NEW.status IN ('in-progress','closed')) OR (OLD.status='in-progress' AND NEW.status IN ('completed','closed'))) THEN RAISE EXCEPTION 'Invalid project transition'; END IF;
  IF (SELECT count(*) FROM public.project_members WHERE project_id=OLD.id)>NEW.max_members THEN RAISE EXCEPTION 'Capacity below membership'; END IF;
  NEW.version=OLD.version+1;
 ELSE
  IF NEW.status<>'open' THEN RAISE EXCEPTION 'New project must be open'; END IF;
  NEW.version=1;
 END IF;
 NEW.updated_at=now();
 IF NEW.status='in-progress' THEN NEW.started_at=COALESCE(NEW.started_at,now()); END IF;
 IF NEW.status='completed' THEN NEW.completed_at=now(); END IF;
 IF NEW.status='closed' THEN NEW.closed_at=now(); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_project BEFORE INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION private.guard_project();
CREATE FUNCTION private.project_changed() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO public.project_members(project_id,user_id,role) VALUES(NEW.id,NEW.owner_id,'owner');
 ELSIF OLD.status='open' AND NEW.status<>'open' THEN
  UPDATE public.applications SET status='closed' WHERE project_id=NEW.id AND status='pending';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER project_changed AFTER INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION private.project_changed();
CREATE FUNCTION private.guard_application() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE p public.projects;
BEGIN
 PERFORM private.lock_project(NEW.project_id);
 SELECT * INTO p FROM public.projects WHERE id=NEW.project_id;
 IF p.id IS NULL THEN RAISE EXCEPTION 'Project missing' USING ERRCODE='23503'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'pending' OR NEW.applicant_id IS DISTINCT FROM private.actor_id() OR p.owner_id=NEW.applicant_id OR p.status<>'open' THEN RAISE EXCEPTION 'Application not allowed'; END IF;
  IF (SELECT count(*) FROM public.project_members WHERE project_id=p.id)>=p.max_members THEN RAISE EXCEPTION 'Project full'; END IF;
  NEW.decided_at=NULL; NEW.decided_by=NULL; NEW.decision_reason=NULL;
 ELSE
  IF NEW.project_id<>OLD.project_id OR NEW.applicant_id<>OLD.applicant_id OR NEW.id<>OLD.id OR NEW.message<>OLD.message OR NEW.created_at<>OLD.created_at THEN RAISE EXCEPTION 'Application identity/content is immutable'; END IF;
  IF OLD.status<>'pending' THEN RAISE EXCEPTION 'Decision is final'; END IF;
  IF p.owner_id IS DISTINCT FROM private.actor_id() THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
  IF NEW.status IN ('accepted','rejected') THEN
   IF p.status<>'open' THEN RAISE EXCEPTION 'Recruitment closed'; END IF;
   IF NEW.status='accepted' AND (SELECT count(*) FROM public.project_members WHERE project_id=p.id)>=p.max_members THEN RAISE EXCEPTION 'Project full'; END IF;
   NEW.decision_reason='owner_decision';
  ELSIF NEW.status='closed' AND p.status<>'open' THEN NEW.decision_reason='project_'||p.status;
  ELSE RAISE EXCEPTION 'Invalid decision'; END IF;
  NEW.decided_at=now(); NEW.decided_by=private.actor_id();
 END IF;
 NEW.updated_at=now(); RETURN NEW;
END $$;
CREATE TRIGGER guard_application BEFORE INSERT OR UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION private.guard_application();
CREATE FUNCTION private.accepted_membership() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.status='accepted' THEN INSERT INTO public.project_members(project_id,user_id,role,application_id) VALUES(NEW.project_id,NEW.applicant_id,'collaborator',NEW.id); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER accepted_membership AFTER UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION private.accepted_membership();
CREATE FUNCTION private.guard_member() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE p public.projects;
BEGIN
 PERFORM private.lock_project(NEW.project_id);
 SELECT * INTO p FROM public.projects WHERE id=NEW.project_id;
 IF p.owner_id IS DISTINCT FROM private.actor_id() THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
 IF NEW.role='owner' THEN
  IF NEW.user_id<>p.owner_id THEN RAISE EXCEPTION 'Invalid owner member'; END IF;
 ELSE
  IF NEW.user_id=p.owner_id OR NOT EXISTS(SELECT 1 FROM public.applications WHERE id=NEW.application_id AND project_id=NEW.project_id AND applicant_id=NEW.user_id AND status='accepted') THEN RAISE EXCEPTION 'Accepted application required'; END IF;
 END IF;
 IF (SELECT count(*) FROM public.project_members WHERE project_id=p.id)>=p.max_members THEN RAISE EXCEPTION 'Project full'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_member BEFORE INSERT ON public.project_members FOR EACH ROW EXECUTE FUNCTION private.guard_member();
CREATE FUNCTION private.check_membership() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE target uuid;
BEGIN
 IF TG_TABLE_NAME='projects' THEN target=NEW.id; ELSE target=NEW.project_id; END IF;
 IF EXISTS(SELECT 1 FROM public.projects p WHERE p.id=target AND NOT EXISTS(SELECT 1 FROM public.project_members m WHERE m.project_id=p.id AND m.user_id=p.owner_id AND m.role='owner'))
 OR EXISTS(SELECT 1 FROM public.applications a WHERE a.project_id=target AND a.status='accepted' AND NOT EXISTS(SELECT 1 FROM public.project_members m WHERE m.application_id=a.id)) THEN RAISE EXCEPTION 'Membership is inconsistent'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER project_membership_consistency AFTER INSERT OR UPDATE ON public.projects DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.check_membership();
CREATE CONSTRAINT TRIGGER accepted_membership_consistency AFTER INSERT OR UPDATE ON public.applications DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.check_membership();
CREATE FUNCTION private.profile_updated() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE TRIGGER profile_updated BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION private.profile_updated();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC,anon,authenticated;
COMMIT;
