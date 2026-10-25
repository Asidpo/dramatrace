export interface Show {
  id: string
  collectionId?: string
  collectionName?: string
  name: string
  original_name?: string
  tmdb_id?: number
  first_air_date?: string
  poster_url?: string
  overview?: string
  total_seasons?: number
  source: 'tmdb' | 'manual'
  created?: string
  updated?: string
}

export type DeviceKind = 'mobile' | 'tv' | 'web' | 'other'

export interface Progress {
  id: string
  show: string
  season_number: number
  episode_number: number
  position_seconds?: number
  duration_seconds?: number
  device: DeviceKind
  watched_at: string
  episode_completed?: boolean
  show_completed?: boolean
  note?: string
  source: 'manual' | 'auto'
  manually_edited?: boolean
  created?: string
  updated?: string
  expand?: { show?: Show }
}

export type PendingStatus = 'pending' | 'confirmed' | 'merged' | 'ignored'

export interface PendingRecord {
  id: string
  show?: string
  source_plugin: string
  raw_payload?: unknown
  parsed?: unknown
  match_season?: number
  match_episode?: number
  match_position_seconds?: number
  confidence?: number
  dedup_key: string
  status: PendingStatus
  created?: string
  expand?: { show?: Show }
}
