<template>
  <el-alert
    v-if="instanceId && shouldShow"
    :type="alertType"
    :title="title"
    :closable="false"
    show-icon
    class="quality-alert"
  >
    <template v-if="problemItems.length">
      <div v-for="item in problemItems.slice(0, 5)" :key="`${item.frequency}:${item.itemCode}`" class="quality-item">
        <span>{{ itemName(item.itemCode) }}</span>
        <DictTag dict="pg_collect_item_status" :value="item.status" />
        <span class="quality-reason">{{ getDictLabel('pg_collect_failure_reason', item.reason) }}</span>
        <span v-if="item.consecutiveFailures > 1" class="quality-count">连续 {{ item.consecutiveFailures }} 次</span>
      </div>
      <div v-if="problemItems.length > 5" class="quality-more">另有 {{ problemItems.length - 5 }} 个采集项异常</div>
    </template>
    <span v-else-if="latestCollectedAt" class="quality-time">最近检查：{{ formatTime(latestCollectedAt) }}</span>
  </el-alert>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import DictTag from '@/components/DictTag.vue'
import { useDict } from '@/composables/useDict'
import { useAutoRefresh } from '@/composables/useAutoRefresh'
import { listPgCollectionQuality } from '@/api/postgresql'
import type { PgCollectionQualityScope, PgCollectItemStatus } from '@/api/postgresql'

export interface PgCollectionQualitySummary {
  loaded: boolean
  hasData: boolean
  status?: string
  reason?: string
}

const props = withDefaults(defineProps<{
  instanceId?: number
  scope: PgCollectionQualityScope
  itemCodes?: string[]
}>(), { itemCodes: () => [] })

const emit = defineEmits<{ qualityChange: [summary: PgCollectionQualitySummary] }>()
const { getDictItems, getDictLabel, getDictTagType } = useDict('pg_collect_item_status', 'pg_collect_failure_reason')
const rows = ref<PgCollectItemStatus[]>([])
const loaded = ref(false)
const requestFailed = ref(false)

const ITEM_NAMES: Record<string, string> = {
  availability: '实例可达性', connections: '连接状态', database_stat: '数据库统计',
  locks: '锁等待', transactions: '事务状态', replication: '流复制', capacity: '容量',
  settings: '关键配置', pg_checkpoint: '检查点与后台写入', pg_bloat: '膨胀与清理',
  pg_extensions: '扩展能力', pg_operations: '复制、归档与任务快照',
  pg_repl_detail: '物理复制明细', pg_repl_slots: '复制槽', pg_security: '安全巡检',
  pg_stat_io: '实例 I/O', pg_slow_sql_sample: '慢 SQL 样本', pg_table_stat: '表级统计',
  pg_top_sql: 'Query Analytics', pg_vacuum: 'VACUUM 活动', pg_wait_events: '等待事件',
  pg_wal: 'WAL 与归档', pg_xid: '事务 ID 风险'
}

const filteredItems = computed(() => {
  if (!props.itemCodes.length) return rows.value
  const codes = new Set(props.itemCodes)
  return rows.value.filter(item => codes.has(item.itemCode))
})
const problemItems = computed(() => filteredItems.value.filter(item => item.status !== 'success'))
const shouldShow = computed(() => !loaded.value || requestFailed.value || !filteredItems.value.length || problemItems.value.length > 0)
const latestCollectedAt = computed(() => filteredItems.value.map(item => item.collectedAt).filter(Boolean).sort().at(-1))
const worstItem = computed(() => {
  const order = new Map(getDictItems('pg_collect_item_status').map((item, index) => [item.itemValue, item.sort ?? index]))
  return [...problemItems.value].sort((a, b) => (order.get(b.status) ?? 0) - (order.get(a.status) ?? 0))[0]
})
const alertType = computed<'success' | 'warning' | 'info' | 'error'>(() => {
  if (requestFailed.value || !loaded.value || !filteredItems.value.length) return 'info'
  const tag = getDictTagType('pg_collect_item_status', worstItem.value?.status || 'success')
  if (tag === 'danger') return 'error'
  if (tag === 'warning') return 'warning'
  if (tag === 'success') return 'success'
  return 'info'
})
const title = computed(() => {
  if (requestFailed.value) return '采集质量暂时无法读取，页面数据可能不完整'
  if (!loaded.value) return '正在检查监控数据采集状态'
  if (!filteredItems.value.length) return '正在等待首轮采集，暂时无法判断数据完整性'
  if (!problemItems.value.length) return '监控数据采集正常'
  return `部分监控数据不可用（${problemItems.value.length} 项），请按提示检查权限、版本或连接`
})

function itemName(code: string) { return ITEM_NAMES[code] || code }
function formatTime(value: string) { return new Date(value).toLocaleString() }
async function load() {
  if (!props.instanceId) return
  requestFailed.value = false
  try { rows.value = await listPgCollectionQuality(props.scope, props.instanceId) }
  catch { rows.value = []; requestFailed.value = true }
  finally { loaded.value = true }
}

watch(() => [props.instanceId, props.scope, props.itemCodes.join(',')], () => {
  loaded.value = false
  rows.value = []
  load()
}, { immediate: true })
watch([loaded, requestFailed, worstItem], () => emit('qualityChange', {
  loaded: loaded.value && !requestFailed.value,
  hasData: filteredItems.value.length > 0,
  status: worstItem.value?.status,
  reason: worstItem.value?.reason
}), { immediate: true })
useAutoRefresh(load)
</script>

<style scoped>
.quality-alert{margin-bottom:12px}.quality-item{display:flex;align-items:center;gap:8px;min-height:26px}.quality-reason,.quality-time,.quality-more{font-size:12px;color:var(--el-text-color-secondary)}.quality-count{font-size:12px;color:var(--el-color-warning)}
</style>
