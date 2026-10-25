import PocketBase from 'pocketbase'
import { getSettings } from './settings'

let client: PocketBase | null = null

function createClient(): PocketBase {
  const url = getSettings().serverUrl || window.location.origin
  return new PocketBase(url)
}

/** 获取当前客户端；修改设置后调用 reconfigure() 使其生效 */
export function getPb(): PocketBase {
  if (!client) client = createClient()
  return client
}

export function reconfigure(): void {
  client = null
}

export function logout(): void {
  client?.authStore.clear()
  client = null
}
