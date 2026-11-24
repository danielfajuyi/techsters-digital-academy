import { useParams } from 'react-router-dom';
import { useApi } from '../../lib/useApi.js';
import { Async, Avatar, CourseCard, EmptyState } from '../../components/ui/index.jsx';
import { priceOf } from './Home.jsx';

export default function InstructorProfile() {
  const { id } = useParams();
  const s = useApi(`/instructors/${id}`, { auth: false });
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><Async state={s}>{({ instructor: i, courses }) => (
      <>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center"><Avatar src={i.avatar_url} name={i.full_name} size={96} />
          <div><h1 className="text-4xl font-semibold">{i.full_name}</h1>{i.headline && <p className="mt-1 text-lg text-ink-600">{i.headline}</p>}</div></div>
        {i.bio && <p className="mt-6 max-w-2xl whitespace-pre-line text-ink-600">{i.bio}</p>}
        <h2 className="mb-5 mt-12 text-2xl font-semibold">Courses</h2>
        {courses.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{courses.map((c) => <CourseCard key={c.id} c={c} formatPrice={priceOf} />)}</div> : <EmptyState title="No published courses yet" />}
      </>)}</Async></div>
  );
}
