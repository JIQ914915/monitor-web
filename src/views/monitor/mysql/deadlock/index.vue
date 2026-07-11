<template>
  <div class="deadlock-page">
    <InstanceEmpty v-if="!inst" />
    <template v-else>
      <!-- 死锁次数趋势 -->
      <el-card shadow="never" v-loading="loading">
        <template #header>
          <div class="card-head">
            <span class="card-title">死锁分析</span>
            <span class="card-sub">{{ inst.name }} · 最近 1 小时</span>
          </div>
        </template>
        <div class="chart-grid">
          <TrendChart title="死锁次数" :data="charts.deadlocks" color="#B91C1C" />
          <TrendChart title="锁等待超时次数" :data="charts.lockTimeouts" color="#E08600" />
        </div>
      </el-card>

      <!-- 最近一次死锁现场 -->
      <el-card shadow="never" v-loading="loading">
        <template #header>
          <div class="card-head">
            <span class="card-title">最近一次死锁现场</span>
            <span class="card-sub">SHOW ENGINE INNODB STATUS · LATEST DETECTED DEADLOCK</span>
          </div>
        </template>
        <template v-if="deadlockText">
          <el-alert
            type="warning"
            :closable="false"
            show-icon
            class="deadlock-alert"
            title="以下为实例启动以来最近一次检测到的死锁全文，非本次告警实时现场"
            description="重点关注两条事务各自持有/等待的锁与 SQL 语句：通常由不同顺序访问相同资源导致，可通过统一业务加锁顺序、缩短事务、为热点查询补充索引来规避。"
          />
          <pre class="deadlock-text">{{ deadlockText }}</pre>
        </template>
        <el-empty v-else-if="!loading" description="未采集到死锁记录（实例启动以来无死锁，或采集能力未开启）" :image-size="56" />
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useInstanceStore } from '@/stores/instance'
import InstanceEmpty from '@/components/InstanceEmpty.vue'
import TrendChart from '@/components/TrendChart.vue'
import { getMetricTrend, getMetricTextLatest } from '@/api/metric'
import { M } from '@/constants/metrics'
import { useAutoRefresh } from '@/composables/useAutoRefresh'
import type { TrendPoint } from '@/types/monitor'

const instanceStore = useInstanceStore()
const inst = computed(() => instanceStore.current)

const loading = ref(false)
const charts = reactive<Record<string, TrendPoint[]>>({ deadlocks: [], lockTimeouts: [] })
const deadlockText = ref('')

async function loadAll(silent = false) {
  if (!inst.value) return
  if (!silent) loading.value = true
  try {
    await Promise.allSettled([
      getMetricTrend(inst.value.id, M.DEADLOCK_COUNT).then(r => { charts.deadlocks = r.points ?? [] }),
      getMetricTrend(inst.value.id, M.LOCK_TIMEOUT_COUNT).then(r => { charts.lockTimeouts = r.points ?? [] }),
      getMetricTextLatest(inst.value.id, [M.LATEST_DEADLOCK]).then(r => {
        deadlockText.value = r.values?.[M.LATEST_DEADLOCK] ?? ''
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
.deadlock-page { display: flex; flex-direction: column; gap: 16px; min-height: 400px; }
.card-head { display: flex; align-items: baseline; gap: 12px; }
.card-title { font-size: 15px; font-weight: 600; }
.card-sub { font-size: 12px; color: var(--el-text-color-secondary); }
.chart-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
@media (max-width: 1200px) { .chart-grid { grid-template-columns: 1fr; } }
.deadlock-alert { margin-bottom: 12px; }
.deadlock-text {
  margin: 0;
  padding: 12px 16px;
  max-height: 480px;
  overflow: auto;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
