/**
 * PostgreSQL 采集指标编码常量（一期：基础监控闭环）。
 *
 * 命名规则与采集器保持一致，分组便于对照 monitor-collector-postgresql 实现：
 *   pg.availability / pg.uptime        ← PgAvailabilityItem
 *   pg.conn.*                          ← PgConnectionsItem
 *   pg.tps / pg.rate.* / pg.delta.* / pg.cache.*  ← PgDatabaseStatItem
 *   pg.locks.* / pg.blocked_sessions   ← PgLocksItem
 *   pg.trx.*                           ← PgTransactionsItem
 *   pg.repl.*                          ← PgReplicationItem
 *   pg.capacity.*                      ← PgCapacityItem（小时级）
 *   pg.setting.* / pg.setting_text.*   ← PgSettingsItem（天级）
 */
export const PG = {
  // ── 可用性 ──────────────────────────────────────────────────────────────
  AVAILABILITY:            'pg.availability',
  UPTIME:                  'pg.uptime',

  // ── 连接 ────────────────────────────────────────────────────────────────
  CONN_TOTAL:              'pg.conn.total',
  CONN_ACTIVE:             'pg.conn.active',
  CONN_IDLE:               'pg.conn.idle',
  CONN_IDLE_IN_TRX:        'pg.conn.idle_in_trx',
  CONN_WAITING:            'pg.conn.waiting',
  CONN_MAX:                'pg.conn.max',
  CONN_USAGE:              'pg.conn.usage',
  CONN_ACTIVE_PCT:         'pg.conn.active_pct',

  // ── 吞吐与缓存 ──────────────────────────────────────────────────────────
  TPS:                     'pg.tps',
  RATE_XACT_COMMIT:        'pg.rate.xact_commit',
  RATE_XACT_ROLLBACK:      'pg.rate.xact_rollback',
  CACHE_HIT_RATE:          'pg.cache.hit_rate',
  RATE_TUP_FETCHED:        'pg.rate.tup_fetched',
  RATE_TUP_INSERTED:       'pg.rate.tup_inserted',
  RATE_TUP_UPDATED:        'pg.rate.tup_updated',
  RATE_TUP_DELETED:        'pg.rate.tup_deleted',
  DELTA_TEMP_FILES:        'pg.delta.temp_files',
  RATE_TEMP_BYTES:         'pg.rate.temp_bytes',
  DELTA_DEADLOCKS:         'pg.delta.deadlocks',

  // ── 锁与事务 ────────────────────────────────────────────────────────────
  LOCKS_WAITING:           'pg.locks.waiting',
  BLOCKED_SESSIONS:        'pg.blocked_sessions',
  TRX_MAX_SECONDS:         'pg.trx.max_seconds',
  TRX_ACTIVE:              'pg.trx.active',
  TRX_IDLE_IN_TRX_MAX_SECONDS: 'pg.trx.idle_in_trx_max_seconds',

  // ── 复制 ────────────────────────────────────────────────────────────────
  REPL_IS_REPLICA:         'pg.repl.is_replica',
  REPL_LAG_SECONDS:        'pg.repl.lag_seconds',
  REPL_REPLICA_COUNT:      'pg.repl.replica_count',

  // ── 容量（小时级） ──────────────────────────────────────────────────────
  CAPACITY_DB_SIZE:        'pg.capacity.db_size_bytes',
  CAPACITY_TOTAL_SIZE:     'pg.capacity.total_size_bytes',

  // ── 关键参数（天级） ────────────────────────────────────────────────────
  SETTING_MAX_CONNECTIONS: 'pg.setting.max_connections',
  SETTING_SHARED_BUFFERS:  'pg.setting.shared_buffers_bytes',
  SETTING_WORK_MEM:        'pg.setting.work_mem_bytes',
  SETTING_TEXT_WAL_LEVEL:  'pg.setting_text.wal_level',
  SETTING_TEXT_AUTOVACUUM: 'pg.setting_text.autovacuum',
  SETTING_TEXT_VERSION:    'pg.setting_text.server_version',

  // ── 等待事件（分钟级采样，二期 C1） ─────────────────────────────────────
  WAITS_LOCK:              'pg.waits.lock_count',
  WAITS_LWLOCK:            'pg.waits.lwlock_count',
  WAITS_IO:                'pg.waits.io_count',
  WAITS_IPC:               'pg.waits.ipc_count',
  WAITS_CLIENT:            'pg.waits.client_count',
  WAITS_TIMEOUT:           'pg.waits.timeout_count',
  WAITS_OTHER:             'pg.waits.other_count',

  // ── 检查点与 bgwriter（分钟级，二期 C5） ────────────────────────────────
  CKPT_TIMED_DELTA:        'pg.ckpt.timed_delta',
  CKPT_REQ_DELTA:          'pg.ckpt.req_delta',
  BGW_CHECKPOINT_RATE:     'pg.bgwriter.buffers_checkpoint_rate',
  BGW_CLEAN_RATE:          'pg.bgwriter.buffers_clean_rate',
  BGW_BACKEND_RATE:        'pg.bgwriter.buffers_backend_rate',

  // ── WAL 与归档（分钟级，二期 C6） ───────────────────────────────────────
  WAL_WRITE_RATE:          'pg.wal.write_rate',
  WAL_ARCHIVED_DELTA:      'pg.wal.archived_delta',
  WAL_ARCHIVE_FAILED:      'pg.wal.archive_failed_delta',

  // ── 复制槽（分钟级，二期 C7） ───────────────────────────────────────────
  REPL_SLOTS_TOTAL:        'pg.repl.slots_total',
  REPL_SLOTS_INACTIVE:     'pg.repl.slots_inactive',
  REPL_SLOT_RETAINED_MAX:  'pg.repl.slot_retained_bytes_max',

  // ── 逐从库细分（分钟级对象指标，二期 C8） ───────────────────────────────
  PGREPL_LAG_BYTES:        'pgrepl.lag_bytes',
  PGREPL_WRITE_LAG_MS:     'pgrepl.write_lag_ms',
  PGREPL_FLUSH_LAG_MS:     'pgrepl.flush_lag_ms',
  PGREPL_REPLAY_LAG_MS:    'pgrepl.replay_lag_ms',

  // ── 实例级 I/O（分钟级，PG 16+，二期 C9） ───────────────────────────────
  IO_READ_RATE:            'pg.io.read_rate',
  IO_WRITE_RATE:           'pg.io.write_rate',
  IO_EXTEND_RATE:          'pg.io.extend_rate',

  // ── 膨胀 / XID / vacuum（小时级或分钟级，二期 C2~C4） ───────────────────
  BLOAT_DEAD_TUP_TOTAL:    'pg.bloat.dead_tup_total',
  BLOAT_DEAD_PCT_MAX:      'pg.bloat.dead_pct_max',
  BLOAT_TABLES_OVER_20PCT: 'pg.bloat.tables_over_20pct',
  BLOAT_TOP_TABLES:        'pg.bloat.top_tables',
  XID_AGE_MAX:             'pg.xid.age_max',
  XID_WRAPAROUND_PCT:      'pg.xid.wraparound_pct',
  VACUUM_RUNNING:          'pg.vacuum.running',
  VACUUM_XMIN_SECONDS:     'pg.vacuum.xmin_horizon_seconds',

  // ── 表热点（小时级对象指标，二期 D2） ───────────────────────────────────
  PGTABLE_SEQ_SCAN:        'pgtable.seq_scan',
  PGTABLE_IDX_SCAN:        'pgtable.idx_scan',
  PGTABLE_READ_ROWS:       'pgtable.read_rows',
  PGTABLE_WRITE_ROWS:      'pgtable.write_rows',

  // ── 索引分析（天级文本，二期 D2） ───────────────────────────────────────
  INDEX_INVALID_LIST:      'pg.index.invalid_list'
} as const
