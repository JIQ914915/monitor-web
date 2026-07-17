/** SQL Server 分钟级性能指标编码，与 monitor-collector-sqlserver 保持一致。 */
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

  TEMPDB_USER_BYTES: 'sqlserver.tempdb.user_bytes',
  TEMPDB_INTERNAL_BYTES: 'sqlserver.tempdb.internal_bytes',
  TEMPDB_VERSION_STORE_BYTES: 'sqlserver.tempdb.version_store_bytes',
  TEMPDB_FREE_BYTES: 'sqlserver.tempdb.free_bytes',

  DATA_SIZE_BYTES: 'sqlserver.storage.data_size_bytes',
  DATA_USED_BYTES: 'sqlserver.storage.data_used_bytes',
  LOG_SIZE_BYTES: 'sqlserver.storage.log_size_bytes',
  LOG_USED_PERCENT: 'sqlserver.storage.log_used_percent'
} as const
