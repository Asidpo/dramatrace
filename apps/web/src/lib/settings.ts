export interface Settings {
  /** PocketBase 服务地址；留空 = 当前页面同源（开发模式走 Vite 代理，生产走 Nginx 代理） */
  serverUrl: string
  /** TMDB API Key（v3）；为空时 TMDB 搜索不可用，仅能手动词条 */
  tmdbKey: string
  /** TMDB API 基础地址（可换国内镜像） */
  tmdbBaseUrl: string
  /** 截图 OCR 服务地址（可选，Phase 4） */
  ocrUrl: string
}

const KEY = 'dramatrace_settings'

/** 内置候选：官方 + 社区镜像（社区镜像可用性需自行核实，可在设置里自由修改） */
export const TMDB_BASE_OPTIONS = [
  'https://api.themoviedb.org',
  'https://tmdb.nixsyspaus.org',
]

export const DEFAULT_SETTINGS: Settings = {
  serverUrl: '',
  tmdbKey: '',
  tmdbBaseUrl: 'https://api.themoviedb.org',
  ocrUrl: '',
}

export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(s))
}
