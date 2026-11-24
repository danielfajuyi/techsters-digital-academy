-- ============================================================================
-- Techsters Academy: MASTER SUPABASE SCRIPT
-- ============================================================================
-- Run this ONCE in the Supabase SQL Editor.
-- It sets up everything: Schema, RLS, Helper Functions, Auth Hooks,
-- Storage Buckets, Storage Policies, and Starter Seeds.
-- Safe to re-run (idempotent).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. EXTENSIONS & TYPES
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;
create extension if not exists citext;

do $$ begin
  create type public.app_role as enum ('student', 'instructor', 'admin');
exception
  when duplicate_object then null;
end $$;

create sequence if not exists public.certificate_seq start 1000;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CORE TABLES & TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext not null unique,
  full_name text not null default '',
  avatar_url text,
  headline text,
  bio text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists profiles_updated on public.profiles;
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

-- User Roles
create table if not exists public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- User Settings
create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email_notifications boolean not null default true,
  marketing_emails boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Course Categories
create table if not exists public.course_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  position int not null default 0
);

-- Courses
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  description text not null default '',            -- sanitised HTML
  thumbnail_url text,
  category_id uuid references public.course_categories (id) on delete set null,
  level text not null default 'beginner' check (level in ('beginner','intermediate','advanced')),
  language text not null default 'English',
  price_minor bigint not null default 0 check (price_minor >= 0),          -- kobo; 0 = free
  compare_at_minor bigint check (compare_at_minor is null or compare_at_minor >= 0), -- strike-through price
  currency text not null default 'NGN',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  is_featured boolean not null default false,
  certificate_enabled boolean not null default true,
  access_days int check (access_days is null or access_days > 0),          -- null = lifetime
  created_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists courses_status_idx on public.courses (status, is_featured);
create index if not exists courses_category_idx on public.courses (category_id);
drop trigger if exists courses_updated on public.courses;
create trigger courses_updated before update on public.courses for each row execute function public.set_updated_at();

-- Course Instructors
create table if not exists public.course_instructors (
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (course_id, user_id)
);
create index if not exists course_instructors_user_idx on public.course_instructors (user_id);

-- Course Requirements / Outcomes
create table if not exists public.course_requirements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  kind text not null default 'requirement' check (kind in ('requirement','outcome')),
  body text not null,
  position int not null default 0
);
create index if not exists course_requirements_course_idx on public.course_requirements (course_id);

-- Course Modules
create table if not exists public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  position int not null default 0
);
create index if not exists course_modules_course_idx on public.course_modules (course_id, position);

-- Lessons
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  type text not null default 'video' check (type in ('video','text','quiz','assignment')),
  duration_seconds int not null default 0 check (duration_seconds >= 0),
  is_preview boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists lessons_course_idx on public.lessons (course_id, position);
create index if not exists lessons_module_idx on public.lessons (module_id, position);

create or replace function public.lessons_set_course() returns trigger language plpgsql as $$
begin
  select course_id into new.course_id from public.course_modules where id = new.module_id;
  return new;
end $$;
drop trigger if exists lessons_course_sync on public.lessons;
create trigger lessons_course_sync before insert or update of module_id on public.lessons
  for each row execute function public.lessons_set_course();

-- Lesson Content (Gated)
create table if not exists public.lesson_content (
  lesson_id uuid primary key references public.lessons (id) on delete cascade,
  video_provider text check (video_provider in ('youtube','vimeo','bunny','mux','storage','external')),
  video_url text,
  body_html text
);

-- Lesson Resources
create table if not exists public.lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  name text not null,
  storage_path text not null,
  size_bytes bigint,
  mime_type text,
  created_at timestamptz not null default now()
);
create index if not exists lesson_resources_lesson_idx on public.lesson_resources (lesson_id);

-- Reviews
create table if not exists public.course_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (course_id, user_id)
);

-- Coupons
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code citext not null unique,
  percent_off int check (percent_off between 1 and 100),
  amount_off_minor bigint check (amount_off_minor > 0),
  course_id uuid references public.courses (id) on delete cascade,
  max_redemptions int,
  redeemed_count int not null default 0,
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((percent_off is not null) <> (amount_off_minor is not null))
);

-- Orders
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  user_id uuid not null references public.profiles (id) on delete restrict,
  course_id uuid not null references public.courses (id) on delete restrict,
  coupon_id uuid references public.coupons (id) on delete set null,
  list_price_minor bigint not null,
  discount_minor bigint not null default 0,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null default 'NGN',
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded','abandoned')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status, created_at desc);
create unique index if not exists orders_one_pending_idx on public.orders (user_id, course_id) where status = 'pending';

-- Payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider text not null default 'paystack',
  provider_ref text not null,
  amount_minor bigint not null,
  currency text not null,
  channel text,
  status text not null check (status in ('success','failed')),
  paid_at timestamptz,
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_ref)
);

-- Payment Transactions (Webhook Log)
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'paystack',
  event_id text,
  event_type text not null,
  reference text,
  payload jsonb not null,
  processed boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists payment_tx_event_idx on public.payment_transactions (provider, event_id) where event_id is not null;

-- Refunds
create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  reason text,
  provider_ref text,
  status text not null default 'pending' check (status in ('pending','processed','failed')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Enrollments
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  status text not null default 'active' check (status in ('active','completed','revoked')),
  source text not null default 'free' check (source in ('free','purchase','manual')),
  order_id uuid references public.orders (id) on delete set null,
  enrolled_at timestamptz not null default now(),
  expires_at timestamptz,
  completed_at timestamptz,
  unique (user_id, course_id)
);
create index if not exists enrollments_course_idx on public.enrollments (course_id);

-- Lesson Progress
create table if not exists public.lesson_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  completed boolean not null default false,
  last_position_seconds int not null default 0,
  completed_at timestamptz,
  last_accessed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index if not exists lesson_progress_course_idx on public.lesson_progress (user_id, course_id);

-- Course Progress
create table if not exists public.course_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  completed_lessons int not null default 0,
  total_lessons int not null default 0,
  percent numeric(5,2) not null default 0,
  last_lesson_id uuid references public.lessons (id) on delete set null,
  last_accessed_at timestamptz,
  completed_at timestamptz,
  primary key (user_id, course_id)
);

-- Bookmarks
create table if not exists public.bookmarks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

-- Notes
create table if not exists public.learning_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  body text not null,
  video_second int,
  created_at timestamptz not null default now()
);
create index if not exists learning_notes_idx on public.learning_notes (user_id, lesson_id);

-- Quizzes
create table if not exists public.quizzes (
  lesson_id uuid primary key references public.lessons (id) on delete cascade,
  passing_score int not null default 70 check (passing_score between 1 and 100),
  time_limit_minutes int check (time_limit_minutes is null or time_limit_minutes > 0),
  max_attempts int check (max_attempts is null or max_attempts > 0),
  is_required boolean not null default true
);

-- Quiz Questions
create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.quizzes (lesson_id) on delete cascade,
  type text not null check (type in ('single','multiple','true_false')),
  prompt text not null,
  options jsonb not null default '[]',
  correct jsonb not null default '[]',
  explanation text,
  points int not null default 1 check (points > 0),
  position int not null default 0
);
create index if not exists quiz_questions_idx on public.quiz_questions (lesson_id, position);

-- Quiz Attempts
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.quizzes (lesson_id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  answers jsonb not null default '{}',
  score_percent numeric(5,2),
  passed boolean,
  started_at timestamptz not null default now(),
  submitted_at timestamptz
);
create index if not exists quiz_attempts_idx on public.quiz_attempts (user_id, lesson_id);

-- Assignments
create table if not exists public.assignments (
  lesson_id uuid primary key references public.lessons (id) on delete cascade,
  instructions text not null default '',
  due_at timestamptz,
  max_score int not null default 100,
  allow_resubmission boolean not null default true,
  is_required boolean not null default true
);

-- Assignment Submissions
create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.assignments (lesson_id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  text_body text,
  file_path text,
  status text not null default 'submitted' check (status in ('submitted','graded','returned')),
  score int,
  feedback text,
  graded_by uuid references public.profiles (id) on delete set null,
  submitted_at timestamptz not null default now(),
  graded_at timestamptz,
  unique (lesson_id, user_id)
);

-- Certificates
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_no text not null unique,
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  recipient_name text not null,
  course_title text not null,
  issued_at timestamptz not null default now(),
  pdf_path text,
  unique (user_id, course_id)
);

-- Announcements
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists announcements_course_idx on public.announcements (course_id, created_at desc);

-- Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- Discussions
create table if not exists public.discussions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.discussions (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists discussions_lesson_idx on public.discussions (lesson_id, created_at);

-- Support Tickets
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open','pending','closed')),
  admin_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Contact Messages
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null, email text not null, message text not null,
  created_at timestamptz not null default now()
);

-- Audit Logs
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  metadata jsonb not null default '{}',
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_idx on public.audit_logs (created_at desc);

-- Platform Settings
create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Instructor Applications
create table if not exists public.instructor_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  expertise text not null,
  pitch text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists instructor_app_pending_idx on public.instructor_applications (user_id) where status = 'pending';

-- Testimonials
create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  name text not null, role text, quote text not null, avatar_url text,
  is_published boolean not null default true, position int not null default 0
);

-- FAQs
create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null, answer text not null,
  is_published boolean not null default true, position int not null default 0
);

-- Blog Posts
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique, title text not null, excerpt text, body_html text not null default '',
  cover_url text, author_id uuid references public.profiles (id) on delete set null,
  is_published boolean not null default false, published_at timestamptz,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. AUTH HOOK: USER SIGNUP (SUPABASE AUTH -> PUBLIC.PROFILES)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  ) on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'student') on conflict do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ROLE & PERMISSION HELPERS
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.has_role(uid uuid, r public.app_role) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.user_roles where user_id = uid and role = r) $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select public.has_role(auth.uid(), 'admin') $$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as
$$ select public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'instructor') $$;

create or replace function public.can_manage_course(cid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select public.is_admin() or exists (select 1 from public.course_instructors where course_id = cid and user_id = auth.uid()) $$;

create or replace function public.is_enrolled(cid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.enrollments e
   where e.user_id = auth.uid() and e.course_id = cid and e.status in ('active','completed')
     and (e.expires_at is null or e.expires_at > now())) $$;

create or replace function public.course_is_published(cid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.courses where id = cid and status = 'published') $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable RLS across all public tables
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Public Instructors View
create or replace view public.public_instructors with (security_invoker = false) as
  select p.id, p.full_name, p.avatar_url, p.headline, p.bio
  from public.profiles p join public.user_roles r on r.user_id = p.id and r.role = 'instructor'
  where p.is_active;
grant select on public.public_instructors to anon, authenticated;

-- Profiles
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (full_name, avatar_url, headline, bio, phone) on public.profiles to authenticated;

-- Roles & Settings
drop policy if exists roles_self_read on public.user_roles;
create policy roles_self_read on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists settings_self_all on public.user_settings;
create policy settings_self_all on public.user_settings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Catalogue Policies
drop policy if exists categories_read on public.course_categories;
create policy categories_read on public.course_categories for select to anon, authenticated using (true);

drop policy if exists courses_read on public.courses;
create policy courses_read on public.courses for select to anon, authenticated
  using (status = 'published' or public.can_manage_course(id));

drop policy if exists modules_read on public.course_modules;
create policy modules_read on public.course_modules for select to anon, authenticated
  using (public.course_is_published(course_id) or public.can_manage_course(course_id));

drop policy if exists lessons_read on public.lessons;
create policy lessons_read on public.lessons for select to anon, authenticated
  using (public.course_is_published(course_id) or public.can_manage_course(course_id));

drop policy if exists requirements_read on public.course_requirements;
create policy requirements_read on public.course_requirements for select to anon, authenticated
  using (public.course_is_published(course_id) or public.can_manage_course(course_id));

drop policy if exists course_instructors_read on public.course_instructors;
create policy course_instructors_read on public.course_instructors for select to anon, authenticated
  using (public.course_is_published(course_id) or public.can_manage_course(course_id));

drop policy if exists reviews_read on public.course_reviews;
create policy reviews_read on public.course_reviews for select to anon, authenticated using (public.course_is_published(course_id));

-- Gated Learning Material
drop policy if exists lesson_content_read on public.lesson_content;
create policy lesson_content_read on public.lesson_content for select to authenticated using (
  exists (select 1 from public.lessons l where l.id = lesson_id
          and (l.is_preview or public.is_enrolled(l.course_id) or public.can_manage_course(l.course_id))));

drop policy if exists resources_read on public.lesson_resources;
create policy resources_read on public.lesson_resources for select to authenticated
  using (public.is_enrolled(course_id) or public.can_manage_course(course_id));

drop policy if exists quizzes_read on public.quizzes;
create policy quizzes_read on public.quizzes for select to authenticated using (
  exists (select 1 from public.lessons l where l.id = lesson_id and (public.is_enrolled(l.course_id) or public.can_manage_course(l.course_id))));

drop policy if exists quiz_questions_staff on public.quiz_questions;
create policy quiz_questions_staff on public.quiz_questions for select to authenticated using (
  exists (select 1 from public.lessons l where l.id = lesson_id and public.can_manage_course(l.course_id)));

drop policy if exists assignments_read on public.assignments;
create policy assignments_read on public.assignments for select to authenticated using (
  exists (select 1 from public.lessons l where l.id = lesson_id and (public.is_enrolled(l.course_id) or public.can_manage_course(l.course_id))));

-- User's Learning Data
drop policy if exists enrollments_read on public.enrollments;
create policy enrollments_read on public.enrollments for select to authenticated
  using (user_id = auth.uid() or public.can_manage_course(course_id));

drop policy if exists lesson_progress_read on public.lesson_progress;
create policy lesson_progress_read on public.lesson_progress for select to authenticated using (user_id = auth.uid() or public.can_manage_course(course_id));

drop policy if exists course_progress_read on public.course_progress;
create policy course_progress_read on public.course_progress for select to authenticated using (user_id = auth.uid() or public.can_manage_course(course_id));

drop policy if exists bookmarks_own on public.bookmarks;
create policy bookmarks_own on public.bookmarks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_enrolled(course_id));

drop policy if exists notes_own on public.learning_notes;
create policy notes_own on public.learning_notes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists quiz_attempts_read on public.quiz_attempts;
create policy quiz_attempts_read on public.quiz_attempts for select to authenticated using (
  user_id = auth.uid() or exists (select 1 from public.lessons l where l.id = lesson_id and public.can_manage_course(l.course_id)));

drop policy if exists submissions_read on public.assignment_submissions;
create policy submissions_read on public.assignment_submissions for select to authenticated using (
  user_id = auth.uid() or exists (select 1 from public.lessons l where l.id = lesson_id and public.can_manage_course(l.course_id)));

drop policy if exists certificates_read on public.certificates;
create policy certificates_read on public.certificates for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Payments Policies
drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select to authenticated using (
  public.is_admin() or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

drop policy if exists refunds_admin on public.refunds;
create policy refunds_admin on public.refunds for select to authenticated using (public.is_admin());

drop policy if exists coupons_admin on public.coupons;
create policy coupons_admin on public.coupons for select to authenticated using (public.is_admin());

drop policy if exists payment_tx_admin on public.payment_transactions;
create policy payment_tx_admin on public.payment_transactions for select to authenticated using (public.is_admin());

-- Communication Policies
drop policy if exists announcements_read on public.announcements;
create policy announcements_read on public.announcements for select to authenticated using (
  course_id is null or public.is_enrolled(course_id) or public.can_manage_course(course_id));

drop policy if exists notifications_own_read on public.notifications;
create policy notifications_own_read on public.notifications for select to authenticated using (user_id = auth.uid());

drop policy if exists notifications_own_update on public.notifications;
create policy notifications_own_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

drop policy if exists discussions_read on public.discussions;
create policy discussions_read on public.discussions for select to authenticated using (public.is_enrolled(course_id) or public.can_manage_course(course_id));

drop policy if exists discussions_insert on public.discussions;
create policy discussions_insert on public.discussions for insert to authenticated
  with check (user_id = auth.uid() and (public.is_enrolled(course_id) or public.can_manage_course(course_id)));

drop policy if exists discussions_delete on public.discussions;
create policy discussions_delete on public.discussions for delete to authenticated using (user_id = auth.uid() or public.can_manage_course(course_id));

drop policy if exists tickets_own on public.support_tickets;
create policy tickets_own on public.support_tickets for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists tickets_insert on public.support_tickets;
create policy tickets_insert on public.support_tickets for insert to authenticated with check (user_id = auth.uid());

-- Admin & Content Policies
drop policy if exists audit_admin on public.audit_logs;
create policy audit_admin on public.audit_logs for select to authenticated using (public.is_admin());

drop policy if exists settings_public on public.platform_settings;
create policy settings_public on public.platform_settings for select to anon, authenticated using (is_public or public.is_admin());

drop policy if exists applications_own on public.instructor_applications;
create policy applications_own on public.instructor_applications for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists testimonials_read on public.testimonials;
create policy testimonials_read on public.testimonials for select to anon, authenticated using (is_published or public.is_admin());

drop policy if exists faqs_read on public.faqs;
create policy faqs_read on public.faqs for select to anon, authenticated using (is_published or public.is_admin());

drop policy if exists blog_read on public.blog_posts;
create policy blog_read on public.blog_posts for select to anon, authenticated using (is_published or public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. BUSINESS LOGIC & STORED PROCEDURES
-- ─────────────────────────────────────────────────────────────────────────────

-- Progress calculation
create or replace function public.recompute_course_progress(p_user uuid, p_course uuid) returns void
language plpgsql security definer set search_path = public as $$
declare total int; done int; last_l uuid; pct numeric(5,2);
begin
  select count(*) into total from public.lessons where course_id = p_course;
  select count(*) into done from public.lesson_progress where user_id = p_user and course_id = p_course and completed;
  select lesson_id into last_l from public.lesson_progress where user_id = p_user and course_id = p_course order by last_accessed_at desc limit 1;
  pct := case when total = 0 then 0 else round(done * 100.0 / total, 2) end;
  insert into public.course_progress as cp (user_id, course_id, completed_lessons, total_lessons, percent, last_lesson_id, last_accessed_at, completed_at)
  values (p_user, p_course, done, total, pct, last_l, now(), case when pct >= 100 then now() end)
  on conflict (user_id, course_id) do update set
    completed_lessons = excluded.completed_lessons, total_lessons = excluded.total_lessons, percent = excluded.percent,
    last_lesson_id = excluded.last_lesson_id, last_accessed_at = excluded.last_accessed_at,
    completed_at = case when excluded.percent >= 100 then coalesce(cp.completed_at, now()) else null end;
  update public.enrollments set status = 'completed', completed_at = coalesce(completed_at, now())
    where user_id = p_user and course_id = p_course and status = 'active' and pct >= 100;
end $$;

create or replace function public.trg_lesson_progress() returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.recompute_course_progress(new.user_id, new.course_id); return new; end $$;
drop trigger if exists lesson_progress_sync on public.lesson_progress;
create trigger lesson_progress_sync after insert or update on public.lesson_progress
  for each row execute function public.trg_lesson_progress();

-- Enrollment procedure
create or replace function public.enroll_user(p_user uuid, p_course uuid, p_source text, p_order uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare eid uuid; days int;
begin
  select access_days into days from public.courses where id = p_course;
  insert into public.enrollments (user_id, course_id, source, order_id, expires_at)
  values (p_user, p_course, p_source, p_order, case when days is null then null else now() + make_interval(days => days) end)
  on conflict (user_id, course_id) do update
    set status = case when public.enrollments.status = 'revoked' then 'active' else public.enrollments.status end
  returning id into eid;
  perform public.recompute_course_progress(p_user, p_course);
  return eid;
end $$;

-- Atomic payment fulfillment
create or replace function public.fulfill_order(p_reference text, p_provider_ref text, p_amount bigint, p_currency text, p_channel text, p_raw jsonb)
returns table (order_id uuid, user_id uuid, course_id uuid, already_paid boolean)
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where reference = p_reference for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.status = 'paid' then
    return query select o.id, o.user_id, o.course_id, true; return;
  end if;
  if o.amount_minor <> p_amount or o.currency <> p_currency then raise exception 'amount_mismatch'; end if;

  update public.orders set status = 'paid', paid_at = now() where id = o.id;
  insert into public.payments (order_id, provider, provider_ref, amount_minor, currency, channel, status, paid_at, raw)
  values (o.id, 'paystack', p_provider_ref, p_amount, p_currency, p_channel, 'success', now(), p_raw)
  on conflict (provider, provider_ref) do nothing;
  if o.coupon_id is not null then update public.coupons set redeemed_count = redeemed_count + 1 where id = o.coupon_id; end if;
  perform public.enroll_user(o.user_id, o.course_id, 'purchase', o.id);
  insert into public.notifications (user_id, type, title, body, link)
  select o.user_id, 'enrollment', 'You''re enrolled', 'Payment received for ' || c.title || '. Start learning now.', '/learn/' || c.slug
  from public.courses c where c.id = o.course_id;
  return query select o.id, o.user_id, o.course_id, false;
end $$;

-- Certificate verification
create or replace function public.verify_certificate(p_no text)
returns table (certificate_no text, recipient_name text, course_title text, issued_at timestamptz)
language sql stable security definer set search_path = public as
$$ select certificate_no, recipient_name, course_title, issued_at from public.certificates where certificate_no = upper(trim(p_no)) $$;
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- Certificate number sequence accessor
create or replace function public.nextval_certificate() returns bigint language sql security definer set search_path = public as
$$ select nextval('public.certificate_seq') $$;

-- Revoke execute on privileged functions from client roles
revoke execute on function public.enroll_user(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.fulfill_order(text, text, bigint, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.recompute_course_progress(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.nextval_certificate() from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. STORAGE BUCKETS & STORAGE POLICIES
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars',               'avatars',               true,  2097152,   array['image/jpeg','image/png','image/webp']),
  ('course-thumbnails',     'course-thumbnails',     true,  5242880,   array['image/jpeg','image/png','image/webp']),
  ('course-resources',      'course-resources',      false, 52428800,  array['application/pdf','application/zip','image/jpeg','image/png','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation','video/mp4']),
  ('assignment-submissions','assignment-submissions',false, 20971520,  array['application/pdf','application/zip','image/jpeg','image/png','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('certificates',          'certificates',          false, 5242880,   array['application/pdf'])
on conflict (id) do nothing;

-- Avatars
drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists avatars_write on storage.objects;
create policy avatars_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Thumbnails
drop policy if exists thumbs_read on storage.objects;
create policy thumbs_read on storage.objects for select using (bucket_id = 'course-thumbnails');
drop policy if exists thumbs_write on storage.objects;
create policy thumbs_write on storage.objects for insert to authenticated with check (bucket_id = 'course-thumbnails' and public.is_staff());
drop policy if exists thumbs_update on storage.objects;
create policy thumbs_update on storage.objects for update to authenticated using (bucket_id = 'course-thumbnails' and public.is_staff());

-- Course Resources
drop policy if exists resources_staff_write on storage.objects;
create policy resources_staff_write on storage.objects for insert to authenticated with check (bucket_id = 'course-resources' and public.is_staff());

-- Assignment Submissions
drop policy if exists submissions_upload on storage.objects;
create policy submissions_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'assignment-submissions' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists submissions_read on storage.objects;
create policy submissions_read on storage.objects for select to authenticated
  using (bucket_id = 'assignment-submissions' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. PLATFORM SETTINGS & STARTER DATA (SEED)
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.platform_settings (key, value, is_public) values
  ('academy', '{"name":"Techsters Academy","tagline":"Learn skills that ship.","email":"hello@techsters.academy","currency":"NGN"}', true),
  ('instructors_can_publish', 'false', false),
  ('certificate', '{"signatory":"Director, Techsters Academy"}', false)
on conflict (key) do nothing;

insert into public.course_categories (slug, name, position) values
  ('web-development','Web Development',1),
  ('data','Data & Analytics',2),
  ('design','Product Design',3),
  ('cloud','Cloud & DevOps',4),
  ('career','Career Skills',5)
on conflict (slug) do nothing;

insert into public.faqs (question, answer, position) values
  ('How do I pay for a course?','Checkout runs on Paystack. You can pay by card, bank transfer or USSD, and you are enrolled as soon as the payment is confirmed.',1),
  ('How long do I have access?','Most courses give lifetime access. The access period is shown on each course page.',2),
  ('How do certificates work?','Finish every lesson, pass required quizzes and get required assignments graded. You can then claim a PDF certificate with a unique number that anyone can verify on our website.',3),
  ('Can I try a course first?','Yes. Look for lessons marked Preview on the course page. Some courses are free.',4)
on conflict do nothing;

-- ============================================================================
-- MASTER SCRIPT COMPLETE
-- ============================================================================
