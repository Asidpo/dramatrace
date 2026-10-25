import { getPb } from './pb'
import type { PendingRecord, Progress, Show } from './types'

export function isAuthed(): boolean {
  return getPb().authStore.isValid
}

/** MVP：单管理员 = PocketBase 超级管理员账号 */
export async function login(email: string, password: string): Promise<void> {
  await getPb().collection('_superusers').authWithPassword(email, password)
}

export async function listShows(): Promise<Show[]> {
  return getPb().collection('shows').getFullList<Show>({ sort: '-updated' })
}

export async function saveShow(data: Partial<Show>): Promise<Show> {
  return getPb().collection('shows').create(data)
}

export async function listProgress(showId?: string): Promise<Progress[]> {
  return getPb()
    .collection('progress')
    .getFullList<Progress>({
      filter: showId ? `show="${showId}"` : '',
      sort: '-watched_at',
      expand: 'show',
    })
}

export async function upsertProgress(p: Partial<Progress>): Promise<Progress> {
  if (p.id) return getPb().collection('progress').update(p.id, p)
  return getPb().collection('progress').create(p)
}

export async function deleteProgress(id: string): Promise<void> {
  await getPb().collection('progress').delete(id)
}

export async function listPending(): Promise<PendingRecord[]> {
  return getPb()
    .collection('pending_records')
    .getFullList<PendingRecord>({ filter: 'status="pending"', sort: '-created', expand: 'show' })
}

export async function updatePending(id: string, data: Partial<PendingRecord>): Promise<PendingRecord> {
  return getPb().collection('pending_records').update(id, data)
}

export function networkError(e: unknown): boolean {
  const err = e as { isAbort?: boolean; originalError?: { code?: string; name?: string } }
  if (err?.isAbort) return true
  const oe = err?.originalError
  return !!oe && (oe.code === 'ERR_NETWORK' || oe.code === 'ECONNREFUSED' || oe.name === 'TypeError')
}
