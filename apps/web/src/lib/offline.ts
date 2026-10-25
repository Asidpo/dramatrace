import localforage from 'localforage'
import { deleteProgress, networkError, upsertProgress } from './api'
import type { Progress, Show } from './types'

const queue = localforage.createInstance({ name: 'dramatrace', storeName: 'sync_queue' })
const cache = localforage.createInstance({ name: 'dramatrace', storeName: 'cache' })

const CACHE_PROGRESS = 'progress_list'
const CACHE_SHOWS = 'shows_list'

export interface QueueOp {
  id: string
  kind: 'upsert' | 'delete'
  progressId?: string // 服务端记录 id（有则直接用）
  payload?: Partial<Progress>
  conflicted?: boolean
  at: string
}

export function newLocalId(): string {
  return `local_${crypto.randomUUID()}`
}

export function isLocalId(id: string): boolean {
  return id.startsWith('local_')
}

async function cacheGet<T>(key: string): Promise<T | null> {
  return (await cache.getItem<T>(key)) ?? null
}

async function cacheSet(key: string, value: unknown): Promise<void> {
  await cache.setItem(key, value)
}

export async function loadShowsCached(): Promise<Show[]> {
  return (await cacheGet<Show[]>(CACHE_SHOWS)) ?? []
}

export async function cacheShows(shows: Show[]): Promise<void> {
  await cacheSet(CACHE_SHOWS, shows)
}

export async function loadProgressCached(showId?: string): Promise<Progress[]> {
  const all = (await cacheGet<Progress[]>(CACHE_PROGRESS)) ?? []
  return showId ? all.filter((p) => p.show === showId) : all
}

async function upsertInCache(p: Progress): Promise<void> {
  const all = (await cacheGet<Progress[]>(CACHE_PROGRESS)) ?? []
  const idx = all.findIndex(
    (x) => x.id === p.id || (x.show === p.show && x.season_number === p.season_number && x.episode_number === p.episode_number),
  )
  if (idx >= 0) all[idx] = { ...all[idx], ...p }
  else all.unshift(p)
  await cacheSet(CACHE_PROGRESS, all)
}

async function removeFromCache(idOrRecord: Progress): Promise<void> {
  const all = (await cacheGet<Progress[]>(CACHE_PROGRESS)) ?? []
  await cacheSet(
    CACHE_PROGRESS,
    all.filter(
      (x) =>
        !(
          x.id === idOrRecord.id ||
          (x.show === idOrRecord.show &&
            x.season_number === idOrRecord.season_number &&
            x.episode_number === idOrRecord.episode_number)
        ),
    ),
  )
}

async function enqueue(op: Omit<QueueOp, 'id' | 'at'> & { id?: string }): Promise<void> {
  const id = op.id ?? `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  await queue.setItem(id, { ...op, id, at: new Date().toISOString() })
}

/** 本地保存（离线路径）：写入缓存 + 入队待同步 */
export async function upsertProgressLocal(p: Progress): Promise<void> {
  await upsertInCache(p)
  await enqueue({
    kind: 'upsert',
    progressId: isLocalId(p.id) ? undefined : p.id,
    payload: { ...p, id: undefined },
  })
}

export async function deleteProgressLocal(p: Progress): Promise<void> {
  await removeFromCache(p)
  await enqueue({ kind: 'delete', progressId: isLocalId(p.id) ? undefined : p.id })
}

export async function queueOps(): Promise<QueueOp[]> {
  const keys = await queue.keys()
  const ops: QueueOp[] = []
  for (const k of keys) {
    const op = await queue.getItem<QueueOp>(k)
    if (op) ops.push(op)
  }
  return ops
}

export async function pendingOpsCount(): Promise<number> {
  return (await queue.keys()).length
}

export async function conflictCount(): Promise<number> {
  const ops = await queueOps()
  return ops.filter((o) => o.conflicted).length
}

/** 清空离线队列（用户明确选择放弃未同步数据时使用） */
export async function clearQueue(): Promise<void> {
  await queue.clear()
}

/**
 * 同步队列：按序推送到服务端。
 * - 网络错误 → 停止并返回 false（下次再试）
 * - 业务错误（校验/唯一冲突）→ 标记 conflicted，保留在队列，继续下一个
 */
export async function flushQueue(): Promise<boolean> {
  const ops = await queueOps()
  ops.sort((a, b) => a.at.localeCompare(b.at))
  for (const op of ops) {
    try {
      if (op.kind === 'delete') {
        if (op.progressId) await deleteProgress(op.progressId)
      } else {
        const server = await upsertProgress({
          ...(op.payload ?? {}),
          id: op.progressId,
          show: op.payload?.show ?? '',
        } as Partial<Progress>)
        await upsertInCache(server)
      }
      await queue.removeItem(op.id)
    } catch (e) {
      if (networkError(e)) return false
      if (!op.conflicted) {
        await queue.setItem(op.id, { ...op, conflicted: true })
      }
    }
  }
  return true
}
