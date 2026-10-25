/// <reference path="../pb_data/types.d.ts" />

// DramaTrace 初始数据模型：shows / progress / pending_records / history_log
// 单用户模式：所有集合仅超级管理员可读写（API 规则），安全地自托管。

migrate(
  (app) => {
    // v0.40 语义：规则为 null = 仅超级管理员可访问（超级管理员绕过全部规则检查；
    // 空字符串 "" = 公开可访问）。单用户模式统一用 null。
    const superOnly = {
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
    }

    const shows = new Collection({
      type: 'base',
      name: 'shows',
      ...superOnly,
      fields: [
        { name: 'name', type: 'text', required: true, max: 200 },
        { name: 'original_name', type: 'text', max: 200 },
        { name: 'tmdb_id', type: 'number' },
        { name: 'first_air_date', type: 'text' },
        { name: 'poster_url', type: 'url' },
        { name: 'overview', type: 'text' },
        { name: 'total_seasons', type: 'number' },
        { name: 'source', type: 'select', required: true, max: 10, values: ['tmdb', 'manual'] },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX `idx_shows_tmdb` ON `shows` (`tmdb_id`)'],
    })
    app.save(shows)

    const progress = new Collection({
      type: 'base',
      name: 'progress',
      ...superOnly,
      fields: [
        { name: 'show', type: 'relation', collectionId: shows.id, maxSelect: 1, required: true, cascadeDelete: true },
        { name: 'season_number', type: 'number', required: true },
        { name: 'episode_number', type: 'number', required: true },
        { name: 'position_seconds', type: 'number' },
        { name: 'duration_seconds', type: 'number' },
        { name: 'device', type: 'select', required: true, max: 10, values: ['mobile', 'tv', 'web', 'other'] },
        { name: 'watched_at', type: 'date', required: true },
        { name: 'episode_completed', type: 'bool' },
        { name: 'show_completed', type: 'bool' },
        { name: 'note', type: 'text', max: 1000 },
        { name: 'source', type: 'select', required: true, max: 10, values: ['manual', 'auto'] },
        { name: 'manually_edited', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      // 去重核心：同一剧的同一集只有一条进度
      indexes: ['CREATE UNIQUE INDEX `idx_progress_unique` ON `progress` (`show`, `season_number`, `episode_number`)'],
    })
    app.save(progress)

    const pendingRecords = new Collection({
      type: 'base',
      name: 'pending_records',
      ...superOnly,
      fields: [
        { name: 'show', type: 'relation', collectionId: shows.id, maxSelect: 1, cascadeDelete: true },
        { name: 'source_plugin', type: 'text', required: true, max: 50 },
        { name: 'raw_payload', type: 'json' },
        { name: 'parsed', type: 'json' },
        { name: 'match_season', type: 'number' },
        { name: 'match_episode', type: 'number' },
        { name: 'match_position_seconds', type: 'number' },
        { name: 'confidence', type: 'number' },
        { name: 'dedup_key', type: 'text', required: true, max: 200 },
        { name: 'status', type: 'select', required: true, max: 10, values: ['pending', 'confirmed', 'merged', 'ignored'] },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      ],
      indexes: ['CREATE UNIQUE INDEX `idx_pending_dedup` ON `pending_records` (`dedup_key`)'],
    })
    app.save(pendingRecords)

    const historyLog = new Collection({
      type: 'base',
      name: 'history_log',
      // append-only：仅超级管理员可读，写入仅由服务端 hook 完成
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'progress', type: 'relation', collectionId: progress.id, maxSelect: 1, required: true, cascadeDelete: true },
        { name: 'field', type: 'text', required: true, max: 100 },
        { name: 'old_value', type: 'json' },
        { name: 'new_value', type: 'json' },
        { name: 'source', type: 'text', max: 50 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      ],
    })
    app.save(historyLog)
  },
  (app) => {
    for (const name of ['history_log', 'pending_records', 'progress', 'shows']) {
      try {
        const c = app.findCollectionByNameOrId(name)
        app.delete(c)
      } catch {
        /* 不存在则跳过 */
      }
    }
  },
)
