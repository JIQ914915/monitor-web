<template>
  <div class="lock-page">
    <InstanceEmpty v-if="!inst" />
    <template v-else>
      <!-- 锁等待趋势 -->
      <el-card shadow="never" v-loading="loading">
        <template #header>
          <div class="card-head">
            <span class="card-title">锁等待分析</span>
            <span class="card-sub">{{ inst.name }} · 当前阻塞诊断与最近 1 小时趋势</span>
          </div>
        </template>
        <MySqlDiagnosticPanel :instance-id="inst.id" kind="mdl" embedded />
        <div class="section-heading">最近 1 小时趋势</div>
        <div class="chart-grid">
          <TrendChart title="锁等待数" :data="charts.lockWaits" color="#E5484D" />
          <TrendChart title="阻塞会话数" :data="charts.blockedSessions" color="#9B59B6" />
          <TrendChart title="锁等待超时次数" :data="charts.lockTimeouts" color="#E08600" />
          <TrendChart title="等待事件-锁大类耗时" :data="charts.waitsLock" unit="ms" color="#B91C1C" />
        </div>
        <div class="hint">
          锁等待发生时，锁相关告警事件会自动抓取阻塞链现场（等待/阻塞双方会话与 SQL），
          可在「告警管理 → 事件下钻」的“阻塞链现场”卡片查看。
        </div>
      </el-card>

      <!-- 表级锁明细 -->
      <el-card shadow="never" v-loading="loading">
        <template #header>
          <div class="card-head">
            <span class="card-title">表级锁监控</span>
            <span class="card-sub">SHOW OPEN TABLES · 覆盖 MyISAM 表锁 / LOCK TABLES / DDL 名字锁</span>
          </div>
        </template>
        <div class="stat-line">
          <span>当前被占用表：<strong :style="{ color: (tableInUse ?? 0) > 0 ? '#E08600' : undefined }">{{ tableInUse ?? '-' }}</strong></span>
          <span>表锁等待速率：<strong>{{ tableLocksWaited == null ? '-' : tableLocksWaited.toFixed(2) + ' 次/s' }}</strong></span>
        </div>
        <el-empty v-if="!openTables.length && !loading" description="当前无被占用/锁定的表" :image-size="56" />
        <ProTable
          v-else
          embedded
          :data="openTables"
          :columns="openTableColumns"
          :show-toolbar="false"
          :show-operation="false"
          :show-pagination="false"
        >
          <template #col-name-locked="{ row }">
            <el-tag v-if="row.nameLocked > 0" type="danger" size="small">是</el-tag>
            <span v-else>-</span>
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
import MySqlDiagnosticPanel from '../components/MySqlDiagnosticPanel.vue'
import ProTable from '@/components/ProTable/index.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { getMetricTrend, getMetricLatest, getMetricTextLatest } from '@/api/metric'
import { M } from '@/constants/metrics'
import { useAutoRefresh } from '@/composables/useAutoRefresh'
import type { TrendPoint } from '@/types/monitor'

const instanceStore = useInstanceStore()
const inst = computed(() => instanceStore.current)

const loading = ref(false)
const charts = reactive<Record<string, TrendPoint[]>>({
  lockWaits: [], blockedSessions: [], lockTimeouts: [], waitsLock: []
})
const tableInUse = ref<number | null>(null)
const tableLocksWaited = ref<number | null>(null)
const openTables = ref<{ db: string; table: string; inUse: number; nameLocked: number }[]>([])

const openTableColumns: TableColumn[] = [
  { prop: 'db', label: '数据库', minWidth: 140, showOverflowTooltip: true },
  { prop: 'table', label: '表名', minWidth: 180, showOverflowTooltip: true },
  { prop: 'inUse', label: '占用会话数', width: 120, align: 'right' },
  { prop: 'nameLocked', label: '名字锁定', width: 100, align: 'center', slot: 'col-name-locked' }
]

const METRIC_MAP: Record<string, string> = {
  lockWaits: M.LOCK_WAITS,
  blockedSessions: M.BLOCKED_SESSIONS,
  lockTimeouts: M.LOCK_TIMEOUT_COUNT,
  waitsLock: M.WAITS_LOCK_MS
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
      getMetricLatest(inst.value.id, [M.TABLE_IN_USE_COUNT, M.RATE_TABLE_LOCKS_WAITED]).then(r => {
        tableInUse.value = r.values?.[M.TABLE_IN_USE_COUNT] ?? null
        tableLocksWaited.value = r.values?.[M.RATE_TABLE_LOCKS_WAITED] ?? null
      }),
      getMetricTextLatest(inst.value.id, [M.OPEN_TABLES_DETAIL]).then(r => {
        const raw = r.values?.[M.OPEN_TABLES_DETAIL]
        openTables.value = raw ? JSON.parse(raw) : []
      })
    ])
  } finally {
    loading.value = false
  }
}

useAutoRefresh(() => loadAll(true))
watch(() => inst.value?.id, () => loadAll(), { immediate: true })
</script>

<style scoped>
.lock-page { display: flex; flex-direction: column; gap: 16px; min-height: 400px; }
.card-head { display: flex; align-items: baseline; gap: 12px; }
.card-title { font-size: 15px; font-weight: 600; }
.card-sub { font-size: 12px; color: var(--el-text-color-secondary); }
.section-heading {
  margin: 4px 0 12px;
  padding-top: 14px;
  border-top: 1px solid var(--el-border-color-lighter);
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
}
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
.stat-line { display: flex; gap: 32px; margin-bottom: 12px; font-size: 13px; color: var(--el-text-color-secondary); }
.stat-line strong { font-size: 16px; color: var(--el-text-color-primary); }
</style>
