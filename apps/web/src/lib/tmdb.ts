import type { Settings } from './settings'

export interface TmdbShow {
  id: number
  name: string
  original_name?: string
  first_air_date?: string
  overview?: string
  poster_path?: string | null
  number_of_seasons?: number
}

export async function tmdbSearch(s: Settings, q: string): Promise<TmdbShow[]> {
  if (!s.tmdbKey.trim()) {
    throw new Error('未配置 TMDB API Key：请到设置页填写，或使用「手动添加」')
  }
  const url =
    `${s.tmdbBaseUrl}/3/search/tv?api_key=${encodeURIComponent(s.tmdbKey)}` +
    `&query=${encodeURIComponent(q)}&language=zh-CN`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`TMDB 请求失败：HTTP ${res.status}`)
  const data = (await res.json()) as { results?: TmdbShow[] }
  return (data.results ?? []).slice(0, 20)
}

/**
 * 海报图地址：官方源走 image.tmdb.org；镜像源一般约定在镜像主机 /t/p/ 路径下代理图片。
 */
export function posterUrl(s: Settings, path: string | null | undefined, size = 'w500'): string {
  if (!path) return ''
  if (s.tmdbBaseUrl.includes('api.themoviedb.org')) {
    return `https://image.tmdb.org/t/p/${size}${path}`
  }
  return `${s.tmdbBaseUrl.replace(/\/3\/?$/, '')}/t/p/${size}${path}`
}
