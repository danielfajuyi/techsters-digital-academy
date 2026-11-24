-- Techsters Academy: core schema (PostgreSQL / Supabase)
-- Design rule: all privileged WRITES go through the Node API (service role).
-- RLS (0002) gives clients read access to what they own / are entitled to.

create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.app_role as enum ('student', 'instructor', 'admin');

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ───────────────────────── Users ─────────────────────────
create table public.profiles (
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
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email_notifications boolean not null default true,
  marketing_emails boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ───────────────────────── Catalogue ─────────────────────────
create table public.course_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  position int not null default 0
);

create table public.courses (
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
  compare_at_minor bigint check (compare_at_minor is null or compare_at_minor >= 0), -- strike-through price (promotional offer)
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
create index courses_status_idx on public.courses (status, is_featured);
create index courses_category_idx on public.courses (category_id);
create trigger courses_updated before update on public.courses for each row execute function public.set_updated_at();

create table public.course_instructors (
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (course_id, user_id)
);
create index course_instructors_user_idx on public.course_instructors (user_id);

create table public.course_requirements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  kind text not null default 'requirement' check (kind in ('requirement','outcome')),
  body text not null,
  position int not null default 0
);
create index course_requirements_course_idx on public.course_requirements (course_id);

create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  position int not null default 0
);
create index course_modules_course_idx on public.course_modules (course_id, position);

-- Lesson metadata is public for published courses. Sensitive material lives in lesson_content.
create table public.lessons (
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
create index lessons_course_idx on public.lessons (course_id, position);
create index lessons_module_idx on public.lessons (module_id, position);

create or replace function public.lessons_set_course() returns trigger language plpgsql as $$
begin
  select course_id into new.course_id from public.course_modules where id = new.module_id;
  return new;
end $$;
create trigger lessons_course_sync before insert or update of module_id on public.lessons
  for each row execute function public.lessons_set_course();

create table public.lesson_content (
  lesson_id uuid primary key references public.lessons (id) on delete cascade,
  video_provider text check (video_provider in ('youtube','vimeo','bunny','mux','storage','external')),
  video_url text,                 -- id/URL/storage path depending on provider
  body_html text                  -- sanitised HTML for text lessons
);

create table public.lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  name text not null,
  storage_path text not null,     -- path inside private bucket `course-resources`
  size_bytes bigint,
  mime_type text,
  created_at timestamptz not null default now()
);
create index lesson_resources_lesson_idx on public.lesson_resources (lesson_id);

create table public.course_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (course_id, user_id)
);

-- ───────────────────────── Payments ─────────────────────────
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code citext not null unique,
  percent_off int check (percent_off between 1 and 100),
  amount_off_minor bigint check (amount_off_minor > 0),
  course_id uuid references public.courses (id) on delete cascade,   -- null = all courses
  max_redemptions int,
  redeemed_count int not null default 0,
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((percent_off is not null) <> (amount_off_minor is not null))
);

create table public.orders (
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
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
-- at most one open (pending) order per user+course prevents duplicate checkouts
create unique index orders_one_pending_idx on public.orders (user_id, course_id) where status = 'pending';

create table public.payments (
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

create table public.payment_transactions (          -- webhook / verification event log (idempotency + audit trail)
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'paystack',
  event_id text,
  event_type text not null,
  reference text,
  payload jsonb not null,
  processed boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index payment_tx_event_idx on public.payment_transactions (provider, event_id) where event_id is not null;

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  reason text,
  provider_ref text,
  status text not null default 'pending' check (status in ('pending','processed','failed')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Learning ─────────────────────────
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  status text not null default 'active' check (status in ('active','completed','revoked')),
  source text not null default 'free' check (source in ('free','purchase','manual')),
  order_id uuid references public.orders (id) on delete set null,
  enrolled_at timestamptz not null default now(),
  expires_at timestamptz,
  completed_at timestamptz,
  unique (user_id, course_id)                     -- no duplicate enrollments, ever
);
create index enrollments_course_idx on public.enrollments (course_id);

create table public.lesson_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  completed boolean not null default false,
  last_position_seconds int not null default 0,
  completed_at timestamptz,
  last_accessed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index lesson_progress_course_idx on public.lesson_progress (user_id, course_id);

create table public.course_progress (
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

create table public.bookmarks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.learning_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  body text not null,
  video_second int,
  created_at timestamptz not null default now()
);
create index learning_notes_idx on public.learning_notes (user_id, lesson_id);

-- ───────────────────────── Assessments ─────────────────────────
create table public.quizzes (
  lesson_id uuid primary key references public.lessons (id) on delete cascade,
  passing_score int not null default 70 check (passing_score between 1 and 100),
  time_limit_minutes int check (time_limit_minutes is null or time_limit_minutes > 0),
  max_attempts int check (max_attempts is null or max_attempts > 0),
  is_required boolean not null default true
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.quizzes (lesson_id) on delete cascade,
  type text not null check (type in ('single','multiple','true_false')),
  prompt text not null,
  options jsonb not null default '[]',      -- [{ "id": "a", "text": "..." }]
  correct jsonb not null default '[]',      -- ["a"]  (never sent to students)
  explanation text,
  points int not null default 1 check (points > 0),
  position int not null default 0
);
create index quiz_questions_idx on public.quiz_questions (lesson_id, position);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.quizzes (lesson_id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  answers jsonb not null default '{}',
  score_percent numeric(5,2),
  passed boolean,
  started_at timestamptz not null default now(),
  submitted_at timestamptz
);
create index quiz_attempts_idx on public.quiz_attempts (user_id, lesson_id);

create table public.assignments (
  lesson_id uuid primary key references public.lessons (id) on delete cascade,
  instructions text not null default '',
  due_at timestamptz,
  max_score int not null default 100,
  allow_resubmission boolean not null default true,
  is_required boolean not null default true
);

create table public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.assignments (lesson_id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  text_body text,
  file_path text,                              -- inside private bucket `assignment-submissions`
  status text not null default 'submitted' check (status in ('submitted','graded','returned')),
  score int,
  feedback text,
  graded_by uuid references public.profiles (id) on delete set null,
  submitted_at timestamptz not null default now(),
  graded_at timestamptz,
  unique (lesson_id, user_id)
);

create sequence public.certificate_seq start 1000;
create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_no text not null unique,
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  recipient_name text not null,
  course_title text not null,
  issued_at timestamptz not null default now(),
  pdf_path text,                              -- inside private bucket `certificates`
  unique (user_id, course_id)
);

-- ───────────────────────── Communication ─────────────────────────
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses (id) on delete cascade,     -- null = academy-wide
  author_id uuid references public.profiles (id) on delete set null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index announcements_course_idx on public.announcements (course_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.discussions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.discussions (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index discussions_lesson_idx on public.discussions (lesson_id, created_at);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open','pending','closed')),
  admin_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null, email text not null, message text not null,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Administration & content ─────────────────────────
create table public.audit_logs (       -- also serves as admin_activity_logs
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  metadata jsonb not null default '{}',
  ip text,
  created_at timestamptz not null default now()
);
create index audit_logs_idx on public.audit_logs (created_at desc);

create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.instructor_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  expertise text not null,
  pitch text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index instructor_app_pending_idx on public.instructor_applications (user_id) where status = 'pending';

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  name text not null, role text, quote text not null, avatar_url text,
  is_published boolean not null default true, position int not null default 0
);

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null, answer text not null,
  is_published boolean not null default true, position int not null default 0
);

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique, title text not null, excerpt text, body_html text not null default '',
  cover_url text, author_id uuid references public.profiles (id) on delete set null,
  is_published boolean not null default false, published_at timestamptz,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Auth hook: profile on signup ─────────────────────────
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

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
