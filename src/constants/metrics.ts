/**
 * MySQL 采集指标编码常量。
 *
 * 命名规则与采集器保持一致，分组便于对照 collector 实现：
 *   mysql.qps / mysql.tps                  ← ThroughputItem
 *   mysql.perf.*                            ← ResponseTimeItem
 *   mysql.status.*                          ← GlobalStatusItem (gauge)
 *   mysql.rate.*                            ← GlobalStatusItem (counter rate)
 *   mysql.delta.*                           ← GlobalStatusItem (extra delta)
 *   mysql.conn.*                            ← ConnectionsItem
 *   mysql.innodb.*                          ← InnodbBufferPoolItem / InnodbTrxItem / LockWaitsItem
 *   mysql.capacity.*                        ← TableCapacityItem（数值汇总）
 *   capacity.*                              ← CapacityObjectItem（对象级，存 metric_capacity_object）
 *   mysql.replication.*                     ← ReplicationItem
 *   mysql.var.*                             ← VariablesItem (数值变量，天级)
 *   mysql.var_text.*                        ← VariablesItem (文本变量，天级)
 */
export const M = {
  // ── 吞吐 ────────────────────────────────────────────────────────────────
  QPS:                     'mysql.qps',
  TPS:                     'mysql.tps',

  // ── 语句平均响应时间 ───────────────────────────────────────────────────
  AVG_STMT_LATENCY_MS:     'mysql.perf.avg_stmt_latency_ms',

  // ── 慢查询（周期增量） ─────────────────────────────────────────────────
  DELTA_SLOW_QUERIES:      'mysql.delta.slow_queries',
  DELTA_TMP_TABLES:        'mysql.delta.created_tmp_tables',
  DELTA_TMP_DISK_TABLES:   'mysql.delta.created_tmp_disk_tables',

  // ── 连接异常（周期增量） ───────────────────────────────────────────────
  DELTA_ABORTED_CONNECTS:  'mysql.delta.aborted_connects',
  DELTA_CONN_REJECTED:     'mysql.delta.connection_errors_max_connections',

  // ── 网络流量（速率，字节/秒） ──────────────────────────────────────────
  RATE_BYTES_RECEIVED:     'mysql.rate.Bytes_received',
  RATE_BYTES_SENT:         'mysql.rate.Bytes_sent',

  // ── 访问模式（Handler / Select 类型速率） ──────────────────────────────
  RATE_HANDLER_READ_KEY:      'mysql.rate.Handler_read_key',
  RATE_HANDLER_READ_RND_NEXT: 'mysql.rate.Handler_read_rnd_next',
  RATE_SELECT_SCAN:           'mysql.rate.Select_scan',
  RATE_SELECT_FULL_JOIN:      'mysql.rate.Select_full_join',

  // ── 等待事件（本周期各大类等待毫秒数，5.7/8.0） ───────────────────────
  WAITS_IO_FILE_MS:        'mysql.waits.io_file_ms',
  WAITS_IO_TABLE_MS:       'mysql.waits.io_table_ms',
  WAITS_LOCK_MS:           'mysql.waits.lock_ms',
  WAITS_SYNCH_MS:          'mysql.waits.synch_ms',
  WAITS_OTHER_MS:          'mysql.waits.other_ms',
  WAITS_TOP_EVENTS:        'mysql.waits.top_events',

  // ── InnoDB 状态解析 ────────────────────────────────────────────────────
  HISTORY_LIST_LENGTH:     'mysql.innodb.history_list_length',
  LATEST_DEADLOCK:         'mysql.innodb.latest_deadlock',

  // ── 安全（8.0 错误日志登录失败） ───────────────────────────────────────
  ACCESS_DENIED_COUNT:     'mysql.security.access_denied_count',

  // ── 安全审计（权限变更/危险操作，5.7/8.0） ─────────────────────────────
  PRIV_CHANGE_DELTA:       'mysql.security.priv_change_delta',
  DANGEROUS_OP_DELTA:      'mysql.security.dangerous_op_delta',
  AUDIT_EVENTS:            'mysql.security.audit_events',

  // ── 认证失败与暴力破解 ─────────────────────────────────────────────────
  AUTH_FAIL_DELTA:         'mysql.security.auth_fail_delta',
  BRUTE_FORCE_SUSPECT:     'mysql.security.brute_force_suspect',
  AUTH_FAIL_SOURCES:       'mysql.security.auth_fail_sources',

  // ── 连接来源白名单 ─────────────────────────────────────────────────────
  UNKNOWN_SOURCE_COUNT:    'mysql.security.unknown_source_count',
  UNKNOWN_SOURCES:         'mysql.security.unknown_sources',

  // ── 审计插件对接（天级） ───────────────────────────────────────────────
  AUDIT_PLUGIN_ACTIVE:     'mysql.security.audit_plugin_active',
  AUDIT_PLUGIN_INFO:       'mysql.security.audit_plugin_info',

  // ── SSL（天级） ────────────────────────────────────────────────────────
  SSL_ENABLED:             'mysql.security.ssl_enabled',
  SSL_CERT_DAYS_LEFT:      'mysql.security.ssl_cert_days_left',
  SSL_INFO:                'mysql.security.ssl_info',

  // ── 表级锁 ─────────────────────────────────────────────────────────────
  TABLE_IN_USE_COUNT:      'mysql.lock.table_in_use_count',
  TABLE_NAME_LOCKED_COUNT: 'mysql.lock.table_name_locked_count',
  OPEN_TABLES_DETAIL:      'mysql.lock.open_tables_detail',
  RATE_TABLE_LOCKS_WAITED: 'mysql.rate.Table_locks_waited',

  // ── 表缓存 ─────────────────────────────────────────────────────────────
  OPEN_TABLES:             'mysql.status.Open_tables',
  RATE_OPENED_TABLES:      'mysql.rate.Opened_tables',

  // ── 连接（ConnectionsItem） ────────────────────────────────────────────
  CONN_TOTAL:              'mysql.conn.total',
  CONN_ACTIVE:             'mysql.conn.active',
  CONN_MAX:                'mysql.conn.max',
  CONN_USAGE:              'mysql.conn.usage',

  // ── 连接状态分布（ProcesslistItem） ────────────────────────────────────
  CONN_STATE_SLEEP:        'mysql.conn.state.sleep',
  CONN_STATE_QUERY:        'mysql.conn.state.query',
  CONN_STATE_LOCKED:       'mysql.conn.state.locked',
  CONN_STATE_OTHER:        'mysql.conn.state.other',
  CONN_LONG_RUNNING:       'mysql.conn.long_running_count',

  // ── 连接来源 Top N（ProcesslistItem，对象级） ──────────────────────────
  OBJ_CONN_SOURCE_TOTAL:   'conn.source.total',
  OBJ_CONN_SOURCE_ACTIVE:  'conn.source.active',

  // ── InnoDB Buffer Pool ─────────────────────────────────────────────────
  BP_HIT_RATE:             'mysql.innodb.buffer_pool_hit_rate',
  BP_DIRTY_RATIO:          'mysql.innodb.dirty_page_ratio',
  BP_USAGE:                'mysql.innodb.buffer_pool_usage',
  BP_BYTES_DATA:           'mysql.innodb.buffer_pool_bytes_data',
  BP_BYTES_DIRTY:          'mysql.innodb.buffer_pool_bytes_dirty',
  BP_PAGES_FLUSHED_RATE:   'mysql.rate.Innodb_buffer_pool_pages_flushed',

  // ── InnoDB 事务 ────────────────────────────────────────────────────────
  TRX_ACTIVE:              'mysql.innodb.trx_active',
  TRX_MAX_SECONDS:         'mysql.innodb.trx_max_seconds',

  // ── 锁 ──────────────────────────────────────────────────────────────────
  LOCK_WAITS:              'mysql.innodb.lock_waits',
  BLOCKED_SESSIONS:        'mysql.innodb.blocked_sessions',
  DEADLOCK_COUNT:          'mysql.innodb.deadlock_count',
  LOCK_TIMEOUT_COUNT:      'mysql.innodb.lock_timeout_count',

  // ── 容量（实例级汇总） ─────────────────────────────────────────────────
  CAPACITY_DATA_BYTES:     'mysql.capacity.data_size_bytes',
  CAPACITY_INDEX_BYTES:    'mysql.capacity.index_size_bytes',
  CAPACITY_TOTAL_BYTES:    'mysql.capacity.total_size_bytes',
  CAPACITY_TABLE_COUNT:    'mysql.capacity.table_count',

  // ── 容量（对象级，metric_capacity_object，用于 Top N 查询）─────────────
  OBJ_TABLE_TOTAL_BYTES:   'capacity.total_size_bytes',
  OBJ_TABLE_DATA_BYTES:    'capacity.data_size_bytes',
  OBJ_TABLE_INDEX_BYTES:   'capacity.index_size_bytes',
  OBJ_TABLE_ROWS:          'capacity.table_rows',

  // ── 表 I/O 热点（TableIoStatItem，对象级，小时差值，5.7/8.0）───────────
  OBJ_TABLEIO_READ:        'tableio.read_count',
  OBJ_TABLEIO_WRITE:       'tableio.write_count',
  OBJ_TABLEIO_WAIT_MS:     'tableio.wait_ms',
  IDX_UNUSED_LIST:         'mysql.index.unused_list',

  // ── 基线学习与异常检测（BaselineDetectJobHandler，小时级）──────────────
  BASELINE_QPS_DEV_PCT:    'mysql.baseline.qps_deviation_pct',
  BASELINE_QPS_ANOMALY:    'mysql.baseline.qps_anomaly',
  BASELINE_CONN_DEV_PCT:   'mysql.baseline.conn_deviation_pct',
  BASELINE_CONN_ANOMALY:   'mysql.baseline.conn_anomaly',

  // ── Binlog（小时级采集） ───────────────────────────────────────────────
  BINLOG_TOTAL_BYTES:      'mysql.binlog.total_bytes',

  // ── 错误日志（小时级采集） ─────────────────────────────────────────────
  ERRORLOG_ERROR_COUNT:    'mysql.errorlog.error_count',
  ERRORLOG_WARNING_COUNT:  'mysql.errorlog.warning_count',

  // ── 复制 ────────────────────────────────────────────────────────────────
  REPL_IS_REPLICA:         'mysql.replication.is_replica',
  REPL_SECONDS_BEHIND:     'mysql.replication.seconds_behind',
  REPL_IO_RUNNING:         'mysql.replication.io_running',
  REPL_SQL_RUNNING:        'mysql.replication.sql_running',

  // ── 配置变量（数值型，天级） ───────────────────────────────────────────
  VAR_MAX_CONNECTIONS:     'mysql.var.max_connections',
  VAR_BP_SIZE:             'mysql.var.innodb_buffer_pool_size',
  VAR_WAIT_TIMEOUT:        'mysql.var.wait_timeout',
  VAR_LONG_QUERY_TIME:     'mysql.var.long_query_time',
  VAR_TMP_TABLE_SIZE:      'mysql.var.tmp_table_size',
} as const

export type MetricCode = typeof M[keyof typeof M]
