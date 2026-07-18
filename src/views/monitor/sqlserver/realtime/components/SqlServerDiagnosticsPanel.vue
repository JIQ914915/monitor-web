<template>
  <el-card shadow="never">
    <template #header>
      <div class="panel-head">
        <div>
          <div class="section-title">SQL Server 深度诊断</div>
          <div class="section-sub">展示平台最近两小时已采集的对象明细，不会连接目标库执行处置操作。</div>
        </div>
        <el-button :loading="loading" @click="load">刷新明细</el-button>
      </div>
    </template>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="事务与阻塞" name="transaction">
        <DiagnosticTable :rows="transactionRows" :columns="transactionColumns" empty-text="当前未采集到长事务或阻塞对象" />
      </el-tab-pane>
      <el-tab-pane label="文件与日志" name="storage">
        <DiagnosticTable :rows="storageRows" :columns="storageColumns" empty-text="当前未采集到文件、磁盘卷或 VLF 明细" />
      </el-tab-pane>
      <el-tab-pane label="tempdb" name="tempdb">
        <DiagnosticTable :rows="tempdbRows" :columns="tempdbColumns" empty-text="当前未采集到 tempdb 文件明细" />
      </el-tab-pane>
      <el-tab-pane label="Query Store" name="query-store">
        <DiagnosticTable :rows="queryStoreRows" :columns="queryStoreColumns" empty-text="当前未采集到 Query Store 计划明细" status-dict="sqlserver_plan_change_status" />
      </el-tab-pane>
      <el-tab-pane label="作业与复制" name="operations">
        <DiagnosticTable :rows="operationRows" :columns="operationColumns" empty-text="当前未采集到 Agent、复制或 CDC 明细" status-dict="sqlserver_agent_job_status" />
      </el-tab-pane>
    </el-tabs>
  </el-card>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref, watch, type PropType } from 'vue'
import { ElEmpty } from 'element-plus'
import { getSqlServerDiagnostics, type SqlServerDiagnosticItem } from '@/api/sqlserver'
import DictTag from '@/components/DictTag.vue'
import ProTable from '@/components/ProTable/index.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { fmtDurationShort, fmtMdHm, trimNum } from '@/utils/format'

const props = defineProps<{ instanceId: number }>()

interface DiagnosticRow {
  object: string
  category: string
  primary: string
  secondary: string
  tertiary: string
  status?: string
  statusType?: 'boolean' | 'agent'
  enabled?: string
  collectTime: string
}

const DiagnosticTable = defineComponent({
  props: {
    rows: { type: Array as PropType<DiagnosticRow[]>, required: true },
    columns: { type: Array as PropType<TableColumn[]>, required: true },
    emptyText: { type: String, required: true },
    statusDict: String
  },
  setup(tableProps) {
    return () => tableProps.rows.length
      ? h(ProTable, {
          data: tableProps.rows,
          columns: tableProps.columns,
          showToolbar: false,
          showOperation: false,
          showPagination: false,
          embedded: true,
          class: 'inner-table'
        }, tableProps.statusDict ? {
          'col-status': ({ row }: { row: DiagnosticRow }) => h(DictTag, {
            dict: row.statusType === 'boolean' ? 'common_boolean' : tableProps.statusDict!,
            value: row.status
          }),
          'col-enabled': ({ row }: { row: DiagnosticRow }) => h(DictTag, {
            dict: 'common_boolean', value: row.enabled
          })
        } : undefined)
      : h(ElEmpty, { description: tableProps.emptyText, imageSize: 64 })
  }
})

const activeTab = ref('transaction')
const loading = ref(false)
const metrics = ref<Record<string, SqlServerDiagnosticItem[]>>({})

const C = {
  TRANSACTION_SECONDS: 'sqlserver.transaction.open_seconds',
  TRANSACTION_SLEEPING: 'sqlserver.transaction.sleeping_open',
  BLOCKING_SECONDS: 'sqlserver.blocking.wait_seconds',
  BLOCKING_DEPTH: 'sqlserver.blocking.chain_depth',
  ROOT_AFFECTED: 'sqlserver.blocking.root_affected_sessions',
  FILE_SIZE: 'sqlserver.file.size_bytes',
  FILE_USED: 'sqlserver.file.used_bytes',
  FILE_MAX: 'sqlserver.file.max_size_bytes',
  FILE_GROWTH_BYTES: 'sqlserver.file.growth_bytes',
  FILE_GROWTH_PERCENT: 'sqlserver.file.growth_percent',
  VOLUME_TOTAL: 'sqlserver.volume.total_bytes',
  VOLUME_AVAILABLE: 'sqlserver.volume.available_bytes',
  VOLUME_FREE: 'sqlserver.volume.free_percent',
  VLF_COUNT: 'sqlserver.log.vlf_count',
  VLF_ACTIVE: 'sqlserver.log.active_vlf_count',
  TEMPDB_SIZE: 'sqlserver.tempdb.file_size_bytes',
  TEMPDB_GROWTH_BYTES: 'sqlserver.tempdb.file_growth_bytes',
  TEMPDB_GROWTH_PERCENT: 'sqlserver.tempdb.file_growth_percent',
  TEMPDB_VOLUME_AVAILABLE: 'sqlserver.tempdb.volume_available_bytes',
  PLAN_CHANGED: 'sqlserver.query_store.plan_changed',
  PLAN_COUNT: 'sqlserver.query_store.current_plan_count',
  PLAN_REGRESSION: 'sqlserver.query_store.regression_ratio',
  JOB_ENABLED: 'sqlserver.agent.job_enabled',
  JOB_STATUS: 'sqlserver.agent.job_status_code',
  JOB_DURATION: 'sqlserver.agent.job_duration_seconds',
  JOB_FAILURES: 'sqlserver.agent.job_consecutive_failures',
  JOB_RUNNING: 'sqlserver.agent.job_running_seconds',
  REPLICATION_LATENCY: 'sqlserver.replication.delivery_latency_ms',
  CDC_LATENCY: 'sqlserver.cdc.scan_latency_seconds'
} as const

const transactionColumns: TableColumn[] = [
  { prop: 'category', label: '类型', width: 100 },
  { prop: 'object', label: '会话', minWidth: 130 },
  { prop: 'primary', label: '持续/等待时长', minWidth: 140 },
  { prop: 'secondary', label: '状态/链深', minWidth: 130 },
  { prop: 'tertiary', label: '影响会话', minWidth: 110 },
  { prop: 'collectTime', label: '采集时间', width: 130 }
]
const storageColumns: TableColumn[] = [
  { prop: 'category', label: '类型', width: 100 },
  { prop: 'object', label: '对象', minWidth: 180 },
  { prop: 'primary', label: '容量/数量', minWidth: 140 },
  { prop: 'secondary', label: '已用/可用/活动', minWidth: 150 },
  { prop: 'tertiary', label: '上限/增长/剩余率', minWidth: 170 },
  { prop: 'collectTime', label: '采集时间', width: 130 }
]
const tempdbColumns: TableColumn[] = [
  { prop: 'object', label: '文件', minWidth: 180 },
  { prop: 'primary', label: '当前容量', minWidth: 130 },
  { prop: 'secondary', label: '自动增长', minWidth: 140 },
  { prop: 'tertiary', label: '所在卷可用', minWidth: 140 },
  { prop: 'collectTime', label: '采集时间', width: 130 }
]
const queryStoreColumns: TableColumn[] = [
  { prop: 'object', label: '查询', minWidth: 240 },
  { prop: 'status', label: '计划变化', width: 110, slot: 'col-status' },
  { prop: 'primary', label: '当前计划数', minWidth: 120 },
  { prop: 'secondary', label: '性能回退倍数', minWidth: 140 },
  { prop: 'collectTime', label: '采集时间', width: 130 }
]
const operationColumns: TableColumn[] = [
  { prop: 'category', label: '类型', width: 100 },
  { prop: 'object', label: '对象', minWidth: 200 },
  { prop: 'status', label: '状态', width: 110, slot: 'col-status' },
  { prop: 'enabled', label: '启用', width: 80, slot: 'col-enabled' },
  { prop: 'primary', label: '最近耗时/延迟', minWidth: 150 },
  { prop: 'secondary', label: '连续失败/运行时长', minWidth: 160 },
  { prop: 'collectTime', label: '采集时间', width: 130 }
]

const list = (code: string) => metrics.value[code] ?? []
const byObject = (code: string) => new Map(list(code).map(item => [item.objectName, item]))
const numberOf = (map: Map<string, SqlServerDiagnosticItem>, object: string) => map.get(object)?.value
const textNumber = (value?: number) => value == null ? '-' : trimNum(value)
const duration = (value?: number) => value == null ? '-' : fmtDurationShort(Math.round(value))
const bytes = (value?: number) => {
  if (value == null) return '-'
  if (value >= 1024 ** 4) return `${trimNum(value / 1024 ** 4)} TB`
  if (value >= 1024 ** 3) return `${trimNum(value / 1024 ** 3)} GB`
  if (value >= 1024 ** 2) return `${trimNum(value / 1024 ** 2)} MB`
  return `${trimNum(value / 1024)} KB`
}

const transactionRows = computed<DiagnosticRow[]>(() => {
  const sleeping = byObject(C.TRANSACTION_SLEEPING)
  const depth = byObject(C.BLOCKING_DEPTH)
  return [
    ...list(C.TRANSACTION_SECONDS).map(item => ({
      category: '事务', object: item.objectName, primary: duration(item.value),
      secondary: numberOf(sleeping, item.objectName) === 1 ? '休眠中且事务未结束' : '执行中', tertiary: '-',
      collectTime: fmtMdHm(item.collectTimeMs)
    })),
    ...list(C.BLOCKING_SECONDS).map(item => ({
      category: '阻塞', object: item.objectName, primary: duration(item.value),
      secondary: `${textNumber(numberOf(depth, item.objectName))} 层`, tertiary: '-',
      collectTime: fmtMdHm(item.collectTimeMs)
    })),
    ...list(C.ROOT_AFFECTED).map(item => ({
      category: '根阻塞者', object: item.objectName, primary: '-', secondary: '-', tertiary: `${textNumber(item.value)} 个`,
      collectTime: fmtMdHm(item.collectTimeMs)
    }))
  ]
})

const storageRows = computed<DiagnosticRow[]>(() => {
  const fileUsed = byObject(C.FILE_USED)
  const fileMax = byObject(C.FILE_MAX)
  const growthBytes = byObject(C.FILE_GROWTH_BYTES)
  const growthPercent = byObject(C.FILE_GROWTH_PERCENT)
  const volumeAvailable = byObject(C.VOLUME_AVAILABLE)
  const volumeFree = byObject(C.VOLUME_FREE)
  const vlfActive = byObject(C.VLF_ACTIVE)
  return [
    ...list(C.FILE_SIZE).map(item => {
      const growthB = numberOf(growthBytes, item.objectName)
      const growthP = numberOf(growthPercent, item.objectName)
      const growth = growthP == null ? bytes(growthB) : `${trimNum(growthP)}%`
      return { category: '数据库文件', object: item.objectName, primary: bytes(item.value), secondary: bytes(numberOf(fileUsed, item.objectName)), tertiary: `上限 ${bytes(numberOf(fileMax, item.objectName))} / 增长 ${growth}`, collectTime: fmtMdHm(item.collectTimeMs) }
    }),
    ...list(C.VOLUME_TOTAL).map(item => ({
      category: '磁盘卷', object: item.objectName, primary: bytes(item.value), secondary: bytes(numberOf(volumeAvailable, item.objectName)), tertiary: `${textNumber(numberOf(volumeFree, item.objectName))}%`, collectTime: fmtMdHm(item.collectTimeMs)
    })),
    ...list(C.VLF_COUNT).map(item => ({
      category: '事务日志', object: item.objectName, primary: `${textNumber(item.value)} 个 VLF`, secondary: `${textNumber(numberOf(vlfActive, item.objectName))} 个活动`, tertiary: '-', collectTime: fmtMdHm(item.collectTimeMs)
    }))
  ]
})

const tempdbRows = computed<DiagnosticRow[]>(() => {
  const growthBytes = byObject(C.TEMPDB_GROWTH_BYTES)
  const growthPercent = byObject(C.TEMPDB_GROWTH_PERCENT)
  const volumeAvailable = byObject(C.TEMPDB_VOLUME_AVAILABLE)
  return list(C.TEMPDB_SIZE).map(item => {
    const growthP = numberOf(growthPercent, item.objectName)
    return {
      category: 'tempdb', object: item.objectName, primary: bytes(item.value),
      secondary: growthP == null ? bytes(numberOf(growthBytes, item.objectName)) : `${trimNum(growthP)}%`,
      tertiary: bytes(numberOf(volumeAvailable, item.objectName)), collectTime: fmtMdHm(item.collectTimeMs)
    }
  })
})

const queryStoreRows = computed<DiagnosticRow[]>(() => {
  const planCount = byObject(C.PLAN_COUNT)
  const regression = byObject(C.PLAN_REGRESSION)
  return list(C.PLAN_CHANGED).map(item => ({
    category: 'Query Store', object: item.objectName, status: String(Math.round(item.value)),
    primary: textNumber(numberOf(planCount, item.objectName)),
    secondary: numberOf(regression, item.objectName) == null ? '-' : `${trimNum(numberOf(regression, item.objectName)!)}x`,
    tertiary: '-', collectTime: fmtMdHm(item.collectTimeMs)
  }))
})

const operationRows = computed<DiagnosticRow[]>(() => {
  const enabled = byObject(C.JOB_ENABLED)
  const durationMap = byObject(C.JOB_DURATION)
  const failures = byObject(C.JOB_FAILURES)
  const running = byObject(C.JOB_RUNNING)
  return [
    ...list(C.JOB_STATUS).map(item => ({
      category: 'Agent 作业', object: item.objectName, status: String(Math.round(item.value)), statusType: 'agent' as const,
      enabled: String(numberOf(enabled, item.objectName) === 1),
      primary: duration(numberOf(durationMap, item.objectName)),
      secondary: `${textNumber(numberOf(failures, item.objectName))} 次 / ${duration(numberOf(running, item.objectName))}`,
      tertiary: '-', collectTime: fmtMdHm(item.collectTimeMs)
    })),
    ...list(C.REPLICATION_LATENCY).map(item => ({
      category: '复制', object: item.objectName, status: undefined, primary: `${textNumber(item.value)} ms`, secondary: '-', tertiary: '-', collectTime: fmtMdHm(item.collectTimeMs)
    })),
    ...list(C.CDC_LATENCY).map(item => ({
      category: 'CDC', object: item.objectName, status: undefined, primary: duration(item.value), secondary: '-', tertiary: '-', collectTime: fmtMdHm(item.collectTimeMs)
    }))
  ]
})

async function load() {
  loading.value = true
  try {
    const result = await getSqlServerDiagnostics(props.instanceId)
    metrics.value = result.metrics ?? {}
  } finally {
    loading.value = false
  }
}

watch(() => props.instanceId, () => {
  metrics.value = {}
  load()
})
onMounted(load)
</script>

<style scoped>
.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.section-title { font-weight: 600; }
.section-sub { margin-top: 4px; color: var(--el-text-color-secondary); font-size: 13px; }
.inner-table { margin: -4px 0; }
</style>
