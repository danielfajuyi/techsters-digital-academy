import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Search, Award, Video, MessageSquare, ShieldCheck, BookOpenCheck, Smartphone, ArrowRight, ArrowUpRight, Globe, Palette, Share2, Bot, Users, Target, LifeBuoy } from 'lucide-react';
import { useApi } from '../../lib/useApi.js';
import { money, duration } from '../../lib/format.js';
import { CourseCard, CourseThumb, Avatar } from '../../components/ui/index.jsx';

export const priceOf = (c) => money(c.price_minor, c.currency);
const CONSULT = 'https://techsters.com.ng/consultation/';

export const HOME_DEFAULTS = {
  hero_title: 'Digital skills that grow your career, business or brand.',
  hero_subtitle: 'Hands-on training in web design, branding, social media and AI automation, taught by the team at Techsters Digital Agency. Start free, pay only for the courses you want.',
  banner: '',
};

// The four service areas on techsters.com.ng, each mapped to a course category slug.
const tracks = [
  [Globe, 'Web Development', 'Design and build responsive, high-performing websites that turn visitors into customers.', 'web-development'],
  [Palette, 'Brand Design', 'Logos, colours and visuals that capture attention and build recognition.', 'brand-design'],
  [Share2, 'Social Media', 'Create engaging content and manage platforms with strategies that attract and convert.', 'social-media'],
  [Bot, 'AI & Productivity', 'Automate repetitive work and run your day with practical AI and productivity tools.', 'ai-productivity'],
];

const why = [
  [Users, 'Taught by practitioners', 'Your instructors design, build and market for real clients in Abuja and the UK every week.'],
  [Target, 'Results-driven', 'Every course ends with something you can use: a site, a brand kit, a content plan or a working automation.'],
  [LifeBuoy, 'Support after class', 'Ask questions beside each lesson, get written feedback on assignments, and keep access to your materials.'],
  [BookOpenCheck, 'Prove what you know', 'Timed quizzes graded instantly and assignments reviewed by an instructor.'],
  [Award, 'Certificates that check out', 'Each certificate has a unique number and a public link, so anyone can verify it in seconds.'],
  [Smartphone, 'Learn anywhere', 'Progress is saved to your account. Start on a laptop, continue on your phone.'],
];

export default function Home() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const settings = useApi('/settings/public', { auth: false });
  const featured = useApi('/courses?featured=1&pageSize=3', { auth: false });
  const latest = useApi('/courses?pageSize=6&sort=newest', { auth: false });
  const tests = useApi('/testimonials', { auth: false });
  const home = { ...HOME_DEFAULTS, ...(settings.data?.home || {}) };
  const hero = featured.data?.items?.length ? featured.data.items : latest.data?.items?.slice(0, 3) || [];
  const submit = (e) => { e.preventDefault(); nav(`/courses?search=${encodeURIComponent(q)}`); };

  return (
    <>
      {home.banner && <div className="bg-brand-600 px-4 py-2 text-center text-sm font-medium text-night">{home.banner}</div>}
      <section className="relative overflow-hidden border-b border-ink-100">
        <div className="hero-glow absolute inset-0" aria-hidden />
        <div className="grid-bg absolute inset-0" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-[13px] font-medium text-brand-800"><span className="h-1.5 w-1.5 rounded-full bg-brand-600" />Digital Skills Training</p>
            <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] sm:text-6xl">{home.hero_title}</h1>
            <p className="mt-5 max-w-xl text-lg text-ink-600">{home.hero_subtitle}</p>
            <form onSubmit={submit} className="mt-8 flex max-w-lg gap-2" role="search">
              <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-ink-400" />
                <input className="input h-11 pl-9" placeholder="What do you want to learn?" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search courses" /></div>
              <button className="btn-primary h-11">Search</button>
            </form>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <Link to="/courses" className="inline-flex items-center gap-1 font-semibold text-brand-700">Browse all courses <ArrowRight className="h-4 w-4" /></Link>
              <a href={CONSULT} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ink-600 hover:text-ink-900">Book a free consultation <ArrowUpRight className="h-4 w-4" /></a>
            </div>
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
        <p className="text-sm font-semibold text-brand-700">What you can learn</p>
        <h2 className="mt-1 max-w-xl text-3xl font-semibold">The same skills we use to grow brands</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tracks.map(([Icon, t, d, slug]) => (
            <Link key={slug} to={`/courses?category=${slug}`} className="card group p-5 transition-shadow hover:shadow-pop">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-100 text-brand-700"><Icon className="h-5 w-5" /></span>
              <h3 className="mt-4 text-lg font-semibold group-hover:text-brand-700">{t}</h3><p className="mt-1.5 text-sm text-ink-500">{d}</p>
            </Link>))}
        </div>
      </section>

      <section className="border-y border-ink-100 bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-8 flex items-end justify-between"><h2 className="text-3xl font-semibold">Latest courses</h2><Link to="/courses" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">Browse all <ArrowRight className="h-4 w-4" /></Link></div>
          {latest.data?.items?.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{latest.data.items.map((c) => <CourseCard key={c.id} c={c} formatPrice={priceOf} />)}</div>
            : <p className="text-ink-500">{latest.loading ? 'Loading courses…' : 'No courses are published yet.'}</p>}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="text-sm font-semibold text-brand-700">Why Techsters Academy</p>
        <h2 className="mt-1 max-w-xl text-3xl font-semibold">More than videos: real practice, real feedback</h2>
        <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {why.map(([Icon, t, d]) => (<div key={t}><span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-100 text-brand-700"><Icon className="h-5 w-5" /></span><h3 className="mt-4 text-lg font-semibold">{t}</h3><p className="mt-1.5 text-ink-600">{d}</p></div>))}
        </div>
      </section>

      {tests.data?.length > 0 && (
        <section className="border-t border-ink-100 bg-surface"><div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="mb-8 text-3xl font-semibold">What students say</h2>
          <div className="grid gap-5 md:grid-cols-3">{tests.data.slice(0, 3).map((t) => (
            <figure key={t.id} className="card flex flex-col p-6"><blockquote className="flex-1 text-ink-700">“{t.quote}”</blockquote>
              <figcaption className="mt-5 flex items-center gap-3"><Avatar src={t.avatar_url} name={t.name} /><div><p className="text-sm font-semibold text-ink-900">{t.name}</p>{t.role && <p className="text-xs text-ink-500">{t.role}</p>}</div></figcaption></figure>))}</div>
        </div></section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl bg-night px-6 py-12 text-center sm:px-12">
          <div className="hero-glow absolute inset-0 opacity-70" aria-hidden />
          <div className="relative">
            <h2 className="mx-auto max-w-xl text-3xl font-semibold text-white">Not sure where to start? Talk to us for 30 minutes, free.</h2>
            <p className="mx-auto mt-3 max-w-lg text-slate-300">Tell us your goal, whether it's a career move, a business launch or a team upskill, and we'll point you to the right course.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3"><a href={CONSULT} target="_blank" rel="noreferrer" className="btn-primary btn-lg">Book a free consultation</a><Link to="/register" className="btn btn-lg text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.3)] hover:bg-white/10">Create free account</Link></div>
          </div>
        </div>
      </section>
    </>
  );
}
