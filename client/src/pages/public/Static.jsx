import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ShieldCheck, ShieldX, FileQuestion } from 'lucide-react';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { Async, EmptyState, Field, RichText, Spinner } from '../../components/ui/index.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { date } from '../../lib/format.js';

const Shell = ({ title, lead, children, narrow = true }) => (
  <div className={`mx-auto px-4 py-12 sm:px-6 ${narrow ? 'max-w-3xl' : 'max-w-6xl'}`}><h1 className="text-4xl font-semibold">{title}</h1>{lead && <p className="mt-3 text-lg text-ink-600">{lead}</p>}<div className="mt-8">{children}</div></div>
);

const MAIN = 'https://techsters.com.ng';
const clientQuotes = [
  ['Working with Techsters was an absolute game-changer for our business!', 'Baanssure Cleaning Service'],
  ['Working with Techsters was a game-changer for us!', 'Tombrem Migration Service'],
  ['Techsters transformed our online business with a beautifully designed and highly functional e-commerce website.', 'Retro Beauty Root Limited'],
  ['Techsters did an incredible job designing our website!', 'Sags Hotel'],
];

export function About() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-ink-100"><div className="hero-glow absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6"><p className="text-sm font-semibold text-brand-700">About the Academy</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-semibold sm:text-5xl">We teach what we do every day for real clients.</h1>
          <p className="mt-5 max-w-2xl text-lg text-ink-600">Techsters is a dynamic digital agency based in Abuja, Nigeria and South Wales, UK, specialising in web design, graphic design, brand management and digital skills training. The Academy brings that experience to students, professionals and business owners.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link to="/courses" className="btn-primary">Browse courses</Link><a href={MAIN} target="_blank" rel="noreferrer" className="btn-outline">Visit techsters.com.ng</a></div></div></section>
      <div className="mx-auto max-w-6xl space-y-16 px-4 py-14 sm:px-6">
        <section className="grid gap-6 md:grid-cols-2">
          <div className="card p-7"><h2 className="text-2xl font-semibold">Our mission</h2><p className="mt-3 text-ink-600">To bridge the gap between businesses and digital success with solutions in web design, branding and digital training, equipping businesses and individuals with the right tools and knowledge to thrive in a fast-evolving digital space.</p></div>
          <div className="card p-7"><h2 className="text-2xl font-semibold">Our vision</h2><p className="mt-3 text-ink-600">A world where every business, regardless of size, has access to professional digital solutions, and where individuals can build digital skills that open doors to endless opportunities.</p></div>
        </section>
        <section><h2 className="text-3xl font-semibold">What we teach</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['Web Development', 'Responsive, high-performing websites that turn visitors into loyal customers.'], ['Brand Design', 'Logos, colours and visuals that build recognition and trust.'], ['Social Media Management', 'Professional visuals and content strategies that attract, connect and convert.'], ['AI Automation & Productivity', 'Practical workflows and tools that save hours every week.']].map(([t, d]) => <div key={t} className="card p-5"><h3 className="font-semibold">{t}</h3><p className="mt-1.5 text-sm text-ink-500">{d}</p></div>)}</div></section>
        <section><h2 className="text-3xl font-semibold">Why learn with Techsters</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">{[['Expert team', 'Skilled professionals who are passionate about web design, branding and digital innovation.'], ['Results-driven', 'Our focus is real impact, whether that is engagement, sales or brand growth.'], ['Ongoing support', "Our relationship doesn't end after the lesson. We're here for continuous improvement and growth."]].map(([t, d]) => <div key={t}><h3 className="text-lg font-semibold">{t}</h3><p className="mt-1.5 text-ink-600">{d}</p></div>)}</div></section>
        <section><h2 className="text-3xl font-semibold">Trusted by businesses we've built for</h2><p className="mt-1 text-ink-500">From the agency's clients</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">{clientQuotes.map(([q, who]) => <figure key={who} className="card p-6"><blockquote className="text-ink-700">“{q}”</blockquote><figcaption className="mt-3 text-sm font-semibold text-ink-900">{who}</figcaption></figure>)}</div></section>
        <section className="rounded-2xl bg-night px-6 py-10 text-center sm:px-12"><h2 className="text-2xl font-semibold text-white">Questions about which course fits you?</h2><p className="mt-2 text-slate-300">Book a free 30-minute consultation with the team.</p><a href={`${MAIN}/consultation/`} target="_blank" rel="noreferrer" className="btn-primary mt-6">Book a free consultation</a></section>
      </div>
    </div>
  );
}

export function Faq() {
  const s = useApi('/faqs', { auth: false });
  return (
    <Shell title="Frequently asked questions"><Async state={s}>{(list) => list.length === 0 ? <EmptyState icon={FileQuestion} title="No questions yet">Have one? <Link className="text-brand-700 underline" to="/contact">Contact us</Link>.</EmptyState> : (
      <div className="space-y-3">{list.map((f) => <details key={f.id} className="card group p-4"><summary className="cursor-pointer list-none font-medium text-ink-900">{f.question}</summary><p className="mt-3 whitespace-pre-line text-ink-600">{f.answer}</p></details>)}</div>)}</Async></Shell>
  );
}

export function Contact() {
  const toast = useToast();
  const [f, setF] = useState({ name: '', email: '', message: '' }); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false); const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api('/contact', { method: 'POST', body: f, auth: false }); setSent(true); } catch (x) { setErr(x.message); toast(x.message, 'error'); }
    setBusy(false);
  };
  return (
    <Shell title="Contact us" lead="Questions about a course, payment or certificate? Send us a message and we'll reply by email." narrow={false}>
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        {sent ? <div className="card p-6"><h2 className="text-xl font-semibold">Message sent</h2><p className="mt-2 text-ink-600">Thanks, {f.name}. We'll get back to you at {f.email}.</p></div> : (
          <form onSubmit={submit} className="card space-y-4 p-6">
            <Field label="Your name" htmlFor="n"><input id="n" className="input" required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Email" htmlFor="e"><input id="e" type="email" className="input" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Message" htmlFor="m" error={err}><textarea id="m" className="input min-h-[140px]" required minLength={10} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></Field>
            <button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-current" />}Send message</button>
          </form>)}
        <aside className="card h-fit space-y-4 p-6 text-sm">
          <div><p className="font-semibold text-ink-900">Techsters Digital Agency</p><p className="mt-1 text-ink-600">Abuja, Nigeria | South Wales, UK</p></div>
          <div><p className="font-semibold text-ink-900">Phone</p><a className="link block" href="tel:+2349033148179">+234 903 314 8179</a><a className="link block" href="tel:+447344059626">+44 7344 059626</a></div>
          <div><p className="font-semibold text-ink-900">Email</p><a className="link" href="mailto:info@techsters.com.ng">info@techsters.com.ng</a></div>
          <a className="btn-outline w-full" href="https://techsters.com.ng/consultation/" target="_blank" rel="noreferrer">Book a free consultation</a>
        </aside>
      </div>
    </Shell>
  );
}

// NOTE: these are plain-language starting points, not legal advice. Have a lawyer review before launch.
export const Terms = () => (
  <Shell title="Terms and conditions"><div className="rich">
    <p>Last updated: {new Date().getFullYear()}. By creating an account or enrolling in a course you agree to these terms.</p>
    <h2>Accounts</h2><p>You are responsible for keeping your sign-in details secure and for activity on your account. You must provide accurate information.</p>
    <h2>Courses and access</h2><p>Enrolment gives you a personal, non-transferable licence to view course content for the access period shown on the course page. You may not copy, resell or share course materials or your account.</p>
    <h2>Payments and refunds</h2><p>Prices are shown in Naira. Payments are processed by Paystack and you are enrolled once payment is confirmed. Refund requests are reviewed case by case; contact us through the contact page.</p>
    <h2>Certificates</h2><p>Certificates are issued only when course completion requirements are met and may be verified publicly by their number. We may revoke certificates obtained through fraud.</p>
    <h2>Acceptable use</h2><p>Do not harass others, post unlawful content, attempt to access other users' data, or interfere with the service.</p>
    <h2>Changes</h2><p>We may update these terms and will post the new version on this page.</p>
  </div></Shell>
);
export const Privacy = () => (
  <Shell title="Privacy policy"><div className="rich">
    <p>This explains what personal data Techsters Academy collects and why.</p>
    <h2>What we collect</h2><p>Your name, email address and profile photo (including from Google if you sign in with Google), course progress, quiz and assignment results, and payment records. We do not store card details; Paystack handles them.</p>
    <h2>How we use it</h2><p>To provide your courses, track progress, issue certificates, process payments, send service emails, and keep the platform secure.</p>
    <h2>Who we share it with</h2><p>Service providers that run the platform: Supabase (database and authentication), Vercel (hosting), Paystack (payments) and our email provider. Instructors can see progress and submissions for students in their courses. Certificate verification pages show only the name, course and issue date.</p>
    <h2>Your rights</h2><p>You can view and update your profile at any time and ask us to delete your account by contacting us. We handle personal data in line with applicable data protection law, including the Nigeria Data Protection Act.</p>
  </div></Shell>
);

export function Blog() {
  const s = useApi('/blog', { auth: false });
  return (
    <Shell title="Learning resources" lead="Guides and tips from our instructors." narrow={false}><Async state={s}>{(list) => list.length === 0 ? <EmptyState title="No articles yet">New resources will appear here.</EmptyState> : (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{list.map((p) => <Link key={p.id} to={`/blog/${p.slug}`} className="card overflow-hidden transition-shadow hover:shadow-pop">{p.cover_url && <img src={p.cover_url} alt="" loading="lazy" className="aspect-video w-full object-cover" />}<div className="p-4"><h2 className="text-lg font-semibold">{p.title}</h2><p className="mt-1 line-clamp-3 text-sm text-ink-500">{p.excerpt}</p><p className="mt-3 text-xs text-ink-400">{date(p.published_at)}</p></div></Link>)}</div>)}</Async></Shell>
  );
}
export function BlogPost() {
  const { slug } = useParams(); const s = useApi(`/blog/${slug}`, { auth: false });
  return <Shell title={s.data?.title || ''}><Async state={s}>{(p) => <><p className="-mt-6 mb-6 text-sm text-ink-400">{date(p.published_at)}</p><RichText html={p.body_html} /></>}</Async></Shell>;
}

export function Verify() {
  const { no } = useParams(); const nav = useNavigate(); const [v, setV] = useState('');
  const s = useApi(no ? `/verify/${encodeURIComponent(no)}` : null, { auth: false });
  return (
    <Shell title="Verify a certificate" lead="Enter the certificate number to confirm it was issued by Techsters Academy.">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (v.trim()) nav(`/verify/${encodeURIComponent(v.trim())}`); }}>
        <input className="input" placeholder="TCH-2026-001000" value={v} onChange={(e) => setV(e.target.value)} aria-label="Certificate number" /><button className="btn-primary">Verify</button></form>
      {no && <div className="mt-6">{s.loading ? <Spinner /> : s.error ? <p className="text-red-600">{s.error.message}</p> : s.data?.valid ? (
        <div className="card flex gap-4 border-l-4 border-emerald-500 p-6"><ShieldCheck className="h-8 w-8 shrink-0 text-emerald-600" /><div><h2 className="text-xl font-semibold">Valid certificate</h2>
          <dl className="mt-3 space-y-1 text-sm"><div><dt className="inline text-ink-500">Awarded to: </dt><dd className="inline font-medium text-ink-900">{s.data.certificate.recipient_name}</dd></div>
            <div><dt className="inline text-ink-500">Course: </dt><dd className="inline font-medium text-ink-900">{s.data.certificate.course_title}</dd></div>
            <div><dt className="inline text-ink-500">Issued: </dt><dd className="inline">{date(s.data.certificate.issued_at)}</dd></div>
            <div><dt className="inline text-ink-500">Number: </dt><dd className="inline">{s.data.certificate.certificate_no}</dd></div></dl></div></div>
      ) : <div className="card flex gap-4 border-l-4 border-red-500 p-6"><ShieldX className="h-8 w-8 shrink-0 text-red-600" /><div><h2 className="text-xl font-semibold">No certificate found</h2><p className="mt-1 text-ink-600">Check the number and try again. Numbers look like TCH-2026-001000.</p></div></div>}</div>}
    </Shell>
  );
}

export function NotFound() {
  return <Shell title="Page not found" lead="The page you're looking for doesn't exist or has moved."><Link to="/" className="btn-primary">Go to homepage</Link></Shell>;
}
