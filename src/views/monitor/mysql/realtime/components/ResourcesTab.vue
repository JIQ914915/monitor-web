<template>
  <div class="res-tab">

    <!-- ① 表空间 Top 10 -->
    <el-card shadow="never" v-loading="loadingTables">
      <template #header>
        <div class="card-header-row">
          <span class="card-title">表空间 Top 10</span>
          <el-button size="small" @click="loadTableData">
            <el-icon><Refresh /></el-icon> 刷新
          </el-button>
        </div>
      </template>
      <el-empty v-if="!tableRows.length && !loadingTables" description="暂无表空间数据" :image-size="56" />
      <ProTable
        v-else
        :data="tableRows"
        :columns="tableColumns"
        :show-toolbar="false"
        :show-operation="false"
        :show-pagination="false"
        embedded
      >
        <template #col-index="{ $index }">{{ $index + 1 }}</template>
        <template #col-table="{ row }">
          <span class="db-name">{{ row.schema }}</span>
          <span class="tbl-sep">.</span>
          <span class="tbl-name">{{ row.tableName }}</span>
        </template>
        <template #col-data="{ row }">{{ fmtBytes(row.dataBytes) }}</template>
        <template #col-index-size="{ row }">{{ fmtBytes(row.indexBytes) }}</template>
        <template #col-total="{ row }"><span class="bold">{{ fmtBytes(row.totalBytes) }}</span></template>
        <template #col-rows="{ row }">{{ fmtNum(row.rows) }}</template>
        <template #col-growth="{ row }">
          <el-tag
            v-if="row.growthRatePct != null"
            :type="row.growthRatePct > 20 ? 'danger' : row.growthRatePct > 0 ? 'warning' : 'success'"
            size="small"
          >{{ row.growthRatePct >= 0 ? '+' : '' }}{{ row.growthRatePct.toFixed(1) }}%</el-tag>
          <span v-else class="muted">-</span>
        </template>
      </ProTable>
    </el-card>

    <!-- ①.5 表 I/O 热点（近 1 小时，5.7/8.0） -->
    <el-card shadow="never" v-loading="loadingTableIo">
      <template #header>
        <div class="card-header-row">
          <span class="card-title">表 I/O 热点（近 1 小时）</span>
          <el-tooltip
            content="performance_schema 表级 I/O 统计的小时差值：等待耗时最高的表即当前最热的表。MySQL 5.6 不支持"
            placement="top"
          >
            <span class="muted" style="cursor: help">统计口径</span>
          </el-tooltip>
        </div>
      </template>
      <el-empty
        v-if="!tableIoTotal && !loadingTableIo"
        description="暂无表 I/O 数据（首个采集周期建立基线后产出；MySQL 5.6 不支持）"
        :image-size="56"
      />
      <ProTable
        v-else-if="tableIoTotal > 0"
        :data="tableIoRows"
        :columns="tableIoColumns"
        :loading="loadingTableIo"
        :total="tableIoTotal"
        v-model:page-num="tableIoPageNum"
        v-model:page-size="tableIoPageSize"
        :page-sizes="[10, 20, 50]"
        :show-toolbar="false"
        :show-operation="false"
        embedded
        @page-change="loadTableIo"
      >
        <template #col-io-index="{ $index }">
          {{ (tableIoPageNum - 1) * tableIoPageSize + $index + 1 }}
        </template>
        <template #col-io-table="{ row }">
          <span class="db-name">{{ row.schema }}</span>
          <span class="tbl-sep">.</span>
          <span class="tbl-name">{{ row.tableName }}</span>
        </template>
        <template #col-io-wait="{ row }">
          <span class="bold" :style="{ color: row.waitMs > 60000 ? '#E5484D' : undefined }">
            {{ fmtWaitMs(row.waitMs) }}
          </span>
        </template>
      </ProTable>
    </el-card>

    <!-- ①.6 疑似未使用索引（天级扫描，5.7/8.0） -->
    <el-card shadow="never" v-loading="loadingUnusedIdx">
      <template #header>
        <div class="card-header-row">
          <span class="card-title">疑似未使用索引</span>
          <span class="muted">自实例启动以来从未被访问的二级索引（每日扫描）</span>
        </div>
      </template>
      <el-alert
        v-if="unusedIdxTotal > 0 && unusedIdxUptimeDays < 7"
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 12px"
        :title="`实例运行仅 ${unusedIdxUptimeDays} 天，统计自启动累计，“未使用”结论可能不可靠（周期性任务的索引尚未被触发）`"
      />
      <el-empty
        v-if="!unusedIdxTotal && !loadingUnusedIdx"
        description="未发现疑似未使用索引（或版本不支持 / 数据未产出）"
        :image-size="56"
      />
      <ProTable
        v-else-if="unusedIdxTotal > 0"
        :data="unusedIdxRows"
        :columns="unusedIdxColumns"
        :loading="loadingUnusedIdx"
        :total="unusedIdxTotal"
        v-model:page-num="unusedIdxPageNum"
        v-model:page-size="unusedIdxPageSize"
        :page-sizes="[10, 20, 50]"
        :show-toolbar="false"
        :show-operation="false"
        embedded
        @page-change="loadUnusedIdx"
      >
        <template #col-ui-index="{ $index }">
          {{ (unusedIdxPageNum - 1) * unusedIdxPageSize + $index + 1 }}
        </template>
      </ProTable>
      <div v-if="unusedIdxTotal > 0" class="forecast-note">
        删除索引前请人工确认：低频访问（月度报表、年度结算等）的索引在观察期内可能未被触发。
      </div>
    </el-card>

    <!-- ② 容量预测 -->
    <el-card shadow="never" v-loading="loadingForecast">
      <template #header>
        <div class="card-header-row">
          <span class="card-title">容量预测</span>
          <el-tooltip
            content="按最近 15 天库表容量日均增长线性外推；数据盘取实例关联主机中容量最大的挂载点"
            placement="top"
          >
            <span class="muted" style="cursor: help">估算口径</span>
          </el-tooltip>
        </div>
      </template>
      <el-empty v-if="!forecast && !loadingForecast" description="暂无容量预测数据" :image-size="56" />
      <template v-else-if="forecast">
        <div class="bp-grid forecast-grid">
          <div class="bp-item">
            <div class="bp-icon bp-icon--blue"><DataAnalysis /></div>
            <div class="bp-body">
              <div class="bp-label">当前库表总容量</div>
              <div class="bp-val">{{ fmtBytes(forecast.currentBytes) }}</div>
            </div>
          </div>
          <div class="bp-item">
            <div class="bp-icon" :class="(forecast.dailyGrowthBytes ?? 0) > 0 ? 'bp-icon--orange' : 'bp-icon--green'"><TrendCharts /></div>
            <div class="bp-body">
              <div class="bp-label">日均增长{{ forecast.sampleDays ? `（近 ${forecast.sampleDays} 天）` : '' }}</div>
              <div class="bp-val">
                {{ forecast.dailyGrowthBytes == null ? '-' : (forecast.dailyGrowthBytes > 0 ? '+' : '') + fmtBytes(forecast.dailyGrowthBytes) }}
              </div>
            </div>
          </div>
          <div class="bp-item">
            <div class="bp-icon bp-icon--indigo"><PieChart /></div>
            <div class="bp-body">
              <div class="bp-label">数据盘剩余{{ forecast.diskMount ? `（${forecast.diskMount}）` : '' }}</div>
              <div class="bp-val">
                {{ fmtBytes(forecast.diskAvailBytes) }}
                <span v-if="forecast.diskUsagePercent != null" class="muted" style="font-size:12px">
                  已用 {{ forecast.diskUsagePercent.toFixed(1) }}%
                </span>
              </div>
            </div>
          </div>
          <div class="bp-item" :class="{ 'bp-item--warn': forecastWarn }">
            <div class="bp-icon" :class="forecastWarn ? 'bp-icon--red' : 'bp-icon--teal'"><Timer /></div>
            <div class="bp-body">
              <div class="bp-label">预计剩余可用天数</div>
              <div class="bp-val" :style="{ color: forecastWarn ? '#E5484D' : undefined }">
                {{ forecast.estimatedDaysRemaining == null ? '-' : forecast.estimatedDaysRemaining + ' 天' }}
              </div>
            </div>
          </div>
        </div>
        <div v-if="forecast.note" class="forecast-note">{{ forecast.note }}</div>
      </template>
    </el-card>

    <!-- ③ InnoDB Buffer Pool -->
    <el-card shadow="never" v-loading="loadingBp">
      <template #header><span class="card-title">InnoDB Buffer Pool</span></template>
      <div class="bp-grid">
        <div class="bp-item">
          <div class="bp-icon bp-icon--blue"><DataAnalysis /></div>
          <div class="bp-body">
            <div class="bp-label">Pool 大小</div>
            <div class="bp-val">{{ fmtBytes(bp.size) }}</div>
          </div>
        </div>
        <div class="bp-item">
          <div class="bp-icon bp-icon--indigo"><Cpu /></div>
          <div class="bp-body">
            <div class="bp-label">已使用</div>
            <div class="bp-val">{{ fmtBytes(bp.bytesData) }}</div>
          </div>
        </div>
        <div class="bp-item bp-item--progress">
          <div class="bp-icon bp-icon--purple"><PieChart /></div>
          <div class="bp-body" style="flex:1">
            <div class="bp-label">使用率</div>
            <div class="bp-val-row">
              <span class="bp-val" :style="{ color: (bp.usage ?? 0) > 90 ? '#E5484D' : undefined }">{{ bp.usage?.toFixed(1) ?? '-' }}%</span>
              <el-progress
                :percentage="bp.usage ?? 0"
                :color="(bp.usage ?? 0) > 90 ? '#E5484D' : '#15A36A'"
                :stroke-width="6" :show-text="false"
                style="flex:1; margin-left:12px"
              />
            </div>
          </div>
        </div>
        <div class="bp-item" :class="{ 'bp-item--warn': (bp.hitRate ?? 100) < 90 }">
          <div class="bp-icon" :class="(bp.hitRate ?? 100) < 90 ? 'bp-icon--red' : 'bp-icon--green'"><TrendCharts /></div>
          <div class="bp-body">
            <div class="bp-label">读命中率</div>
            <div class="bp-val" :style="{ color: (bp.hitRate ?? 100) < 90 ? '#E5484D' : '#15A36A' }">
              {{ bp.hitRate?.toFixed(2) ?? '-' }}%
            </div>
          </div>
        </div>
        <div class="bp-item" :class="{ 'bp-item--warn': (bp.dirtyRatio ?? 0) > 60 }">
          <div class="bp-icon" :class="(bp.dirtyRatio ?? 0) > 60 ? 'bp-icon--orange' : 'bp-icon--gray'"><Warning /></div>
          <div class="bp-body">
            <div class="bp-label">脏页比例</div>
            <div class="bp-val" :style="{ color: (bp.dirtyRatio ?? 0) > 60 ? '#E08600' : undefined }">
              {{ bp.dirtyRatio?.toFixed(2) ?? '-' }}%
            </div>
          </div>
        </div>
        <div class="bp-item">
          <div class="bp-icon bp-icon--teal"><Operation /></div>
          <div class="bp-body">
            <div class="bp-label">刷新速率</div>
            <div class="bp-val">{{ bp.flushRate != null ? bp.flushRate.toFixed(1) + ' 页/s' : '-' }}</div>
          </div>
        </div>
      </div>
    </el-card>

    <!-- ④ 临时表 & 慢查询 -->
    <div class="stat-row">
      <el-card shadow="never" v-loading="loadingToday" class="stat-card stat-card--blue">
        <div class="sc-top">
          <div class="sc-icon sc-icon--blue"><Grid /></div>
          <span class="sc-label">临时表创建数（今日）</span>
        </div>
        <div class="sc-value">{{ todayStats.tmpTablesToday ?? '-' }}</div>
        <div class="sc-sub">
          磁盘临时表 <strong>{{ todayStats.tmpDiskTablesToday ?? 0 }}</strong> 条
          <el-tag
            v-if="(todayStats.diskRatioPct ?? 0) > 0"
            :type="(todayStats.diskRatioPct ?? 0) > 30 ? 'danger' : 'warning'"
            size="small" style="margin-left:6px"
          >{{ (todayStats.diskRatioPct ?? 0).toFixed(1) }}%</el-tag>
        </div>
      </el-card>

      <el-card shadow="never" v-loading="loadingToday" class="stat-card stat-card--orange">
        <div class="sc-top">
          <div class="sc-icon sc-icon--orange"><Timer /></div>
          <span class="sc-label">慢查询次数（今日）</span>
        </div>
        <div class="sc-value" :style="{ color: (todayStats.slowQueriesToday ?? 0) > 100 ? '#E5484D' : undefined }">
          {{ todayStats.slowQueriesToday ?? '-' }}
        </div>
        <div class="sc-sub">
          慢查询阈值 <strong>{{ slowQueryTime ?? '-' }} s</strong>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { Refresh, DataAnalysis, Cpu, PieChart, TrendCharts, Warning, Operation, Grid, Timer } from '@element-plus/icons-vue'
import ProTable from '@/components/ProTable/index.vue'
import { getMetricLatest, getTableGrowth, getTodayStats, getMetricObjects, getCapacityForecast, pageTableIo, pageUnusedIndex } from '@/api/metric'
import { M } from '@/constants/metrics'
import type { TodayStatsVo, CapacityForecastVo } from '@/types/monitor'
import type { TableColumn } from '@/components/ProTable/types'

const props = defineProps<{ instanceId: number }>()

const loadingBp       = ref(false)
const loadingToday    = ref(false)
const loadingTables   = ref(false)
const loadingForecast = ref(false)

// ── 容量预测 ─────────────────────────────────────────────────────────────
const forecast = ref<CapacityForecastVo | null>(null)

/** 预计剩余天数低于 90 天时标红提醒 */
const forecastWarn = computed(() =>
  forecast.value?.estimatedDaysRemaining != null && forecast.value.estimatedDaysRemaining < 90)

async function loadForecast() {
  loadingForecast.value = true
  try {
    forecast.value = await getCapacityForecast(props.instanceId)
  } catch {
    forecast.value = null
  } finally {
    loadingForecast.value = false
  }
}

const bp = reactive<{
  size: number | null; bytesData: number | null; usage: number | null
  hitRate: number | null; dirtyRatio: number | null; flushRate: number | null
}>({ size: null, bytesData: null, usage: null, hitRate: null, dirtyRatio: null, flushRate: null })

const todayStats    = reactive<Partial<TodayStatsVo>>({})
const slowQueryTime = ref<number | null>(null)

interface TableRow {
  schema: string; tableName: string
  dataBytes: number; indexBytes: number; totalBytes: number; rows: number
  growthRatePct: number | null
}
const tableRows = ref<TableRow[]>([])

const tableColumns: TableColumn[] = [
  { prop: 'index',         label: '#',        width: 50,  align: 'center', slot: 'col-index' },
  { prop: 'tableName',     label: '数据库 / 表名', minWidth: 180, showOverflowTooltip: true, slot: 'col-table' },
  { prop: 'dataBytes',     label: '数据',      minWidth: 100, align: 'right', sortable: true, slot: 'col-data' },
  { prop: 'indexBytes',    label: '索引',      minWidth: 100, align: 'right', slot: 'col-index-size' },
  { prop: 'totalBytes',    label: '总大小',     minWidth: 100, align: 'right', sortable: true, slot: 'col-total' },
  { prop: 'rows',          label: '行数',       minWidth: 100, align: 'right', sortable: true, slot: 'col-rows' },
  { prop: 'growthRatePct', label: '增长/周',    width: 100, align: 'center', slot: 'col-growth' },
]

function fmtBytes(b: number | null | undefined): string {
  if (b == null) return '-'
  if (b >= 1073741824) return (b / 1073741824).toFixed(2) + ' GB'
  if (b >= 1048576)    return (b / 1048576).toFixed(1) + ' MB'
  if (b >= 1024)       return (b / 1024).toFixed(1) + ' KB'
  return b + ' B'
}
function fmtNum(n: number): string {
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '亿'
  if (n >= 1e4) return (n / 1e4).toFixed(1) + '万'
  return String(n)
}

// ── 表 I/O 热点（近 1 小时，后端真实分页）────────────────────────────────
const loadingTableIo = ref(false)
const tableIoPageNum = ref(1)
const tableIoPageSize = ref(10)
const tableIoTotal = ref(0)

interface TableIoRow {
  schema: string; tableName: string
  waitMs: number; readCount: number; writeCount: number
}
const tableIoRows = ref<TableIoRow[]>([])

const tableIoColumns: TableColumn[] = [
  { prop: 'index',      label: '#',           width: 50,  align: 'center', slot: 'col-io-index' },
  { prop: 'tableName',  label: '数据库 / 表名', minWidth: 180, showOverflowTooltip: true, slot: 'col-io-table' },
  { prop: 'waitMs',     label: 'I/O 等待耗时', minWidth: 120, align: 'right', slot: 'col-io-wait' },
  { prop: 'readCount',  label: '读操作次数',   minWidth: 110, align: 'right', formatter: r => fmtNum(r.readCount) },
  { prop: 'writeCount', label: '写操作次数',   minWidth: 110, align: 'right', formatter: r => fmtNum(r.writeCount) },
]

function fmtWaitMs(ms: number): string {
  if (ms >= 60000) return (ms / 60000).toFixed(1) + ' 分钟'
  if (ms >= 1000)  return (ms / 1000).toFixed(1) + ' 秒'
  return ms.toFixed(0) + ' ms'
}

async function loadTableIo() {
  if (!props.instanceId) return
  loadingTableIo.value = true
  try {
    const res = await pageTableIo(props.instanceId, tableIoPageNum.value, tableIoPageSize.value)
    tableIoTotal.value = res.total ?? 0
    tableIoRows.value = (res.list ?? []).map(item => ({
      schema: item.schemaName ?? '',
      tableName: item.tableName ?? '',
      waitMs: item.waitMs ?? 0,
      readCount: item.readCount ?? 0,
      writeCount: item.writeCount ?? 0
    }))
    if (!tableIoRows.value.length && tableIoTotal.value > 0 && tableIoPageNum.value > 1) {
      tableIoPageNum.value = Math.max(1, Math.ceil(tableIoTotal.value / tableIoPageSize.value))
      await loadTableIo()
    }
  } catch {
    tableIoRows.value = []
    tableIoTotal.value = 0
  } finally { loadingTableIo.value = false }
}

// ── 疑似未使用索引（天级，后端真实分页）──────────────────────────────────
const loadingUnusedIdx = ref(false)
const unusedIdxPageNum = ref(1)
const unusedIdxPageSize = ref(10)
const unusedIdxTotal = ref(0)
const unusedIdxUptimeDays = ref(0)
const unusedIdxRows = ref<{ schema: string; table: string; index: string }[]>([])

const unusedIdxColumns: TableColumn[] = [
  { prop: 'rowNo',  label: '#',     width: 50, align: 'center', slot: 'col-ui-index' },
  { prop: 'schema', label: '数据库', minWidth: 120 },
  { prop: 'table',  label: '表',    minWidth: 160 },
  { prop: 'index',  label: '索引名', minWidth: 160 },
]

async function loadUnusedIdx() {
  if (!props.instanceId) return
  loadingUnusedIdx.value = true
  try {
    const res = await pageUnusedIndex(props.instanceId, unusedIdxPageNum.value, unusedIdxPageSize.value)
    unusedIdxTotal.value = res.total ?? 0
    unusedIdxUptimeDays.value = res.uptimeDays ?? 0
    unusedIdxRows.value = (res.list ?? []).map(i => ({
      schema: i.schemaName ?? '',
      table: i.tableName ?? '',
      index: i.indexName ?? ''
    }))
    if (!unusedIdxRows.value.length && unusedIdxTotal.value > 0 && unusedIdxPageNum.value > 1) {
      unusedIdxPageNum.value = Math.max(1, Math.ceil(unusedIdxTotal.value / unusedIdxPageSize.value))
      await loadUnusedIdx()
    }
  } catch {
    unusedIdxRows.value = []
    unusedIdxTotal.value = 0
    unusedIdxUptimeDays.value = 0
  } finally { loadingUnusedIdx.value = false }
}

async function loadTableData() {
  loadingTables.value = true
  try {
    const [totalRes, dataRes, indexRes, rowRes, growthRes] = await Promise.allSettled([
      getMetricObjects(props.instanceId, M.OBJ_TABLE_TOTAL_BYTES, 10),
      getMetricObjects(props.instanceId, M.OBJ_TABLE_DATA_BYTES, 10),
      getMetricObjects(props.instanceId, M.OBJ_TABLE_INDEX_BYTES, 10),
      getMetricObjects(props.instanceId, M.OBJ_TABLE_ROWS, 10),
      getTableGrowth(props.instanceId, M.OBJ_TABLE_TOTAL_BYTES, 10)
    ])
    const totalItems = totalRes.status === 'fulfilled' ? totalRes.value.items ?? [] : []
    const dataMap    = dataRes.status  === 'fulfilled' ? Object.fromEntries((dataRes.value.items ?? []).map(i => [i.objectName, i.value])) : {}
    const indexMap   = indexRes.status === 'fulfilled' ? Object.fromEntries((indexRes.value.items ?? []).map(i => [i.objectName, i.value])) : {}
    const rowMap     = rowRes.status   === 'fulfilled' ? Object.fromEntries((rowRes.value.items ?? []).map(i => [i.objectName, i.value])) : {}
    const growthMap  = growthRes.status === 'fulfilled'
      ? Object.fromEntries((growthRes.value.tables ?? []).map(t => [t.objectName, t.growthRatePct]))
      : {}
    tableRows.value = totalItems.map(item => {
      const [schema, tableName] = item.objectName.split('.')
      return {
        schema: schema ?? item.objectName, tableName: tableName ?? '',
        dataBytes:  dataMap[item.objectName]  ?? 0,
        indexBytes: indexMap[item.objectName] ?? 0,
        totalBytes: item.value,
        rows:       rowMap[item.objectName]   ?? 0,
        growthRatePct: growthMap[item.objectName] ?? null
      }
    })
  } finally { loadingTables.value = false }
}

async function loadAll() {
  if (!props.instanceId) return
  loadingBp.value = loadingToday.value = true
  tableIoPageNum.value = 1
  unusedIdxPageNum.value = 1

  await Promise.allSettled([
    getMetricLatest(props.instanceId, [
      M.BP_BYTES_DATA, M.BP_HIT_RATE, M.BP_DIRTY_RATIO, M.BP_USAGE,
      'mysql.rate.Innodb_buffer_pool_pages_flushed'
    ]).then(r => {
      const v = r.values
      bp.bytesData  = v[M.BP_BYTES_DATA]  ?? null
      bp.usage      = v[M.BP_USAGE]       ?? null
      bp.hitRate    = v[M.BP_HIT_RATE]    ?? null
      bp.dirtyRatio = v[M.BP_DIRTY_RATIO] ?? null
      bp.flushRate  = v['mysql.rate.Innodb_buffer_pool_pages_flushed'] ?? null
      loadingBp.value = false
    }),

    Promise.all([
      getTodayStats(props.instanceId),
      getMetricLatest(props.instanceId, [M.VAR_LONG_QUERY_TIME, M.VAR_BP_SIZE])
    ]).then(([today, latest]) => {
      Object.assign(todayStats, today)
      slowQueryTime.value = latest.values[M.VAR_LONG_QUERY_TIME] ?? null
      bp.size = latest.values[M.VAR_BP_SIZE] ?? null
      loadingToday.value = false
    }),

    loadTableData(),
    loadForecast(),
    loadTableIo(),
    loadUnusedIdx()
  ])
}

watch(() => props.instanceId, loadAll, { immediate: true })
</script>

<style scoped>
.res-tab { display: flex; flex-direction: column; gap: 16px; padding: 4px 0; }
.card-header-row { display: flex; align-items: center; justify-content: space-between; }
.bold { font-weight: 600; }
.muted { color: var(--el-text-color-placeholder); font-size: 13px; }

/* 表格列样式 */
.db-name  { font-size: 12px; color: var(--el-text-color-secondary); }
.tbl-sep  { color: var(--el-text-color-placeholder); margin: 0 1px; }
.tbl-name { font-size: 13px; font-weight: 500; color: var(--el-text-color-primary); }

/* Buffer Pool 网格 */
.bp-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.bp-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius-base);
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-extra-light);
  transition: box-shadow .15s;
}
.bp-item:hover { box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.bp-item--progress { grid-column: span 1; }
.bp-item--warn { border-color: #fde2e2; background: #fff8f8; }
.bp-icon {
  width: 36px; height: 36px; border-radius: var(--radius-base);
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; flex-shrink: 0;
}
.bp-icon--blue   { background: #EFF6FF; color: #2D7FF0; }
.bp-icon--indigo { background: #EEF2FF; color: #6366F1; }
.bp-icon--purple { background: #F5F3FF; color: #8B5CF6; }
.bp-icon--green  { background: #ECFDF5; color: #15A36A; }
.bp-icon--red    { background: #FEF2F2; color: #E5484D; }
.bp-icon--orange { background: #FFF7ED; color: #E08600; }
.bp-icon--gray   { background: #F3F4F6; color: #6B7280; }
.bp-icon--teal   { background: #ECFEFF; color: #0C7C97; }
.bp-body { flex: 1; min-width: 0; }
.forecast-grid { grid-template-columns: repeat(4, 1fr); }
@media (max-width: 1200px) {
  .forecast-grid { grid-template-columns: repeat(2, 1fr); }
}
.forecast-note {
  margin-top: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  padding: 8px 12px;
  background: var(--el-fill-color-light);
  border-radius: var(--radius-sm, 4px);
}
.bp-label { font-size: 12px; color: var(--el-text-color-secondary); margin-bottom: 4px; }
.bp-val   { font-size: 18px; font-weight: 700; color: var(--el-text-color-primary); line-height: 1.2; }
.bp-val-row { display: flex; align-items: center; }

/* 今日统计卡片 */
.stat-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.stat-card {
  padding: 0;
  position: relative;
  overflow: hidden;
}
.stat-card :deep(.el-card__body) { padding: 20px; }
.stat-card--blue  { border-top: 3px solid #0C7C97; }
.stat-card--orange { border-top: 3px solid #E08600; }
.sc-top  { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.sc-icon { width: 28px; height: 28px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
.sc-icon--blue   { background: #EFF6FF; color: #0C7C97; }
.sc-icon--orange { background: #FFF7ED; color: #E08600; }
.sc-label { font-size: 13px; color: var(--el-text-color-secondary); }
.sc-value { font-size: 36px; font-weight: 700; color: var(--el-text-color-primary); line-height: 1; margin-bottom: 10px; }
.sc-sub   { font-size: 13px; color: var(--el-text-color-secondary); display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
.sc-sub strong { color: var(--el-text-color-primary); }
</style>
