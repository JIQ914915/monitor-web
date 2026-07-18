/** SQL Server 分钟级与小时级性能/诊断指标编码，与 monitor-collector-sqlserver 保持一致。 */
export const SQLSERVER = {
  CONNECTIONS: 'sqlserver.conn.user',
  USER_SESSIONS: 'sqlserver.session.user',
  ACTIVE_REQUESTS: 'sqlserver.request.active',
  MAX_REQUEST_SECONDS: 'sqlserver.request.max_seconds',

  BATCH_REQUESTS: 'sqlserver.batch_requests_per_sec',
  COMPILATIONS: 'sqlserver.compilations_per_sec',
  RECOMPILATIONS: 'sqlserver.recompilations_per_sec',

  RUNNABLE_TASKS: 'sqlserver.scheduler.runnable_tasks',
  ACTIVE_WORKERS: 'sqlserver.scheduler.active_workers',
  CURRENT_TASKS: 'sqlserver.scheduler.current_tasks',

  MEMORY_GRANTS_PENDING: 'sqlserver.memory.grants_pending',
  MEMORY_GRANTS_OUTSTANDING: 'sqlserver.memory.grants_outstanding',
  MEMORY_TOTAL_BYTES: 'sqlserver.memory.total_bytes',
  MEMORY_TARGET_BYTES: 'sqlserver.memory.target_bytes',
  PLE_SECONDS: 'sqlserver.buffer.ple_seconds',
  LAZY_WRITES: 'sqlserver.lazy_writes_per_sec',
  PAGE_READS: 'sqlserver.page_reads_per_sec',
  PAGE_WRITES: 'sqlserver.page_writes_per_sec',

  WAIT_CPU: 'sqlserver.wait.cpu.ms_per_sec',
  WAIT_IO: 'sqlserver.wait.io.ms_per_sec',
  WAIT_LOCK: 'sqlserver.wait.lock.ms_per_sec',
  WAIT_LOG: 'sqlserver.wait.log.ms_per_sec',
  WAIT_MEMORY: 'sqlserver.wait.memory.ms_per_sec',
  WAIT_NETWORK: 'sqlserver.wait.network.ms_per_sec',
  WAIT_PARALLEL: 'sqlserver.wait.parallel.ms_per_sec',

  FILE_READS: 'sqlserver.io.reads_per_sec',
  FILE_WRITES: 'sqlserver.io.writes_per_sec',
  READ_LATENCY: 'sqlserver.io.read_latency_ms',
  WRITE_LATENCY: 'sqlserver.io.write_latency_ms',

  BLOCKED_SESSIONS: 'sqlserver.blocked_sessions',
  DEADLOCKS: 'sqlserver.deadlocks_per_sec',
  MAX_OPEN_TRANSACTIONS: 'sqlserver.transaction.max_open_count',
  TRANSACTION_OPEN_COUNT: 'sqlserver.transaction.open_count',
  TRANSACTION_MAX_SECONDS: 'sqlserver.transaction.max_seconds',
  SLEEPING_OPEN_COUNT: 'sqlserver.transaction.sleeping_open_count',
  SLEEPING_OPEN_MAX_SECONDS: 'sqlserver.transaction.sleeping_open_max_seconds',
  BLOCKING_MAX_WAIT_SECONDS: 'sqlserver.blocking.max_wait_seconds',
  BLOCKING_MAX_CHAIN_DEPTH: 'sqlserver.blocking.max_chain_depth',
  BLOCKING_ROOT_COUNT: 'sqlserver.blocking.root_blocker_count',

  TEMPDB_USER_BYTES: 'sqlserver.tempdb.user_bytes',
  TEMPDB_INTERNAL_BYTES: 'sqlserver.tempdb.internal_bytes',
  TEMPDB_VERSION_STORE_BYTES: 'sqlserver.tempdb.version_store_bytes',
  TEMPDB_FREE_BYTES: 'sqlserver.tempdb.free_bytes',
  TEMPDB_DATA_FILE_COUNT: 'sqlserver.tempdb.data_file_count',
  TEMPDB_PERCENT_GROWTH_COUNT: 'sqlserver.tempdb.percent_growth_file_count',
  TEMPDB_SIZE_SKEW_PERCENT: 'sqlserver.tempdb.data_file_size_skew_percent',
  TEMPDB_PAGELATCH_TASKS: 'sqlserver.tempdb.pagelatch_waiting_tasks',
  TEMPDB_PAGELATCH_MAX_WAIT_MS: 'sqlserver.tempdb.pagelatch_max_wait_ms',

  DATA_SIZE_BYTES: 'sqlserver.storage.data_size_bytes',
  DATA_USED_BYTES: 'sqlserver.storage.data_used_bytes',
  LOG_SIZE_BYTES: 'sqlserver.storage.log_size_bytes',
  LOG_USED_PERCENT: 'sqlserver.storage.log_used_percent',

  LOG_BYTES_FLUSHED_PER_SEC: 'sqlserver.log.bytes_flushed_per_sec',
  LOG_FLUSHES_PER_SEC: 'sqlserver.log.flushes_per_sec',
  LOG_FLUSH_LATENCY_MS: 'sqlserver.log.flush_latency_ms',
  LOG_VLF_MAX_COUNT: 'sqlserver.log.vlf_max_count',

  FILE_PERCENT_GROWTH_COUNT: 'sqlserver.file.percent_growth_count',
  VOLUME_MIN_FREE_PERCENT: 'sqlserver.volume.min_free_percent',

  QUERY_STORE_CHANGED_COUNT: 'sqlserver.query_store.plan_changed_query_count',
  QUERY_STORE_MAX_REGRESSION: 'sqlserver.query_store.max_regression_ratio',

  AGENT_FAILURE_JOBS: 'sqlserver.agent.consecutive_failure_jobs',
  AGENT_MAX_RUNNING_SECONDS: 'sqlserver.agent.max_running_seconds',
  REPLICATION_MAX_LATENCY_MS: 'sqlserver.replication.max_delivery_latency_ms',
  CDC_MAX_LATENCY_SECONDS: 'sqlserver.cdc.max_scan_latency_seconds'
} as const
