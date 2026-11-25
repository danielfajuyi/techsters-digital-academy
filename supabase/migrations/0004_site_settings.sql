-- Run in the Supabase SQL editor (safe to re-run).
-- 1) Editable homepage copy (Admin → Settings → Homepage)
insert into public.platform_settings (key, value, is_public) values
  ('home', '{"hero_title":"Digital skills that grow your career, business or brand.","hero_subtitle":"Hands-on training in web design, branding, social media and AI automation, taught by the team at Techsters Digital Agency. Start free, pay only for the courses you want.","banner":""}', true)
on conflict (key) do nothing;

update public.platform_settings set value = jsonb_build_object('name','Techsters Academy','tagline','Digital skills training by Techsters Digital Agency','email','info@techsters.com.ng','currency','NGN')
where key = 'academy' and value ->> 'email' = 'hello@techsters.academy';

-- 2) A few more FAQs (skipped if the question already exists)
insert into public.faqs (question, answer, position)
select v.q, v.a, v.p from (values
  ('Are the courses live or self-paced?', 'Courses are self-paced, so you can learn when it suits you. Lessons, quizzes and assignments are all inside your dashboard, and instructors give written feedback on assignments.', 5),
  ('Who teaches the courses?', 'The Academy is run by Techsters Digital Agency, a team of designers, developers and marketers based in Abuja, Nigeria and South Wales, UK. Courses are taught by practising professionals.', 6),
  ('Can my team or company enrol together?', 'Yes. Contact us with the number of people and the skills you need, and we will arrange team access or a tailored training programme.', 7),
  ('Do I need to be in Nigeria to join?', 'No. The courses are online and open to learners anywhere. Prices are shown in Naira and payment is processed securely by Paystack.', 8)
) as v(q, a, p)
where not exists (select 1 from public.faqs f where f.question = v.q);

-- 3) Newsletter subscribers (collected from the website footer; readable by admins via the API only)
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  created_at timestamptz not null default now()
);
alter table public.newsletter_subscribers enable row level security;
