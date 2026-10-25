import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  deleteProgress,
  listProgress,
  listShows,
  networkError,
  upsertProgress,
} from '../lib/api'
import {
  deleteProgressLocal,
  flushQueue,
  isLocalId,
  loadProgressCached,
  loadShowsCached,
  newLocalId,
  upsertProgressLocal,
} from '../lib/offline'
import type { DeviceKind, Progress, Show } from '../lib/types'

function toLocalInputValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

const DEVICE_LABELS: Record<DeviceKind, string> = {
  mobile: '手机',
  tv: '电视',
  web: '网页',
  other: '其他',
}

export default function ShowDetail() {
  const { id } = useParams<{ id: string }>()
  const [show, setShow] = useState<Show | null>(null)
  const [records, setRecords] = useState<Progress[]>([])
  const [msg, setMsg] = useState('')

  // 表单
  const [season, setSeason] = useState('1')
  const [episode, setEpisode] = useState('1')
  const [positionMin, setPositionMin] = useState('')
  const [device, setDevice] = useState<DeviceKind>('mobile')
  const [watchedAt, setWatchedAt] = useState(() => toLocalInputValue(new Date()))
  const [epDone, setEpDone] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const [note, setNote] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  async function refresh() {
    let s: Show | null = null
    try {
      const shows = await listShows()
      s = shows.find((x) => x.id === id) ?? null
    } catch (e) {
      if (networkError(e)) {
        const cached = await loadShowsCached()
        s = cached.find((x) => x.id === id) ?? null
      }
    }
    setShow(s)
    try {
      setRecords(await listProgress(id))
    } catch (e) {
      if (networkError(e)) setRecords(await loadProgressCached(id))
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function resetForm() {
    setSeason('1')
    setEpisode('1')
    setPositionMin('')
    setDevice('mobile')
    setWatchedAt(toLocalInputValue(new Date()))
    setEpDone(false)
    setShowDone(false)
    setNote('')
    setEditingId(null)
  }

  function startEdit(p: Progress) {
    setSeason(String(p.season_number))
    setEpisode(String(p.episode_number))
    setPositionMin(p.position_seconds !== undefined ? String(Math.floor(p.position_seconds / 60)) : '')
    setDevice(p.device)
    setWatchedAt(toLocalInputValue(new Date(p.watched_at)))
    setEpDone(!!p.episode_completed)
    setShowDone(!!p.show_completed)
    setNote(p.note ?? '')
    setEditingId(p.id)
    window.scrollTo({ top: 0 })
  }

  async function save() {
    if (!show) return
    const sn = Number(season)
    const en = Number(episode)
    if (!Number.isFinite(sn) || sn < 1 || !Number.isFinite(en) || en < 1) {
      setMsg('季/集号必须是正整数')
      return
    }
    const existing = editingId ? records.find((r) => r.id === editingId) : undefined
    const payload: Progress = {
      id: editingId ?? '',
      show: show.id,
      season_number: sn,
      episode_number: en,
      position_seconds: positionMin === '' ? 0 : Math.round(Number(positionMin) * 60),
      device,
      watched_at: new Date(watchedAt).toISOString(),
      episode_completed: epDone,
      show_completed: showDone,
      note: note.trim() || undefined,
      source: existing?.source ?? 'manual',
      manually_edited: true,
    }
    setMsg('')
    try {
      await upsertProgress(payload)
      setMsg('已保存并同步到服务端')
      resetForm()
      await refresh()
      await flushQueue()
    } catch (e) {
      if (networkError(e)) {
        const local = { ...payload, id: editingId ?? newLocalId() }
        await upsertProgressLocal(local)
        setMsg('网络不可用：已离线保存，联网后自动同步')
        resetForm()
        await refresh()
      } else {
        setMsg(e instanceof Error ? e.message : String(e))
      }
    }
  }

  async function remove(p: Progress) {
    if (!window.confirm(`删除 S${p.season_number}E${p.episode_number} 的记录？`)) return
    try {
      await deleteProgress(p.id)
      await refresh()
    } catch (e) {
      if (networkError(e) || isLocalId(p.id)) {
        await deleteProgressLocal(p)
        await refresh()
        setMsg('已离线删除，联网后同步')
      } else {
        setMsg(e instanceof Error ? e.message : String(e))
      }
    }
  }

  if (!show) return <div className="loading">加载中…</div>

  const sorted = [...records].sort(
    (a, b) => b.season_number - a.season_number || b.episode_number - a.episode_number,
  )

  return (
    <>
      <h1 className="page-title">{show.name}</h1>
      {show.overview && <p className="muted" style={{ marginTop: -6 }}>{show.overview}</p>}

      <div className="card">
        <div className="row between">
          <span style={{ fontWeight: 600 }}>
            {editingId ? '编辑记录' : '记录进度'}
          </span>
          {editingId && (
            <button className="ghost" onClick={resetForm}>
              取消编辑
            </button>
          )}
        </div>
        <div className="field-grid">
          <div>
            <label>第几季</label>
            <input type="number" min={1} value={season} onChange={(e) => setSeason(e.target.value)} />
          </div>
          <div>
            <label>第几集</label>
            <input type="number" min={1} value={episode} onChange={(e) => setEpisode(e.target.value)} />
          </div>
          <div>
            <label>看到第几分钟（可选）</label>
            <input
              type="number"
              min={0}
              placeholder="0"
              value={positionMin}
              onChange={(e) => setPositionMin(e.target.value)}
            />
          </div>
          <div>
            <label>观看设备</label>
            <select value={device} onChange={(e) => setDevice(e.target.value as DeviceKind)}>
              {Object.entries(DEVICE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label>观看时间</label>
            <input type="datetime-local" value={watchedAt} onChange={(e) => setWatchedAt(e.target.value)} />
          </div>
          <div>
            <label>状态</label>
            <div className="row" style={{ marginTop: 10 }}>
              <label style={{ margin: 0, display: 'flex', gap: 6, alignItems: 'center', color: 'var(--text)' }}>
                <input
                  type="checkbox"
                  style={{ width: 'auto' }}
                  checked={epDone}
                  onChange={(e) => setEpDone(e.target.checked)}
                />
                本集看完
              </label>
              <label style={{ margin: 0, display: 'flex', gap: 6, alignItems: 'center', color: 'var(--text)' }}>
                <input
                  type="checkbox"
                  style={{ width: 'auto' }}
                  checked={showDone}
                  onChange={(e) => setShowDone(e.target.checked)}
                />
                整剧看完
              </label>
            </div>
          </div>
        </div>
        <label>备注</label>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：和对象一起看的" />
        <div style={{ marginTop: 16 }}>
          <button onClick={() => void save()}>{editingId ? '保存修改' : '保存记录'}</button>
        </div>
        {msg && (msg.includes('离线') ? <p className="muted">{msg}</p> : <p className="error">{msg}</p>)}
      </div>

      <div className="section-title">观看记录（{records.length}）</div>
      {sorted.map((p) => (
        <div key={p.id} className="card row">
          <div className="grow">
            <div>
              <strong>
                S{p.season_number}E{p.episode_number}
              </strong>{' '}
              <span className="badge">{DEVICE_LABELS[p.device]}</span>{' '}
              {p.source === 'auto' && <span className="badge auto">自动</span>}
              {p.manually_edited && <span className="badge warn">已手动修改</span>}
            </div>
            <div className="muted">
              {new Date(p.watched_at).toLocaleString('zh-CN')}
              {p.position_seconds ? ` · 第 ${Math.floor(p.position_seconds / 60)} 分钟` : ''}
              {p.episode_completed ? ' · 看完' : ''}
              {p.show_completed ? ' · 全剧完结' : ''}
              {p.note ? ` · ${p.note}` : ''}
              {isLocalId(p.id) && ' · 未同步'}
            </div>
          </div>
          <button className="ghost" onClick={() => startEdit(p)}>编辑</button>
          <button className="ghost danger" onClick={() => void remove(p)}>删除</button>
        </div>
      ))}
      {!sorted.length && <p className="muted">还没有记录。</p>}
    </>
  )
}
