import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { DemoBanner } from '../components/DemoBanner'
import { Button } from '../components/Button'
import { useAuth } from '../context/auth-context'

export function AppLayout() {
  const { user, signOut } = useAuth()

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex-1">
            <DemoBanner />
          </div>
          <span className="hidden text-sm text-slate-600 sm:inline">
            {user?.email}
          </span>
          <Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
