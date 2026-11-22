import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { Button } from '../components/Button'
import { TextField } from '../components/TextField'
import { useAuth } from '../context/auth-context'
import {
  createGroup,
  joinGroupByCode,
  listMyGroups,
  type GroupSummary,
} from '../lib/groups'

export function GroupsPage() {
  const { user } = useAuth()
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh(showSpinner = true) {
    if (showSpinner) setLoading(true)
    try {
      setGroups(await listMyGroups())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load groups.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- fetch on mount
    void refresh(false)
  }, [])

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !newName.trim()) return
    setBusy(true)
    setError(null)
    try {
      await createGroup(newName)
      setNewName('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group.')
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!joinCode.trim()) return
    setBusy(true)
    setError(null)
    try {
      await joinGroupByCode(joinCode)
      setJoinCode('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join group.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Groups"
        description="Groups where you share bills."
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <form
          onSubmit={handleCreate}
          className="flex items-end gap-2 rounded-lg border border-slate-200 bg-white p-4"
        >
          <div className="flex-1">
            <TextField
              id="newGroupName"
              label="Create Group"
              placeholder="Group name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy || !newName.trim()}>
            Create
          </Button>
        </form>

        <form
          onSubmit={handleJoin}
          className="flex items-end gap-2 rounded-lg border border-slate-200 bg-white p-4"
        >
          <div className="flex-1">
            <TextField
              id="joinCode"
              label="Join Group"
              placeholder="Invite code (6 characters)"
              maxLength={6}
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            />
          </div>
          <Button type="submit" disabled={busy || !joinCode.trim()}>
            Join
          </Button>
        </form>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : groups.length === 0 ? (
        <EmptyState message="No groups yet. Create a new group or join with a code." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <li key={group.id}>
              <Link
                to={`/groups/${group.id}`}
                className="block rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-slate-400"
              >
                <span className="block font-medium text-slate-900">{group.name}</span>
                <span className="mt-1 block text-xs text-slate-500">
                  Code: <span className="font-mono">{group.inviteCode}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
