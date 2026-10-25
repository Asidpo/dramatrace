import { useEffect, useState } from 'react'
import { logout } from '../lib/pb'
import {
  clearQueue,
  conflictCount,
  flushQueue,
  pendingOpsCount,
} from '../lib/offline'
import { getSettings, saveSettings, TMDB_BASE_OPTIONS, type Settings } from '../lib/settings'

export default function Settings() {
  const [s, setS] = useState<Settings>(getSettings())
  const [queueN, setQueueN] = useState(0)
  const [confN, setConfN] = useState(0)
  const [msg, setMsg] = useState('')

  async function refreshCounts() {
    setQueueN(await pendingOpsCount())
    setConfN(await conflictCount())
  }

  useEffect(() => {
    void refreshCounts()
  }, [])

  function save() {
    saveSettings(s)
    setMsg('已保存。服务器地址修改后重新登录生效。')
  }

  async function syncNow() {
    setMsg('')
    const ok = await flushQueue()
    await refreshCounts()
    setMsg(ok ? '同步完成' : '部分记录仍待同步（网络不可用？）')
  }

  async function doClearQueue() {
    if (!window.confirm('确定清空离线队列？未同步的记录将丢失。')) return
    await clearQueue()
    await refreshCounts()
    setMsg('离线队列已清空')
  }

  function doLogout() {
    logout()
    window.location.reload()
  }

  return (
    <>
      <h1 className="page-title">设置</h1>

      <div className="card">
        <label>服务器地址（PocketBase，留空 = 当前页面同源）</label>
        <input
          placeholder="http://192.168.1.10:8090"
          value={s.serverUrl}
          onChange={(e) => setS({ ...s, serverUrl: e.target.value.trim() })}
        />
        <p className="muted">
          Android 端需填服务器完整地址（局域网 IP 或域名）；网页端留空即可。
        </p>

        <label>TMDB API Key（v3）</label>
        <input
          placeholder="留空则只能手动添加剧集"
          value={s.tmdbKey}
          onChange={(e) => setS({ ...s, tmdbKey: e.target.value.trim() })}
        />
        <p className="muted">
          免费注册获取：themoviedb.org → 账户设置 → API → 申请 API Key（v3）。
        </p>

        <label>TMDB API 基础地址</label>
        <input
          list="tmdb-bases"
          value={s.tmdbBaseUrl}
          onChange={(e) => setS({ ...s, tmdbBaseUrl: e.target.value.trim() })}
        />
        <datalist id="tmdb-bases">
          {TMDB_BASE_OPTIONS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        <p className="muted">官方接口不通时可换成社区镜像（可用性自行核实）。</p>

        <label>截图 OCR 服务地址（可选）</label>
        <input
          placeholder="http://192.168.1.10:8091"
          value={s.ocrUrl}
          onChange={(e) => setS({ ...s, ocrUrl: e.target.value.trim() })}
        />
        <p className="muted">自托管 PaddleOCR 服务地址，配置后即可使用截图自动记录。</p>

        <div style={{ marginTop: 16 }}>
          <button onClick={save}>保存设置</button>
        </div>
        {msg && <p className="ok-text">{msg}</p>}
      </div>

      <div className="card">
        <div className="row between">
          <div>
            <strong>离线队列</strong>
            <div className="muted">
              {queueN} 条待同步{confN > 0 ? `，其中 ${confN} 条与服务端冲突` : ''}
            </div>
          </div>
          <div className="row">
            <button className="secondary" onClick={() => void syncNow()} disabled={!queueN}>
              立即同步
            </button>
            <button className="ghost danger" onClick={() => void doClearQueue()} disabled={!queueN}>
              清空
            </button>
          </div>
        </div>
        {confN > 0 && (
          <p className="muted" style={{ marginTop: 8 }}>
            冲突说明：同一集在本地与服务端都有记录。保留本地版本的冲突记录会被跳过，
            可到对应剧集页手动核对后编辑保存。
          </p>
        )}
      </div>

      <div className="card">
        <div className="row between">
          <div>
            <strong>账号</strong>
            <div className="muted">单用户模式：即 PocketBase 超级管理员</div>
          </div>
          <button className="danger" onClick={doLogout}>
            退出登录
          </button>
        </div>
      </div>

      <p className="muted">剧迹 DramaTrace v0.1 · MIT License · 数据全部存储在你的自托管服务上</p>
    </>
  )
}
