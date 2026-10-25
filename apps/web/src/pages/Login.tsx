import { useState } from 'react'
import type { FormEvent } from 'react'
import { login } from '../lib/api'
import { reconfigure } from '../lib/pb'
import { getSettings, saveSettings } from '../lib/settings'

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [settings, setSettings] = useState(getSettings())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      saveSettings(settings)
      reconfigure()
      await login(email.trim(), password)
      onLogin()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="content" style={{ maxWidth: 420, margin: '0 auto', paddingTop: '12vh' }}>
      <h1 className="page-title">剧迹 DramaTrace</h1>
      <p className="muted">跨设备追剧记录 · 数据自托管</p>
      <form onSubmit={submit}>
        <label>服务器地址（留空 = 当前页面地址）</label>
        <input
          type="url"
          placeholder="http://192.168.1.10:8090"
          value={settings.serverUrl}
          onChange={(e) => setSettings({ ...settings, serverUrl: e.target.value.trim() })}
        />
        <label>管理员邮箱</label>
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label>密码</label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div style={{ marginTop: 18 }}>
          <button type="submit" disabled={busy} style={{ width: '100%' }}>
            {busy ? '登录中…' : '登录'}
          </button>
        </div>
      </form>
      {err && <p className="error">{err}</p>}
      <p className="muted" style={{ marginTop: 16 }}>
        提示：登录账号即自托管服务的超级管理员账号，与手机端共用。
      </p>
    </div>
  )
}
