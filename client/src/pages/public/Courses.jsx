import { useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Search, SearchX } from 'lucide-react';
import { useApi } from '../../lib/useApi.js';
import { qs } from '../../lib/api.js';
import { CourseCard, EmptyState, ErrorState, Pagination, PageLoader } from '../../components/ui/index.jsx';
import { priceOf } from './Home.jsx';

export default function Courses() {
  const [sp, setSp] = useSearchParams();
  const f = { search: sp.get('search') || '', category: sp.get('category') || '', level: sp.get('level') || '', price: sp.get('price') || '', sort: sp.get('sort') || 'newest', page: +sp.get('page') || 1 };
  const [text, setText] = useState(f.search);
  useEffect(() => setText(f.search), [f.search]);
  const set = (k, v) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); if (k !== 'page') n.delete('page'); setSp(n); };
  const list = useApi(`/courses${qs({ ...f, pageSize: 12 })}`, { auth: false });
  const cats = useApi('/categories', { auth: false });
  const sel = 'input w-auto min-w-[9rem]';
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-4xl font-semibold">Courses</h1>
      <p className="mt-2 text-ink-600">Pick a topic, check the curriculum, and start with a free preview lesson.</p>
      <form className="mt-6 flex flex-wrap gap-3" role="search" onSubmit={(e) => { e.preventDefault(); set('search', text.trim()); }}>
        <div className="relative min-w-[200px] flex-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-ink-400" /><input className="input pl-9" placeholder="Search courses" value={text} onChange={(e) => setText(e.target.value)} aria-label="Search courses" /></div>
        <select className={sel} value={f.category} onChange={(e) => set('category', e.target.value)} aria-label="Category"><option value="">All categories</option>{cats.data?.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</select>
        <select className={sel} value={f.level} onChange={(e) => set('level', e.target.value)} aria-label="Level"><option value="">Any level</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select>
        <select className={sel} value={f.price} onChange={(e) => set('price', e.target.value)} aria-label="Price"><option value="">Free and paid</option><option value="free">Free</option><option value="paid">Paid</option></select>
        <select className={sel} value={f.sort} onChange={(e) => set('sort', e.target.value)} aria-label="Sort by"><option value="newest">Newest</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select>
      </form>
      <div className="mt-8">
        {list.loading && !list.data ? <PageLoader /> : list.error ? <ErrorState error={list.error} onRetry={list.reload} /> :
          list.data.items.length === 0 ? <EmptyState icon={SearchX} title="No courses match" action={<button className="btn-outline" onClick={() => setSp({})}>Clear filters</button>}>Try a different search or remove a filter.</EmptyState> : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{list.data.items.map((c) => <CourseCard key={c.id} c={c} formatPrice={priceOf} />)}</div>
              <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={(p) => set('page', String(p))} />
            </>)}
      </div>
    </div>
  );
}
