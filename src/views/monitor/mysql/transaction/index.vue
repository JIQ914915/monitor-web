<template>
  <div class="trx-page">
    <InstanceEmpty v-if="!inst" />
    <template v-else>
      <!-- 事务趋势 -->
      <el-card shadow="never" v-loading="loading">
        <template #header>
          <div class="card-head">
            <span class="card-title">长事务分析</span>
            <span class="card-sub">{{ inst.name }} · 最近 1 小时</span>
          </div>
        </template>
        <div class="chart-grid">
          <TrendChart title="活跃事务数" :data="charts.activeTrx" color="#0C7C97" />
          <TrendChart title="最长事务时长" :data="charts.maxTrxSeconds" unit="s" color="#E74C3C" />
          <TrendChart title="Undo 历史链长度" :data="charts.historyList" color="#9B59B6" />
        </div>
        <div class="hint">
          长事务危害：Undo 历史链持续增长（拖慢查询、膨胀 ibdata）、锁持有时间变长（放大锁等待与死锁概率）、
          从库回放延迟。历史链长度持续上升且不回落时，优先排查最长事务对应的会话。
        </div>
      </el-card>

      <!-- 长连接明细 -->
      <el-card shadow="never" v-loading="loading">
        <template #header>
          <div class="card-head">
            <span class="card-title">长连接 Top 10</span>
            <span class="card-sub">执行时间最长的连接（含空闲），长事务通常藏在其中</span>
          </div>
        </template>
        <el-empty v-if="!longConns.length && !loading" description="暂无长连接数据" :image-size="56" />
        <ProTable
          v-else
          embedded
          :data="longConns"
          :columns="connColumns"
          :show-toolbar="false"
          :show-operation="false"
          :show-pagination="false"
        >
          <template #col-time="{ row }">
            <span :style="{ color: row.timeSeconds >= 3600 ? '#E5484D' : row.timeSeconds >= 600 ? '#E08600' : undefined }">
              {{ fmtSeconds(row.timeSeconds) }}
            </span>
          </template>
          <template #col-info="{ row }">
            <el-tooltip v-if="row.info" :content="row.info" placement="top" :show-after="300">
              <span class="sql-text">{{ row.info }}</span>
            </el-tooltip>
            <span v-else class="idle">空闲</span>
          </template>
        </ProTable>
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useInstanceStore } from '@/stores/instance'
import InstanceEmpty from '@/components/InstanceEmpty.vue'
import TrendChart from '@/components/TrendChart.vue'
import ProTable from '@/components/ProTable/index.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { getMetricTrend, getLongConnections } from '@/api/metric'
import { M } from '@/constants/metrics'
import { useAutoRefresh } from '@/composables/useAutoRefresh'
import type { TrendPoint, LongConnRow } from '@/types/monitor'

const instanceStore = useInstanceStore()
const inst = computed(() => instanceStore.current)

const loading = ref(false)
const charts = reactive<Record<string, TrendPoint[]>>({
  activeTrx: [], maxTrxSeconds: [], historyList: []
})
const longConns = ref<LongConnRow[]>([])

const connColumns: TableColumn[] = [
  { prop: 'connId', label: '连接 ID', width: 100, align: 'right' },
  { prop: 'connUser', label: '用户', minWidth: 100, showOverflowTooltip: true },
  { prop: 'connHost', label: '来源', minWidth: 140, showOverflowTooltip: true },
  { prop: 'connDb', label: '数据库', minWidth: 100, showOverflowTooltip: true },
  { prop: 'command', label: '命令', width: 90 },
  { prop: 'timeSeconds', label: '已持续', width: 110, align: 'right', slot: 'col-time' },
  { prop: 'state', label: '状态', minWidth: 120, showOverflowTooltip: true },
  { prop: 'info', label: '当前 SQL', minWidth: 220, slot: 'col-info' }
]

function fmtSeconds(s: number): string {
  if (s >= 3600) return (s / 3600).toFixed(1) + ' 小时'
  if (s >= 60) return (s / 60).toFixed(1) + ' 分钟'
  return s + ' 秒'
}

const METRIC_MAP: Record<string, string> = {
  activeTrx: M.TRX_ACTIVE,
  maxTrxSeconds: M.TRX_MAX_SECONDS,
  historyList: M.HISTORY_LIST_LENGTH
}

async function loadAll(silent = false) {
  if (!inst.value) return
  if (!silent) loading.value = true
  try {
    await Promise.allSettled([
      ...Object.entries(METRIC_MAP).map(async ([key, code]) => {
        const res = await getMetricTrend(inst.value!.id, code)
        charts[key] = res.points ?? []
      }),
      getLongConnections(inst.value.id).then(r => { longConns.value = r.connections ?? [] })
    ])
  } finally {
    loading.value = false
  }
}

useAutoRefresh(() => loadAll(true))
watch(() => inst.value?.id, () => loadAll(), { immediate: true })
</script>

<style scoped>
.trx-page { display: flex; flex-direction: column; gap: 16px; min-height: 400px; }
.card-head { display: flex; align-items: baseline; gap: 12px; }
.card-title { font-size: 15px; font-weight: 600; }
.card-sub { font-size: 12px; color: var(--el-text-color-secondary); }
.chart-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
@media (max-width: 1200px) { .chart-grid { grid-template-columns: 1fr; } }
.hint {
  margin-top: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 8px 12px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  line-height: 1.6;
}
.sql-text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 12px;
}
.idle { color: var(--el-text-color-placeholder); }
</style>
