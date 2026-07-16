<template>
  <div class="repl-page">
    <InstanceEmpty v-if="!inst" />
    <template v-else>
      <el-card shadow="never" v-loading="loading">
        <template #header>
          <div class="card-head">
            <span class="card-title">复制监控</span>
            <span class="card-sub">{{ inst.name }} · 主从复制状态与延迟</span>
          </div>
        </template>
        <MySqlDiagnosticPanel :instance-id="inst.id" kind="replication" />
        <el-alert
          v-if="isReplica === false"
          type="info"
          :closable="false"
          show-icon
          title="当前实例是主库（或未配置复制）"
          description="复制延迟与 IO/SQL 线程状态仅在从库上产生。若该实例应为从库，请检查复制是否已配置并启动（SHOW SLAVE/REPLICA STATUS）。"
        />

        <template v-else>
          <!-- 状态摘要 -->
          <div class="status-line">
            <div class="status-item">
              <span class="label">复制角色</span>
              <el-tag :type="isReplica ? 'primary' : 'info'" size="small">{{ isReplica == null ? '未知' : '从库' }}</el-tag>
            </div>
            <div class="status-item">
              <span class="label">IO 线程</span>
              <el-tag :type="threadTag(ioRunning)" size="small">{{ threadText(ioRunning) }}</el-tag>
            </div>
            <div class="status-item">
              <span class="label">SQL 线程</span>
              <el-tag :type="threadTag(sqlRunning)" size="small">{{ threadText(sqlRunning) }}</el-tag>
            </div>
            <div class="status-item">
              <span class="label">当前延迟</span>
              <span class="value" :style="{ color: delayColor }">{{ delaySeconds == null ? '-' : delaySeconds + ' 秒' }}</span>
            </div>
          </div>

          <!-- 趋势 -->
          <div class="chart-grid">
            <TrendChart title="复制延迟" :data="charts.replDelay" unit="s" color="#E74C3C" />
            <TrendChart title="IO 线程状态（1=运行）" :data="charts.replIoRunning" color="#0C7C97" />
            <TrendChart title="SQL 线程状态（1=运行）" :data="charts.replSqlRunning" color="#15A36A" />
          </div>
          <div class="hint">
            复制中断（线程停止）与持续延迟已配套内置告警规则，触发后可在「告警管理 → 事件下钻」查看排查路径。
            常见延迟原因：从库单线程回放跟不上主库写入、从库硬件/负载不足、大事务或大批量 DML、网络带宽不足。
          </div>
        </template>
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
import { getMetricTrend, getMetricLatest } from '@/api/metric'
import { M } from '@/constants/metrics'
import { useAutoRefresh } from '@/composables/useAutoRefresh'
import type { TrendPoint } from '@/types/monitor'

const instanceStore = useInstanceStore()
const inst = computed(() => instanceStore.current)

const loading = ref(false)
/** true 从库 / false 主库 / null 未知（未采集到） */
const isReplica = ref<boolean | null>(null)
const ioRunning = ref<number | null>(null)
const sqlRunning = ref<number | null>(null)
const delaySeconds = ref<number | null>(null)
const charts = reactive<Record<string, TrendPoint[]>>({
  replDelay: [], replIoRunning: [], replSqlRunning: []
})

const delayColor = computed(() => {
  if (delaySeconds.value == null) return undefined
  if (delaySeconds.value >= 300) return '#E5484D'
  if (delaySeconds.value >= 60) return '#E08600'
  return '#15A36A'
})

function threadTag(v: number | null): 'success' | 'danger' | 'info' {
  if (v == null) return 'info'
  return v >= 1 ? 'success' : 'danger'
}
function threadText(v: number | null): string {
  if (v == null) return '未知'
  return v >= 1 ? '运行中' : '已停止'
}

async function loadAll(silent = false) {
  if (!inst.value) return
  if (!silent) loading.value = true
  try {
    await Promise.allSettled([
      getMetricLatest(inst.value.id, [
        M.REPL_IS_REPLICA, M.REPL_IO_RUNNING, M.REPL_SQL_RUNNING, M.REPL_SECONDS_BEHIND
      ]).then(r => {
        const v = r.values ?? {}
        const role = v[M.REPL_IS_REPLICA]
        isReplica.value = role == null ? null : role >= 1
        ioRunning.value = v[M.REPL_IO_RUNNING] ?? null
        sqlRunning.value = v[M.REPL_SQL_RUNNING] ?? null
        delaySeconds.value = v[M.REPL_SECONDS_BEHIND] ?? null
      }),
      getMetricTrend(inst.value.id, M.REPL_SECONDS_BEHIND).then(r => { charts.replDelay = r.points ?? [] }),
      getMetricTrend(inst.value.id, M.REPL_IO_RUNNING).then(r => { charts.replIoRunning = r.points ?? [] }),
      getMetricTrend(inst.value.id, M.REPL_SQL_RUNNING).then(r => { charts.replSqlRunning = r.points ?? [] })
    ])
  } finally {
    loading.value = false
  }
}

useAutoRefresh(() => loadAll(true))
watch(() => inst.value?.id, () => loadAll(), { immediate: true })
</script>

<style scoped>
.repl-page { display: flex; flex-direction: column; gap: 16px; min-height: 400px; }
.card-head { display: flex; align-items: baseline; gap: 12px; }
.card-title { font-size: 15px; font-weight: 600; }
.card-sub { font-size: 12px; color: var(--el-text-color-secondary); }
.status-line { display: flex; gap: 40px; flex-wrap: wrap; margin-bottom: 16px; }
.status-item { display: flex; align-items: center; gap: 8px; }
.status-item .label { font-size: 13px; color: var(--el-text-color-secondary); }
.status-item .value { font-size: 16px; font-weight: 600; }
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
</style>
