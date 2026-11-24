-- Role helpers. SECURITY DEFINER so policies can consult user_roles without recursion.
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

-- Enable RLS everywhere (no policy = no access for anon/authenticated; service role bypasses).
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ───── profiles: own row (limited columns writable), staff may read profiles of their students
create policy profiles_self_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (full_name, avatar_url, headline, bio, phone) on public.profiles to authenticated;

-- instructors are public-facing: expose only safe columns through a view
create view public.public_instructors with (security_invoker = false) as
  select p.id, p.full_name, p.avatar_url, p.headline, p.bio
  from public.profiles p join public.user_roles r on r.user_id = p.id and r.role = 'instructor'
  where p.is_active;
grant select on public.public_instructors to anon, authenticated;

create policy roles_self_read on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy settings_self_all on public.user_settings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───── public catalogue
create policy categories_read on public.course_categories for select to anon, authenticated using (true);
create policy courses_read on public.courses for select to anon, authenticated
  using (status = 'published' or public.can_manage_course(id));
create policy modules_read on public.course_modules for select to anon, authenticated
  using (public.course_is_published(course_id) or public.can_manage_course(course_id));
create policy lessons_read on public.lessons for select to anon, authenticated
  using (public.course_is_published(course_id) or public.can_manage_course(course_id));
create policy requirements_read on public.course_requirements for select to anon, authenticated
  using (public.course_is_published(course_id) or public.can_manage_course(course_id));
create policy course_instructors_read on public.course_instructors for select to anon, authenticated
  using (public.course_is_published(course_id) or public.can_manage_course(course_id));
create policy reviews_read on public.course_reviews for select to anon, authenticated using (public.course_is_published(course_id));

-- ───── gated learning material
create policy lesson_content_read on public.lesson_content for select to authenticated using (
  exists (select 1 from public.lessons l where l.id = lesson_id
          and (l.is_preview or public.is_enrolled(l.course_id) or public.can_manage_course(l.course_id))));
create policy resources_read on public.lesson_resources for select to authenticated
  using (public.is_enrolled(course_id) or public.can_manage_course(course_id));
create policy quizzes_read on public.quizzes for select to authenticated using (
  exists (select 1 from public.lessons l where l.id = lesson_id and (public.is_enrolled(l.course_id) or public.can_manage_course(l.course_id))));
create policy quiz_questions_staff on public.quiz_questions for select to authenticated using (
  exists (select 1 from public.lessons l where l.id = lesson_id and public.can_manage_course(l.course_id)));   -- students get sanitised questions via API
create policy assignments_read on public.assignments for select to authenticated using (
  exists (select 1 from public.lessons l where l.id = lesson_id and (public.is_enrolled(l.course_id) or public.can_manage_course(l.course_id))));

-- ───── own learning data
create policy enrollments_read on public.enrollments for select to authenticated
  using (user_id = auth.uid() or public.can_manage_course(course_id));
create policy lesson_progress_read on public.lesson_progress for select to authenticated using (user_id = auth.uid() or public.can_manage_course(course_id));
create policy course_progress_read on public.course_progress for select to authenticated using (user_id = auth.uid() or public.can_manage_course(course_id));
create policy bookmarks_own on public.bookmarks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_enrolled(course_id));
create policy notes_own on public.learning_notes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy quiz_attempts_read on public.quiz_attempts for select to authenticated using (
  user_id = auth.uid() or exists (select 1 from public.lessons l where l.id = lesson_id and public.can_manage_course(l.course_id)));
create policy submissions_read on public.assignment_submissions for select to authenticated using (
  user_id = auth.uid() or exists (select 1 from public.lessons l where l.id = lesson_id and public.can_manage_course(l.course_id)));
create policy certificates_read on public.certificates for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- ───── payments (read-only for owners; admins see all; writes only via service role)
create policy orders_read on public.orders for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy payments_read on public.payments for select to authenticated using (
  public.is_admin() or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy refunds_admin on public.refunds for select to authenticated using (public.is_admin());
create policy coupons_admin on public.coupons for select to authenticated using (public.is_admin());
create policy payment_tx_admin on public.payment_transactions for select to authenticated using (public.is_admin());

-- ───── communication
create policy announcements_read on public.announcements for select to authenticated using (
  course_id is null or public.is_enrolled(course_id) or public.can_manage_course(course_id));
create policy notifications_own_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy discussions_read on public.discussions for select to authenticated using (public.is_enrolled(course_id) or public.can_manage_course(course_id));
create policy discussions_insert on public.discussions for insert to authenticated
  with check (user_id = auth.uid() and (public.is_enrolled(course_id) or public.can_manage_course(course_id)));
create policy discussions_delete on public.discussions for delete to authenticated using (user_id = auth.uid() or public.can_manage_course(course_id));
create policy tickets_own on public.support_tickets for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy tickets_insert on public.support_tickets for insert to authenticated with check (user_id = auth.uid());

-- ───── admin + public site content
create policy audit_admin on public.audit_logs for select to authenticated using (public.is_admin());
create policy settings_public on public.platform_settings for select to anon, authenticated using (is_public or public.is_admin());
create policy applications_own on public.instructor_applications for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy testimonials_read on public.testimonials for select to anon, authenticated using (is_published or public.is_admin());
create policy faqs_read on public.faqs for select to anon, authenticated using (is_published or public.is_admin());
create policy blog_read on public.blog_posts for select to anon, authenticated using (is_published or public.is_admin());
-- contact_messages: no policy (inserted by API with rate-limiting; read by service role)
