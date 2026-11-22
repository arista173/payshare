import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="404" description="Page not found." />
      <Link to="/" className="text-sm font-medium text-slate-900 underline">
        Back to Dashboard
      </Link>
    </>
  )
}
