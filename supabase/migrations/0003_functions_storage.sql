-- ───────────── Progress ─────────────
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
create trigger lesson_progress_sync after insert or update on public.lesson_progress
  for each row execute function public.trg_lesson_progress();

-- ───────────── Enrollment (idempotent; service role only) ─────────────
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

-- ───────────── Atomic payment fulfilment ─────────────
-- Called ONLY after the API has independently verified the charge with Paystack.
create or replace function public.fulfill_order(p_reference text, p_provider_ref text, p_amount bigint, p_currency text, p_channel text, p_raw jsonb)
returns table (order_id uuid, user_id uuid, course_id uuid, already_paid boolean)
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where reference = p_reference for update;   -- row lock serialises webhook vs. verify race
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

-- ───────────── Public certificate verification (no private data) ─────────────
create or replace function public.verify_certificate(p_no text)
returns table (certificate_no text, recipient_name text, course_title text, issued_at timestamptz)
language sql stable security definer set search_path = public as
$$ select certificate_no, recipient_name, course_title, issued_at from public.certificates where certificate_no = upper(trim(p_no)) $$;
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- Lock down privileged functions: only the service role may call them.
revoke execute on function public.enroll_user(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.fulfill_order(text, text, bigint, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.recompute_course_progress(uuid, uuid) from public, anon, authenticated;

-- ───────────── Storage buckets & policies ─────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars',               'avatars',               true,  2097152,   array['image/jpeg','image/png','image/webp']),
  ('course-thumbnails',     'course-thumbnails',     true,  5242880,   array['image/jpeg','image/png','image/webp']),
  ('course-resources',      'course-resources',      false, 52428800,  array['application/pdf','application/zip','image/jpeg','image/png','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation','video/mp4']),
  ('assignment-submissions','assignment-submissions',false, 20971520,  array['application/pdf','application/zip','image/jpeg','image/png','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('certificates',          'certificates',          false, 5242880,   array['application/pdf'])
on conflict (id) do nothing;

-- avatars: world-readable, each user writes only inside their own folder  (<uid>/file)
create policy avatars_read on storage.objects for select using (bucket_id = 'avatars');
create policy avatars_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- thumbnails: public read, staff write
create policy thumbs_read on storage.objects for select using (bucket_id = 'course-thumbnails');
create policy thumbs_write on storage.objects for insert to authenticated with check (bucket_id = 'course-thumbnails' and public.is_staff());
create policy thumbs_update on storage.objects for update to authenticated using (bucket_id = 'course-thumbnails' and public.is_staff());

-- course-resources: staff upload; students download ONLY through API-issued signed URLs (no read policy)
create policy resources_staff_write on storage.objects for insert to authenticated with check (bucket_id = 'course-resources' and public.is_staff());

-- assignment-submissions: students upload into their own folder; staff read; owners read own
create policy submissions_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'assignment-submissions' and (storage.foldername(name))[1] = auth.uid()::text);
create policy submissions_read on storage.objects for select to authenticated
  using (bucket_id = 'assignment-submissions' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
-- certificates: written and signed by the API only.

-- ───────────── Seed settings ─────────────
insert into public.platform_settings (key, value, is_public) values
  ('academy', '{"name":"Techsters Academy","tagline":"Learn skills that ship.","email":"hello@techsters.academy","currency":"NGN"}', true),
  ('instructors_can_publish', 'false', false),
  ('certificate', '{"signatory":"Director, Techsters Academy"}', false)
on conflict (key) do nothing;

-- Certificate number sequence accessor (RPC callable only by the service role)
create or replace function public.nextval_certificate() returns bigint language sql security definer set search_path = public as
$$ select nextval('public.certificate_seq') $$;
revoke execute on function public.nextval_certificate() from public, anon, authenticated;
