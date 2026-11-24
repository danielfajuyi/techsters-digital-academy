import { Link } from 'react-router-dom';
import { useApi } from '../../lib/useApi.js';
import { Async, Avatar, EmptyState } from '../../components/ui/index.jsx';
import { Users } from 'lucide-react';

export default function Instructors() {
  const s = useApi('/instructors', { auth: false });
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-4xl font-semibold">Instructors</h1>
      <p className="mt-2 max-w-xl text-ink-600">Every course is taught by a practitioner. Meet the people behind them.</p>
      <div className="mt-8"><Async state={s}>{(list) => list.length === 0 ? <EmptyState icon={Users} title="Instructors are being onboarded">Check back soon.</EmptyState> : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{list.map((i) => (
          <Link key={i.id} to={`/instructors/${i.id}`} className="card flex gap-4 p-5 transition-shadow hover:shadow-pop"><Avatar src={i.avatar_url} name={i.full_name} size={56} />
            <div className="min-w-0"><h2 className="text-lg font-semibold">{i.full_name}</h2>{i.headline && <p className="text-sm text-ink-500">{i.headline}</p>}</div></Link>))}</div>)}</Async></div>
    </div>
  );
}
