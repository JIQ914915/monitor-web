<template>
  <div class="collector-page">
    <!-- 统计卡片 -->
    <div class="stat-cards">
      <StatCard label="采集任务总数" :value="stats.total" :sub="`${stats.total1m}分钟 / ${stats.total1h}小时 / ${stats.total1d}天`" tone="primary" value-tone="none" />
      <StatCard label="正常运行" :value="stats.running" sub="采集中" tone="success" value-tone="none" />
      <StatCard label="已暂停" :value="stats.stopped" sub="暂停采集" tone="info" value-tone="none" />
      <StatCard label="最近失败" :value="stats.error" sub="需排查" tone="danger" value-tone="none" />
    </div>

    <!-- 任务列表 -->
    <ProTable
      :data="filteredList"
      :columns="columns"
      :loading="loading"
      :show-add="false"
      :show-pagination="false"
      :operation-width="80"
      @search="loadTasks"
      @reset="handleReset"
    >
      <template #search>
        <el-form-item label="实例名称">
          <el-input
            v-model="filterKeyword"
            placeholder="搜索实例名称 / 主机"
            clearable
            style="width: 220px"
          />
        </el-form-item>
        <el-form-item label="采集频率">
          <el-select v-model="filterFrequency" placeholder="采集频率" clearable style="width: 130px">
            <el-option label="分钟级（1m）" value="1m" />
            <el-option label="小时级（1h）" value="1h" />
            <el-option label="天级（1d）" value="1d" />
          </el-select>
        </el-form-item>
        <el-form-item label="任务状态">
          <el-select v-model="filterStatus" placeholder="任务状态" clearable style="width: 120px">
            <el-option label="正常运行" value="running" />
            <el-option label="已暂停" value="stopped" />
            <el-option label="最近失败" value="error" />
          </el-select>
        </el-form-item>
      </template>

      <template #col-instance="{ row }">
        <div class="cell-instance">
          <span class="instance-name">{{ row.instanceName }}</span>
          <span class="instance-host">{{ row.host }}:{{ row.port }}</span>
        </div>
      </template>

      <template #col-dbType="{ row }">
        <el-tag size="small" effect="plain">{{ row.dbType }}{{ row.dbVersion ? ' ' + row.dbVersion : '' }}</el-tag>
      </template>

      <template #col-frequency="{ row }">
        <el-tag size="small" :type="freqTagType(row.frequency)">{{ row.frequencyLabel }}</el-tag>
      </template>

      <template #col-status="{ row }">
        <el-tag size="small" :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
      </template>

      <template #col-lastCollect="{ row }">
        <span v-if="row.lastCollectTime" class="time-text">{{ formatTime(row.lastCollectTime) }}</span>
        <span v-else class="no-data">—</span>
      </template>

      <template #col-result="{ row }">
        <template v-if="row.lastCollectTime">
          <el-tooltip
            v-if="!row.lastSuccess && row.lastErrorMessage"
            :content="row.lastErrorMessage"
            placement="top"
            :show-after="300"
          >
            <el-icon color="var(--sev-crit, #E5484D)" :size="18"><CircleClose /></el-icon>
          </el-tooltip>
          <el-icon v-else-if="!row.lastSuccess" color="var(--sev-crit, #E5484D)" :size="18"><CircleClose /></el-icon>
          <el-icon v-else color="var(--sev-ok, #15A36A)" :size="18"><CircleCheck /></el-icon>
        </template>
        <span v-else class="no-data">—</span>
      </template>

      <template #col-duration="{ row }">
        <span v-if="row.lastDurationMs != null" class="duration">{{ formatDuration(row.lastDurationMs) }}</span>
        <span v-else class="no-data">—</span>
      </template>

      <template #col-metricCount="{ row }">
        <span v-if="row.lastMetricCount != null">{{ row.lastMetricCount }}</span>
        <span v-else class="no-data">—</span>
      </template>

      <template #col-successRate="{ row }">
        <div v-if="row.total24h > 0" class="success-rate-cell">
          <el-progress
            :percentage="row.successRate"
            :color="rateColor(row.successRate)"
            :stroke-width="5"
            :show-text="false"
            style="flex: 1; min-width: 0"
          />
          <span class="rate-text">{{ row.successRate }}%</span>
        </div>
        <span v-else class="no-data">—</span>
      </template>

      <template #operation="{ row }">
        <el-button link type="primary" size="small" @click="openLog(row as CollectTaskSummary)">日志</el-button>
      </template>
    </ProTable>

    <!-- 历史日志抽屉 -->
    <el-drawer
      v-model="logDrawerVisible"
      :title="logDrawerTitle"
      size="680px"
      :destroy-on-close="false"
    >
      <div class="log-toolbar">
        <el-select v-model="logLimit" style="width: 120px" @change="loadLogs">
          <el-option label="最近 50 条" :value="50" />
          <el-option label="最近 100 条" :value="100" />
          <el-option label="最近 200 条" :value="200" />
        </el-select>
        <div class="spacer" />
        <el-button :icon="Refresh" @click="loadLogs" :loading="logLoading">刷新</el-button>
      </div>

      <el-table
        :data="logList"
        v-loading="logLoading"
        stripe
        size="small"
        style="margin-top: 8px"
      >
        <el-table-column label="采集时间" width="155">
          <template #default="{ row }">{{ formatTime(row.collectTime) }}</template>
        </el-table-column>
        <el-table-column label="结果" width="65" align="center">
          <template #default="{ row }">
            <el-icon v-if="row.success" color="var(--sev-ok, #15A36A)" :size="16"><CircleCheck /></el-icon>
            <el-icon v-else color="var(--sev-crit, #E5484D)" :size="16"><CircleClose /></el-icon>
          </template>
        </el-table-column>
        <el-table-column label="耗时" width="80" align="right">
          <template #default="{ row }">{{ formatDuration(row.durationMs) }}</template>
        </el-table-column>
        <el-table-column label="数值指标" width="75" align="right" prop="metricCount" />
        <el-table-column label="文本指标" width="75" align="right" prop="textCount" />
        <el-table-column label="对象指标" width="75" align="right" prop="objectCount" />
        <el-table-column label="错误信息" min-width="160">
          <template #default="{ row }">
            <template v-if="row.errorMessage">
              <el-popover
                placement="left"
                :width="360"
                trigger="click"
                popper-class="error-popover"
              >
                <template #reference>
                  <span class="error-msg-preview">{{ row.errorMessage }}</span>
                </template>
                <div class="error-popover-body">
                  <div class="error-popover-header">
                    <el-icon color="var(--sev-crit, #E5484D)" :size="14"><CircleClose /></el-icon>
                    <span>错误详情</span>
                  </div>
                  <pre class="error-popover-text">{{ row.errorMessage }}</pre>
                </div>
              </el-popover>
            </template>
            <span v-else class="no-data">—</span>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="logList.length === 0 && !logLoading" class="log-empty">
        <el-empty description="暂无采集记录" />
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CircleCheck, CircleClose, Refresh } from '@element-plus/icons-vue'
import ProTable from '@/components/ProTable/index.vue'
import type { TableColumn } from '@/components/ProTable/types'
import StatCard from '@/components/StatCard.vue'
import { fmtMs as formatDuration, formatDateTime as formatTime } from '@/utils/format'
import type { CollectLogRecord, CollectTaskSummary } from '@/types'
import { listCollectLogs, listCollectTasks } from '@/api/collect-log'

const columns: TableColumn[] = [
  { label: '实例', minWidth: 180, slot: 'col-instance', showOverflowTooltip: false },
  { label: '类型/版本', width: 120, slot: 'col-dbType', showOverflowTooltip: false },
  { label: '频率', width: 120, slot: 'col-frequency', showOverflowTooltip: false },
  { label: '状态', width: 95, align: 'center', slot: 'col-status', showOverflowTooltip: false },
  { label: '最近采集', width: 155, slot: 'col-lastCollect', showOverflowTooltip: false },
  { label: '执行结果', width: 95, align: 'center', slot: 'col-result', showOverflowTooltip: false },
  { label: '耗时', width: 85, align: 'right', slot: 'col-duration', showOverflowTooltip: false },
  { label: '指标行数', width: 85, align: 'right', slot: 'col-metricCount', showOverflowTooltip: false },
  { label: '近24h成功率', width: 140, slot: 'col-successRate', showOverflowTooltip: false },
]

// ── 任务列表 ────────────────────────────────────────────────────────────────

const loading = ref(false)
const allTasks = ref<CollectTaskSummary[]>([])

const filterKeyword = ref('')
const filterFrequency = ref('')
const filterStatus = ref('')

const filteredList = computed(() => {
  const kw = filterKeyword.value.trim().toLowerCase()
  return allTasks.value.filter((t) => {
    if (kw && !t.instanceName.toLowerCase().includes(kw) && !t.host.toLowerCase().includes(kw)) {
      return false
    }
    if (filterFrequency.value && t.frequency !== filterFrequency.value) return false
    if (filterStatus.value && t.status !== filterStatus.value) return false
    return true
  })
})

const stats = computed(() => {
  const all = filteredList.value
  return {
    total: all.length,
    total1m: all.filter((t) => t.frequency === '1m').length,
    total1h: all.filter((t) => t.frequency === '1h').length,
    total1d: all.filter((t) => t.frequency === '1d').length,
    running: all.filter((t) => t.status === 'running').length,
    stopped: all.filter((t) => t.status === 'stopped').length,
    error: all.filter((t) => t.status === 'error').length
  }
})

async function loadTasks() {
  loading.value = true
  try {
    allTasks.value = await listCollectTasks()
  } finally {
    loading.value = false
  }
}

function handleReset() {
  filterKeyword.value = ''
  filterFrequency.value = ''
  filterStatus.value = ''
}

// ── 日志抽屉 ────────────────────────────────────────────────────────────────

const logDrawerVisible = ref(false)
const logLoading = ref(false)
const logList = ref<CollectLogRecord[]>([])
const logLimit = ref(50)
const currentTask = ref<CollectTaskSummary | null>(null)

const logDrawerTitle = computed(() => {
  if (!currentTask.value) return '采集历史日志'
  return `${currentTask.value.instanceName} · ${currentTask.value.frequencyLabel} · 采集历史`
})

function openLog(row: CollectTaskSummary) {
  currentTask.value = row
  logList.value = []
  logDrawerVisible.value = true
  loadLogs()
}

async function loadLogs() {
  if (!currentTask.value) return
  logLoading.value = true
  try {
    logList.value = await listCollectLogs(
      currentTask.value.instanceId,
      currentTask.value.frequency,
      logLimit.value
    )
  } finally {
    logLoading.value = false
  }
}

function freqTagType(freq: string) {
  return freq === '1m' ? 'primary' : freq === '1h' ? 'warning' : 'info'
}

function statusTagType(status: string) {
  return status === 'running' ? 'success' : status === 'error' ? 'danger' : 'info'
}

function statusLabel(status: string): string {
  return { running: '正常', stopped: '已暂停', error: '失败' }[status] ?? status
}

function rateColor(rate: number): string {
  if (rate >= 95) return 'var(--sev-ok, #15A36A)'
  if (rate >= 80) return 'var(--el-color-warning)'
  return 'var(--sev-crit, #E5484D)'
}

// ── 生命周期 ────────────────────────────────────────────────────────────────

onMounted(loadTasks)
</script>

<style scoped>
.collector-page {
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── 统计卡片 ── */
.stat-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  flex-shrink: 0;
}

/* ── 表格单元格 ── */
.cell-instance {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.instance-name {
  font-weight: 500;
  color: var(--el-text-color-primary);
}
.instance-host {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-family: var(--el-font-family-mono, monospace);
}

.time-text {
  font-size: 12px;
  font-family: var(--el-font-family-mono, monospace);
}

.duration {
  font-family: var(--el-font-family-mono, monospace);
  font-size: 13px;
}

.no-data {
  color: var(--el-text-color-placeholder);
}

.success-rate-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
}
.rate-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  width: 34px;
  flex-shrink: 0;
  text-align: right;
}

/* ── 日志抽屉 ── */
.log-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}
.spacer {
  flex: 1;
}

.error-msg-preview {
  color: var(--sev-crit, #e5484d);
  font-size: 12px;
  cursor: pointer;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}
.error-msg-preview:hover {
  opacity: 0.8;
}

.log-empty {
  padding: 40px 0;
}
</style>

<style>
/* el-popover 通过 teleport 渲染在 body 下，需全局样式穿透 */
.error-popover {
  padding: 0 !important;
}
.error-popover-body {
  padding: 12px 14px;
}
.error-popover-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
}
.error-popover-text {
  font-family: var(--el-font-family-mono, monospace);
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 260px;
  overflow-y: auto;
  margin: 0;
  padding: 8px 10px;
  background: var(--el-fill-color-light);
  border-radius: var(--radius-sm);
}
</style>
