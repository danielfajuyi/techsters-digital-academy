-- Optional starter content (no fake courses, no fake analytics). Safe to re-run.
insert into public.course_categories (slug, name, position) values
  ('web-development','Web Development',1),('data','Data & Analytics',2),('design','Product Design',3),('cloud','Cloud & DevOps',4),('career','Career Skills',5)
on conflict (slug) do nothing;

insert into public.faqs (question, answer, position) values
  ('How do I pay for a course?','Checkout runs on Paystack. You can pay by card, bank transfer or USSD, and you are enrolled as soon as the payment is confirmed.',1),
  ('How long do I have access?','Most courses give lifetime access. The access period is shown on each course page.',2),
  ('How do certificates work?','Finish every lesson, pass required quizzes and get required assignments graded. You can then claim a PDF certificate with a unique number that anyone can verify on our website.',3),
  ('Can I try a course first?','Yes. Look for lessons marked Preview on the course page. Some courses are free.',4)
on conflict do nothing;
