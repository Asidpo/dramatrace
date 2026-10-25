import { useEffect, useState } from 'react'
import { listPending, listProgress, networkError, updatePending, upsertProgress } from '../lib/api'
import type { PendingRecord, Progress } from '../lib/types'

const DEVICE_LABELS: Record<string, string> = {
  mobile: '手机',
  tv: '电视',
  web: '网页',
  other: '其他',
}

export default function Pending() {
  const [items, setItems] = useState<PendingRecord[]>([])
  const [progress, setProgress] = useState<Progress[]>([])
  const [msg, setMsg] = useState('')
  const [busyId, setBusyId] = useState('')

  async function refresh() {
    try {
      const [p, pr] = await Promise.all([listPending(), listProgress()])
      setItems(p)
      setProgress(pr)
      setMsg('')
    } catch (e) {
      setMsg(networkError(e) ? '网络不可用，无法加载待审核列表' : (e instanceof Error ? e.message : String(e)))
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 找到目标进度的现有记录（去重关键：剧 + 季 + 集） */
  function findExisting(r: PendingRecord): Progress | undefined {
    if (!r.show) return undefined
    return progress.find(
      (p) => p.show === r.show && p.season_number === r.match_season && p.episode_number === r.match_episode,
    )
  }

  async function act(r: PendingRecord, mode: 'confirmed' | 'merged' | 'ignored') {
    setBusyId(r.id)
    setMsg('')
    try {
      if (mode !== 'ignored') {
        const existing = findExisting(r)
        const base: Partial<Progress> = {
          show: r.show!,
          season_number: r.match_season ?? 1,
          episode_number: r.match_episode ?? 1,
          device: 'other',
          watched_at: new Date().toISOString(),
          source: 'auto',
        }
        if (existing) {
          const patch: Partial<Progress> = { id: existing.id }
          if (mode === 'merged') {
            // 合并：只补空字段，保留手动内容
            patch.position_seconds = existing.position_seconds ?? r.match_position_seconds
            patch.watched_at = existing.watched_at
          } else {
            patch.position_seconds = r.match_position_seconds ?? existing.position_seconds
            patch.watched_at = new Date().toISOString()
          }
          patch.episode_completed = existing.episode_completed || !!r.match_position_seconds
          await upsertProgress(patch)
        } else {
          await upsertProgress({
            ...base,
            position_seconds: r.match_position_seconds ?? 0,
            episode_completed: !!r.match_position_seconds,
          })
        }
      }
      await updatePending(r.id, { status: mode })
      await refresh()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId('')
    }
  }

  return (
    <>
      <h1 className="page-title">待审核记录</h1>
      <p className="muted" style={{ marginTop: -6 }}>
        自动识别（截图 OCR 等）的结果会先出现在这里，人工确认后才写入追剧进度。
      </p>
      {msg && <p className="error">{msg}</p>}

      {!items.length && !msg && <p className="muted">没有待审核记录。</p>}

      {items.map((r) => {
        const parsed = (r.parsed ?? {}) as Record<string, unknown>
        const rawText = typeof parsed === 'object' && parsed !== null && 'text' in parsed ? String(parsed.text) : ''
        return (
          <div key={r.id} className="card">
            <div className="row between">
              <strong>{r.expand?.show?.name ?? '未匹配到剧集'}</strong>
              <span className="badge auto">{r.source_plugin}</span>
            </div>
            <div className="muted" style={{ margin: '6px 0' }}>
              {r.match_season ? `S${r.match_season}E${r.match_episode}` : '集数未识别'}
              {r.match_position_seconds ? ` · 第 ${Math.round(r.match_position_seconds / 60)} 分钟` : ''}
              {typeof r.confidence === 'number' ? ` · 置信度 ${Math.round(r.confidence * 100)}%` : ''}
            </div>
            {rawText && (
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                原始文本：{rawText}
              </div>
            )}
            {findExisting(r)?.manually_edited && (
              <p className="muted" style={{ color: 'var(--warn)' }}>
                该集已有手动修改过的记录，建议选择「合并」以免覆盖手动内容。
              </p>
            )}
            <div className="row" style={{ marginTop: 8 }}>
              <button disabled={!r.show || !!busyId} onClick={() => void act(r, 'confirmed')}>
                确认
              </button>
              <button className="secondary" disabled={!r.show || !!busyId} onClick={() => void act(r, 'merged')}>
                合并
              </button>
              <button className="ghost" disabled={!!busyId} onClick={() => void act(r, 'ignored')}>
                忽略
              </button>
            </div>
          </div>
        )
      })}
    </>
  )
}
