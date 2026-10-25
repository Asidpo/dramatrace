import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listProgress, listShows, networkError, saveShow } from '../lib/api'
import {
  cacheShows,
  conflictCount,
  flushQueue,
  loadProgressCached,
  loadShowsCached,
  pendingOpsCount,
} from '../lib/offline'
import { getSettings } from '../lib/settings'
import { posterUrl, tmdbSearch, type TmdbShow } from '../lib/tmdb'
import type { Progress, Show } from '../lib/types'

function fmtPosition(seconds?: number): string {
  if (seconds === undefined || seconds === null || seconds <= 0) return '未看'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}小时${m}分` : `${m}分钟`
}

function AddShowModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const settings = getSettings()
  const [tab, setTab] = useState<'tmdb' | 'manual'>('tmdb')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TmdbShow[]>([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualSeasons, setManualSeasons] = useState('')

  async function search() {
    setBusy(true)
    setErr('')
    try {
      setResults(await tmdbSearch(settings, query))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function add(t: TmdbShow) {
    setBusy(true)
    setErr('')
    try {
      await saveShow({
        name: t.name,
        original_name: t.original_name,
        tmdb_id: t.id,
        first_air_date: t.first_air_date,
        poster_url: posterUrl(settings, t.poster_path),
        overview: t.overview,
        total_seasons: t.number_of_seasons,
        source: 'tmdb',
      })
      onAdded()
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function addManual() {
    if (!manualName.trim()) return
    setBusy(true)
    setErr('')
    try {
      await saveShow({
        name: manualName.trim(),
        total_seasons: manualSeasons ? Number(manualSeasons) : undefined,
        source: 'manual',
      })
      onAdded()
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h3 style={{ margin: 0 }}>添加剧集</h3>
          <button className="ghost" onClick={onClose}>✕</button>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className={tab === 'tmdb' ? '' : 'secondary'} onClick={() => setTab('tmdb')}>
            TMDB 搜索
          </button>
          <button className={tab === 'manual' ? '' : 'secondary'} onClick={() => setTab('manual')}>
            手动添加
          </button>
        </div>

        {tab === 'tmdb' ? (
          <>
            <label>剧名</label>
            <div className="row">
              <input
                className="grow"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && search()}
                placeholder="例如：三体、开端"
              />
              <button onClick={search} disabled={busy}>搜索</button>
            </div>
            {err && <p className="error">{err}</p>}
            <div className="search-results" style={{ marginTop: 12 }}>
              {results.map((t) => (
                <div key={t.id} className="card list-item row" onClick={() => add(t)}>
                  {t.poster_path && (
                    <img className="poster" src={posterUrl(settings, t.poster_path, 'w200')} alt="" />
                  )}
                  <div className="grow">
                    <div style={{ fontWeight: 600 }}>{t.name}</div>
                    <div className="muted">
                      {t.original_name && t.original_name !== t.name ? `${t.original_name} · ` : ''}
                      {t.first_air_date?.slice(0, 4) ?? ''}
                      {t.number_of_seasons ? ` · ${t.number_of_seasons} 季` : ''}
                    </div>
                  </div>
                </div>
              ))}
              {!busy && !results.length && <p className="muted">输入剧名后点击搜索</p>}
            </div>
          </>
        ) : (
          <>
            <label>剧名</label>
            <input value={manualName} onChange={(e) => setManualName(e.target.value)} />
            <label>总季数（可选）</label>
            <input
              type="number"
              min={1}
              value={manualSeasons}
              onChange={(e) => setManualSeasons(e.target.value)}
            />
            <div style={{ marginTop: 18 }}>
              <button onClick={addManual} disabled={busy || !manualName.trim()}>
                添加
              </button>
            </div>
            {err && <p className="error">{err}</p>}
          </>
        )}
      </div>
    </div>
  )
}

export default function Library() {
  const nav = useNavigate()
  const [shows, setShows] = useState<Show[]>([])
  const [progress, setProgress] = useState<Progress[]>([])
  const [offline, setOffline] = useState(false)
  const [conflicts, setConflicts] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [pending, setPending] = useState(0)

  async function refresh() {
    try {
      const [s, p] = await Promise.all([listShows(), listProgress()])
      setShows(s)
      setProgress(p)
      setOffline(false)
      await cacheShows(s)
    } catch (e) {
      if (networkError(e)) {
        setOffline(true)
        setShows(await loadShowsCached())
        setProgress(await loadProgressCached())
      }
    }
    try {
      await flushQueue()
    } catch {
      /* 忽略同步失败，下次再试 */
    }
    setConflicts(await conflictCount())
    setPending(await pendingOpsCount())
    setLoaded(true)
  }

  useEffect(() => {
    void refresh()
    const t = setInterval(() => void refresh(), 30000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const latestByShow = useMemo(() => {
    const map = new Map<string, Progress>()
    for (const p of progress) {
      const cur = map.get(p.show)
      if (!cur || (p.watched_at ?? '') > (cur.watched_at ?? '')) map.set(p.show, p)
    }
    return map
  }, [progress])

  return (
    <>
      <div className="row between">
        <h1 className="page-title" style={{ margin: '8px 0' }}>我的追剧</h1>
        <button onClick={() => setShowModal(true)}>＋ 添加剧</button>
      </div>
      {offline && (
        <div className="card" style={{ border: '1px solid var(--warn)' }}>
          离线模式：显示本地缓存，新记录会先保存在本地，联网后自动同步。
        </div>
      )}
      {conflicts > 0 && (
        <div className="card" style={{ border: '1px solid var(--danger)' }}>
          {conflicts} 条离线记录与服务端冲突，请在「设置 → 离线队列」处理。
        </div>
      )}
      {pending > 0 && <p className="muted">{pending} 条记录待同步</p>}

      {loaded && !shows.length && <p className="muted">还没有剧，点击右上角「＋ 添加剧」开始。</p>}

      {shows.map((s) => {
        const latest = latestByShow.get(s.id)
        return (
          <div key={s.id} className="card list-item row" onClick={() => nav(`/show/${s.id}`)}>
            {s.poster_url && <img className="poster" src={s.poster_url} alt="" />}
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{s.name}</div>
              <div className="muted">
                {s.first_air_date?.slice(0, 4) ? `${s.first_air_date.slice(0, 4)} · ` : ''}
                {s.total_seasons ? `${s.total_seasons} 季` : ''}
                {s.source === 'manual' ? ' · 手动添加' : ''}
              </div>
              {latest && (
                <div style={{ marginTop: 6 }}>
                  <span className="badge">
                    S{latest.season_number}E{latest.episode_number} · {fmtPosition(latest.position_seconds)}
                  </span>{' '}
                  {latest.episode_completed && <span className="badge ok">本集看完</span>}
                  {latest.show_completed && <span className="badge ok">已完结</span>}
                  {latest.source === 'auto' && <span className="badge auto">自动</span>}
                </div>
              )}
            </div>
            <span className="muted">›</span>
          </div>
        )
      })}

      {showModal && <AddShowModal onClose={() => setShowModal(false)} onAdded={() => void refresh()} />}
    </>
  )
}
