import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Search, Award, Video, MessageSquare, ShieldCheck, BookOpenCheck, Smartphone, ArrowRight } from 'lucide-react';
import { useApi } from '../../lib/useApi.js';
import { money, duration } from '../../lib/format.js';
import { CourseCard, CourseThumb, Avatar } from '../../components/ui/index.jsx';

export const priceOf = (c) => money(c.price_minor, c.currency);

const benefits = [
  [Video, 'Learn by building', 'Video lessons, readings and downloadable files in every course, with a place to take notes as you go.'],
  [BookOpenCheck, 'Prove what you know', 'Timed quizzes graded instantly, and assignments reviewed by an instructor who gives written feedback.'],
  [Award, 'Certificates that check out', 'Every certificate has a unique number and a public link, so employers can confirm it in seconds.'],
  [MessageSquare, 'Ask in the lesson', 'Discussion sits beside each lesson, so questions get answered where they come up.'],
  [Smartphone, 'Pick up anywhere', 'Progress is saved to your account. Start on a laptop, carry on from your phone.'],
  [ShieldCheck, 'Pay once, safely', 'Checkout runs on Paystack. You are enrolled only after the payment is confirmed.'],
];

export default function Home() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const featured = useApi('/courses?featured=1&pageSize=3', { auth: false });
  const latest = useApi('/courses?pageSize=6&sort=newest', { auth: false });
  const tests = useApi('/testimonials', { auth: false });
  const cats = useApi('/categories', { auth: false });
  const hero = featured.data?.items?.length ? featured.data.items : latest.data?.items?.slice(0, 3) || [];
  const submit = (e) => { e.preventDefault(); nav(`/courses?search=${encodeURIComponent(q)}`); };

  return (
    <>
      <section className="relative overflow-hidden bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div>
            <h1 className="text-[40px] font-semibold leading-[1.05] sm:text-6xl">Learn tech skills from people who work in tech.</h1>
            <p className="mt-5 max-w-xl text-lg text-ink-600">Short, practical courses with real instructors, graded work and certificates you can share. Start free, pay only for the courses you want.</p>
            <form onSubmit={submit} className="mt-8 flex max-w-lg gap-2" role="search">
              <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-ink-400" />
                <input className="input h-11 pl-9" placeholder="What do you want to learn?" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search courses" /></div>
              <button className="btn-primary h-11">Search</button>
            </form>
            {cats.data?.length > 0 && <div className="mt-4 flex flex-wrap gap-2 text-sm">{cats.data.slice(0, 5).map((c) => <Link key={c.id} to={`/courses?category=${c.slug}`} className="rounded-full bg-ink-100 px-3 py-1 text-ink-600 hover:bg-brand-50 hover:text-brand-700">{c.name}</Link>)}</div>}
          </div>

          <div aria-label="Featured courses">
            {hero.length > 0 ? (
              <div className="space-y-3">
                {hero.map((c, i) => (
                  <Link key={c.id} to={`/courses/${c.slug}`} className="card flex items-center gap-4 p-3 transition-shadow hover:shadow-pop" style={{ marginLeft: i % 2 ? 24 : 0 }}>
                    <CourseThumb src={c.thumbnail_url} title="" className="h-20 w-28 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1"><p className="truncate font-display text-base font-semibold text-ink-900">{c.title}</p>
                      <p className="text-sm text-ink-500">{c.lesson_count} lessons · {duration(c.duration_seconds)}</p></div>
                    <span className="pr-2 text-sm font-semibold text-brand-700">{priceOf(c)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="card p-8"><h2 className="text-xl font-semibold">New courses are on the way</h2><p className="mt-2 text-ink-500">Create an account to be ready when enrolment opens.</p><Link to="/register" className="btn-primary mt-5">Create account</Link></div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex items-end justify-between"><h2 className="text-3xl font-semibold">Latest courses</h2><Link to="/courses" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">Browse all <ArrowRight className="h-4 w-4" /></Link></div>
        {latest.data?.items?.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{latest.data.items.map((c) => <CourseCard key={c.id} c={c} formatPrice={priceOf} />)}</div>
          : <p className="text-ink-500">{latest.loading ? 'Loading courses…' : 'No courses are published yet.'}</p>}
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="max-w-xl text-3xl font-semibold">Everything you need to learn properly, in one place</h2>
          <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map(([Icon, t, d]) => (<div key={t}><span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600"><Icon className="h-5 w-5" /></span><h3 className="mt-4 text-lg font-semibold">{t}</h3><p className="mt-1.5 text-ink-600">{d}</p></div>))}
          </div>
        </div>
      </section>

      {tests.data?.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="mb-8 text-3xl font-semibold">What students say</h2>
          <div className="grid gap-5 md:grid-cols-3">{tests.data.slice(0, 3).map((t) => (
            <figure key={t.id} className="card flex flex-col p-6"><blockquote className="flex-1 text-ink-700">“{t.quote}”</blockquote>
              <figcaption className="mt-5 flex items-center gap-3"><Avatar src={t.avatar_url} name={t.name} /><div><p className="text-sm font-semibold text-ink-900">{t.name}</p>{t.role && <p className="text-xs text-ink-500">{t.role}</p>}</div></figcaption></figure>))}</div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="rounded-2xl bg-brand-600 px-6 py-12 text-center text-white sm:px-12">
          <h2 className="mx-auto max-w-xl text-3xl font-semibold text-white">Pick a course and finish it this month</h2>
          <p className="mx-auto mt-3 max-w-lg text-brand-100">Free to sign up. Your progress and certificates stay with your account.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3"><Link to="/register" className="btn-lg btn bg-white text-brand-700 hover:bg-brand-50">Create free account</Link><Link to="/courses" className="btn-lg btn text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.4)] hover:bg-white/10">Browse courses</Link></div>
        </div>
      </section>
    </>
  );
}
