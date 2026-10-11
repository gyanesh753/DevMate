-- Non-sensitive development catalog. No passwords or production users.
INSERT INTO public.skills(name) VALUES ('React'),('Node.js'),('Python'),('PostgreSQL'),('MongoDB'),('TypeScript'),('JavaScript'),('Flutter'),('Swift'),('Figma'),('AWS'),('Docker') ON CONFLICT DO NOTHING;
