/// <reference path="../pb_data/types.d.ts" />

// DramaTrace 服务端规则（PocketBase v0.40 钩子 API）
// 单用户模式：所有集合 API 规则均为 null（= 仅超级管理员可访问）。
// 以下钩子保证数据一致性：
//   1. 手动标记保护：manually_edited 一旦为 true，任何更新不得改回 false。
//   2. pending_records 创建或更新为 confirmed 前，目标进度若被手动编辑过，
//      拒绝直接覆盖（须走人工合并）。
//   3. progress 创建/更新后写 history_log 审计流水。
//
// v0.40 源码核实的重要语义（与旧版不同）：
//   - 钩子回调在独立「执行器 VM」中运行，看不到本文件顶层声明的函数/变量；
//     每个 handler 必须自包含，只能使用 $app、Record、ForbiddenError、console 等全局绑定。
//   - 每个 handler 必须 return e.next() 才能继续钩子链；before 类钩子 throw
//     ApiError（ForbiddenError/BadRequestError）会中止保存并返回对应状态码；
//     after 类钩子里任何异常都会被吞掉，且必须调用 e.next() 保证链末端后处理执行。
//   - e.record.original() 返回更新前的 DB 状态副本；新建记录时为空记录。

// ── 规则 1：手动标记不可被清除 ─────────────────────────────
onRecordUpdate((e) => {
  const orig = e.record.original()
  if (orig) {
    const wasManual = orig.getBool('manually_edited') === true
    const isManual = e.record.getBool('manually_edited') === true

    if (wasManual && !isManual) {
      throw new ForbiddenError(
        'manually_edited 标记不可被清除：该进度已被手动编辑，如需覆盖请先删除记录后重新同步',
      )
    }
  }
  return e.next()
}, 'progress')

// ── 规则 2：pending 确认前校验目标进度未被手动编辑（创建与更新都拦） ─
const pendingGuard = (e) => {
  if (e.record.getString('status') === 'confirmed') {
    const showId = e.record.getString('show')
    const season = e.record.getInt('match_season')
    const episode = e.record.getInt('match_episode')

    if (showId) {
      const target = $app.findFirstRecordByFilter(
        'progress',
        'show = {:showId} && season_number = {:season} && episode_number = {:episode}',
        { showId: showId, season: season, episode: episode },
      )

      if (target && target.getBool('manually_edited') === true) {
        throw new ForbiddenError(
          '目标进度已被手动编辑，直接确认会覆盖手动数据，请使用「合并」处理',
        )
      }
    }
  }
  return e.next()
}
onRecordUpdate(pendingGuard, 'pending_records')
onRecordCreate(pendingGuard, 'pending_records')

// ── 规则 3：progress 变更写审计流水（自包含 handler，创建/更新共用） ─
const auditProgress = (e) => {
  try {
    const LOGGED_FIELDS = [
      'position_seconds',
      'episode_completed',
      'show_completed',
      'device',
      'watched_at',
      'note',
      'manually_edited',
      'source',
    ]
    const rec = e.record
    const orig = rec.original()
    const logCollection = $app.findCollectionByNameOrId('history_log')
    const source = e.type === 'create' ? 'create' : 'update'

    for (const f of LOGGED_FIELDS) {
      const oldVal = orig ? orig.get(f) : null
      const newVal = rec.get(f)

      if (JSON.stringify(oldVal ?? null) !== JSON.stringify(newVal ?? null)) {
        const entry = new Record(logCollection)
        entry.set('progress', rec.id)
        entry.set('field', f)
        entry.set('old_value', oldVal ?? null)
        entry.set('new_value', newVal ?? null)
        entry.set('source', source)
        $app.save(entry)
      }
    }
  } catch (err) {
    console.error('history_log 写入失败：', err)
  }
  return e.next()
}
onRecordAfterUpdateSuccess(auditProgress, 'progress')
onRecordAfterCreateSuccess(auditProgress, 'progress')
