<template>
  <div class="slowsql-page">
    <!-- 无实例选中提示 -->
    <InstanceEmpty v-if="!inst" description="请先在顶栏选择一个实例，查看其慢SQL分析" />

    <template v-else>
      <!-- Top SQL 不可用提示（按实例类型给出对应引导） -->
      <el-alert
        v-if="stats && stats.topSqlSupported === false"
        type="warning"
        show-icon
        :closable="false"
        :title="unsupportedHint.title"
        :description="unsupportedHint.description"
      />

      <el-alert
        v-if="sqlServerSourceNotice"
        :type="sqlServerSourceNotice.type"
        show-icon
        :closable="false"
        :title="sqlServerSourceNotice.title"
        :description="sqlServerSourceNotice.description"
      />

      <!-- 页头：窗口说明 + 刷新 -->
      <div class="page-toolbar">
        <div class="toolbar-left">
          <el-tooltip :content="windowTooltip" placement="bottom">
            <el-tag type="info" class="window-tag">统计窗口：最近 24 小时</el-tag>
          </el-tooltip>
          <span v-if="stats?.longQueryTimeSeconds != null" class="threshold-hint">
            慢查询阈值 long_query_time：{{ stats.longQueryTimeSeconds }}s
          </span>
        </div>
        <div class="toolbar-right">
          <el-button :icon="Refresh" :loading="fpLoading || listLoading" @click="reloadAll">刷新</el-button>
        </div>
      </div>

      <!-- 统计卡片（对齐原型 6 卡） -->
      <div class="stats-grid" v-loading="statsLoading">
        <StatCard
          v-for="card in statCards"
          :key="card.label"
          size="small"
          :label="card.label"
          :value="card.value"
          :sub="card.sub"
          :tone="card.tone"
          :value-tone="card.valueTone"
        />
      </div>

      <!-- 分析主体：四个分析视角页签化，避免纵向卡片堆叠 -->
      <el-card shadow="never" class="table-card analysis-card">
        <el-tabs v-model="activeTab">
          <!-- ① SQL指纹分析 -->
          <el-tab-pane label="SQL指纹分析" name="fp">
            <div class="filter-row pane-filter">
              <div class="filter-item">
                <span class="filter-label">SQL类型</span>
                <el-select v-model="filters.sqlType" placeholder="全部" clearable class="type-select">
                  <el-option v-for="t in SQL_TYPES" :key="t" :label="t" :value="t" />
                </el-select>
              </div>
              <div class="filter-item">
                <span class="filter-label">执行时间</span>
                <el-input-number v-model="filters.minAvgMs" :min="0" :step="100" :controls="false" placeholder="最小值" class="time-input" />
                <span class="filter-sep">~</span>
                <el-input-number v-model="filters.maxAvgMs" :min="0" :step="100" :controls="false" placeholder="最大值" class="time-input" />
                <span class="filter-unit">ms</span>
              </div>
              <el-button type="primary" :icon="Search" @click="onSearch">查询</el-button>
              <el-button @click="onReset">重置</el-button>
            </div>
            <ProTable
              embedded
              :data="fpRows"
              :columns="fpColumns"
              :loading="fpLoading"
              :total="fpTotal"
              v-model:page-num="fpPageNum"
              v-model:page-size="fpPageSize"
              :page-sizes="[10, 20, 50]"
              :show-toolbar="false"
              :operation-width="72"
              @page-change="loadFpPage"
              @sort-change="onFpSortChange"
            >
              <template #col-digest-text="{ row }">
                <span class="sql-cell">{{ row.digestText }}</span>
              </template>
              <template #col-avg-time="{ row }">
                <span :class="avgTimeClass(row.avgTimeMs)">{{ fmtMs(row.avgTimeMs) }}</span>
              </template>
              <template #col-max-avg-time="{ row }">
                <span :class="avgTimeClass(row.maxAvgTimeMs)">{{ fmtMs(row.maxAvgTimeMs) }}</span>
              </template>
              <template #col-no-index="{ row }">
                <el-tag v-if="row.noIndexUsed > 0" type="danger" size="small">是</el-tag>
                <el-tag v-else type="info" size="small">否</el-tag>
              </template>
              <template #col-tmp-tables="{ row }">
                <el-tag v-if="row.tmpTables > 0" :type="row.tmpDiskTables > 0 ? 'danger' : 'warning'" size="small">是</el-tag>
                <el-tag v-else type="info" size="small">否</el-tag>
              </template>
              <template #col-optimize-status="{ row }">
                <DictTag dict="slow_sql_optimize_status" :value="row.optimizeStatus" />
              </template>
              <template #col-alerts="{ row }">
                <el-tooltip v-if="alertCountFor(row) > 0" content="点击查看该指纹的关联告警明细" placement="top">
                  <el-tag type="danger" size="small" class="clickable-tag" @click="openFpDetail(row)">{{ alertCountFor(row) }} 条</el-tag>
                </el-tooltip>
                <span v-else>-</span>
              </template>
              <template #operation="{ row }">
                <el-button link type="primary" size="small" @click="openFpDetail(row)">详情</el-button>
              </template>
              <template #empty>
                <el-empty description="统计窗口内暂无 SQL 指纹数据" :image-size="60" />
              </template>
            </ProTable>
          </el-tab-pane>

          <!-- ② 慢SQL样本 -->
          <el-tab-pane v-if="dbKind !== 'sqlserver'" label="慢SQL样本" name="list">
            <div class="filter-row pane-filter">
              <div class="filter-item">
                <span class="filter-label">SQL类型</span>
                <el-select v-model="filters.sqlType" placeholder="全部" clearable class="type-select">
                  <el-option v-for="t in SQL_TYPES" :key="t" :label="t" :value="t" />
                </el-select>
              </div>
              <div class="filter-item">
                <span class="filter-label">执行时间</span>
                <el-input-number v-model="filters.minAvgMs" :min="0" :step="100" :controls="false" placeholder="最小值" class="time-input" />
                <span class="filter-sep">~</span>
                <el-input-number v-model="filters.maxAvgMs" :min="0" :step="100" :controls="false" placeholder="最大值" class="time-input" />
                <span class="filter-unit">ms</span>
              </div>
              <el-button type="primary" :icon="Search" @click="onSearch">查询</el-button>
              <el-button @click="onReset">重置</el-button>
              <el-button :icon="Download" @click="exportCsv">导出CSV</el-button>
            </div>
            <ProTable
              embedded
              :data="listRows"
              :columns="listColumns"
              :loading="listLoading"
              :total="listTotal"
              v-model:page-num="listPageNum"
              v-model:page-size="listPageSize"
              :page-sizes="[10, 20, 50, 100]"
              row-key="sampleKey"
              :show-toolbar="false"
              :operation-width="72"
              @page-change="loadListPage"
              @sort-change="onListSortChange"
            >
              <template #col-sql-type="{ row }">
                <el-tag :type="sqlTypeTag(row.sqlType)" size="small">{{ row.sqlType }}</el-tag>
              </template>
              <template #col-sql-text="{ row }">
                <span class="sql-cell">{{ row.sqlText }}</span>
              </template>
              <template #col-exec-time="{ row }">
                <span :class="avgTimeClass(row.execTimeMs)">{{ fmtMs(row.execTimeMs) }}</span>
              </template>
              <template #col-no-index="{ row }">
                <el-tag v-if="row.noIndexUsed" type="danger" size="small">是</el-tag>
                <el-tag v-else type="info" size="small">否</el-tag>
              </template>
              <template #col-tmp-tables="{ row }">
                <el-tag v-if="row.tmpTables > 0" :type="row.tmpDiskTables > 0 ? 'danger' : 'warning'" size="small">是</el-tag>
                <el-tag v-else type="info" size="small">否</el-tag>
              </template>
              <template #operation="{ row }">
                <el-button link type="primary" size="small" @click="openListDetail(row)">详情</el-button>
              </template>
              <template #empty>
                <el-empty :description="sampleEmptyText" :image-size="60" />
              </template>
            </ProTable>
          </el-tab-pane>

          <!-- ③ 指纹聚类 -->
          <el-tab-pane label="指纹聚类" name="cluster">
            <div class="pane-hint">窗口内慢SQL按“语句类型 + 涉及表”聚簇，回答“慢的是不是同一类查询、集中在哪几张表”</div>
            <div v-loading="clusterLoading">
              <ProTable
                v-if="clusters.length"
                embedded
                :data="clusters"
                :columns="clusterColumns"
                :show-toolbar="false"
                :show-operation="false"
                :total="clusterTotal"
                v-model:page-num="clusterPageNum"
                v-model:page-size="clusterPageSize"
                :page-sizes="[10, 20, 50]"
                row-key="clusterKey"
                @page-change="loadClusters"
              >
                <template #col-cluster-type="{ row }">
                  <el-tag size="small" :type="sqlTypeTag(row.statementType)">{{ row.statementType }}</el-tag>
                </template>
                <template #col-cluster-tables="{ row }">
                  <el-tag
                    v-for="t in row.tables"
                    :key="t"
                    size="small"
                    type="info"
                    class="cluster-table-tag"
                  >{{ t }}</el-tag>
                </template>
                <template #col-cluster-avg="{ row }">
                  <span :class="avgTimeClass(row.avgTimeMs)">{{ row.avgTimeMs == null ? '-' : fmtMs(row.avgTimeMs) }}</span>
                </template>
                <template #col-cluster-sql="{ row }">
                  <el-tooltip :content="row.sampleSql" placement="top" :show-after="300">
                    <span class="sql-cell">{{ row.sampleSql }}</span>
                  </el-tooltip>
                </template>
              </ProTable>
              <el-empty v-else-if="!clusterLoading" description="窗口内暂无可聚类的慢SQL样本" :image-size="56" />
            </div>
          </el-tab-pane>

          <!-- ④ 时段对比 -->
          <el-tab-pane label="时段对比" name="compare">
            <div class="pane-hint">当前 24 小时窗口 vs 昨日同时段 / 上周同时段</div>
            <div v-loading="compareLoading">
              <el-empty
                v-if="!compareLoading && !compare"
                description="暂无对比数据"
                :image-size="56"
              />
              <template v-else-if="compare">
                <div class="compare-summary">
                  <div v-for="row in compareSummaryRows" :key="row.label" class="compare-row">
                    <span class="compare-row-label">{{ row.label }}</span>
                    <div class="compare-chips">
                      <div v-for="chip in row.chips" :key="chip.label" class="compare-chip">
                        <span class="chip-label">{{ chip.label }}</span>
                        <span class="chip-value">{{ chip.current }}</span>
                        <span v-if="chip.deltaText" class="chip-delta" :class="chip.deltaClass">{{ chip.deltaText }}</span>
                        <span v-else class="chip-delta chip-delta--none">无对比数据</span>
                      </div>
                    </div>
                  </div>
                </div>

                <ProTable
                  v-if="compare.topItems.length"
                  embedded
                  :data="compare.topItems"
                  :columns="compareColumns"
                  :show-toolbar="false"
                  :show-operation="false"
                  :show-pagination="false"
                >
                  <template #col-cmp-sql="{ row }">
                    <span class="sql-cell">{{ row.digestText }}</span>
                  </template>
                  <template #col-cmp-avg="{ row }">
                    <span :class="avgTimeClass(row.avgTimeMs)">{{ fmtMs(row.avgTimeMs) }}</span>
                  </template>
                  <template #col-cmp-yesterday="{ row }">
                    <RankDelta :cur-rank="row.rank" :prev-rank="row.yesterdayRank"
                      :cur-avg="row.avgTimeMs" :prev-avg="row.yesterdayAvgTimeMs" />
                  </template>
                  <template #col-cmp-lastweek="{ row }">
                    <RankDelta :cur-rank="row.rank" :prev-rank="row.lastWeekRank"
                      :cur-avg="row.avgTimeMs" :prev-avg="row.lastWeekAvgTimeMs" />
                  </template>
                </ProTable>
                <el-empty v-else description="当前窗口暂无 Top SQL 数据" :image-size="56" />
              </template>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-card>

      <!-- 指纹详情弹窗（基本信息/SQL模式/SQL明细/关联告警） -->
      <FingerprintDetailDialog
        v-model:visible="fpDetailVisible"
        :instance-id="inst?.id ?? null"
        :row="fpDetailRow"
        :alerts="alerts"
        @status-changed="onOptimizeStatusChanged"
      />

      <!-- 慢SQL详情弹窗（SQL信息/执行计划/优化建议/历史对比） -->
      <DigestDetailDialog
        v-model:visible="listDetailVisible"
        :instance-id="inst?.id ?? null"
        :row="listDetailRow"
        :real-sql="listDetailRealSql"
        :sample-only="listDetailSampleOnly"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { Download, Refresh, Search } from '@element-plus/icons-vue'
import { useInstanceStore } from '@/stores/instance'
import InstanceEmpty from '@/components/InstanceEmpty.vue'
import DictTag from '@/components/DictTag.vue'
import { fmtCount, fmtMs, fmtMdHm as fmtTime } from '@/utils/format'
import { getMetricTextLatest } from '@/api/metric'
import {
  pageSlowSqlDigest, pageSlowSqlSamples, getSlowSqlDigestDetail, getSlowSqlStats, listSlowSqlAlerts,
  getSlowSqlWindowCompare, getSlowSqlClusters
} from '@/api/slowsql'
import type {
  SlowSqlDigestVo, SlowSqlSampleVo, SlowSqlStatsVo, SlowSqlAlertVo,
  SlowSqlWindowCompareVo, SlowSqlWindowSummary, SlowSqlClusterVo
} from '@/types/monitor'
import ProTable from '@/components/ProTable/index.vue'
import type { TableColumn } from '@/components/ProTable/types'
import StatCard from '@/components/StatCard.vue'
import DigestDetailDialog from './components/DigestDetailDialog.vue'
import FingerprintDetailDialog from './components/FingerprintDetailDialog.vue'
import RankDelta from './components/RankDelta.vue'

/** 统计窗口固定为最近 24 小时（Top SQL 为小时级采集） */
const WINDOW_MS = 24 * 3600_000

const SQL_TYPES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE']

const instanceStore = useInstanceStore()
const inst = computed(() => instanceStore.current)

/** 数据库类型文案必须显式分派，未知类型不得落入 MySQL。 */
const dbKind = computed<'mysql' | 'postgresql' | 'sqlserver' | 'unknown'>(() => {
  if (inst.value?.dbType === 'MySQL') return 'mysql'
  if (inst.value?.dbType === 'PostgreSQL') return 'postgresql'
  if (inst.value?.dbType === 'SQL Server' || inst.value?.dbType === 'SQLServer') return 'sqlserver'
  return 'unknown'
})

/** 统计窗口 tooltip：按类型说明数据来源 */
const windowTooltip = computed(() => {
  if (dbKind.value === 'postgresql') return '基于 pg_stat_statements 语句统计的小时级增量'
  if (dbKind.value === 'mysql') return '基于 performance_schema 语句摘要的小时级增量统计'
  if (dbKind.value === 'sqlserver') return '优先使用 Query Store；未启用或版本不支持时降级为实例 DMV 累计快照'
  return '当前实例数据库类型未识别，无法确定 Top SQL 数据来源'
})

/** Top SQL 不可用提示：按实例类型给出对应的启用引导 */
const unsupportedHint = computed(() => {
  if (dbKind.value === 'postgresql') {
    return {
      title: '当前 PostgreSQL 实例未启用 pg_stat_statements 扩展，暂无法提供 Top SQL 指纹分析',
      description:
        '启用步骤：① postgresql.conf 中设置 shared_preload_libraries = \'pg_stat_statements\' 并重启实例；'
        + '② 在监控库执行 CREATE EXTENSION pg_stat_statements;。就绪后系统自动开始采集（状态天级探测，可在实例能力检测中手动刷新）。'
        + '慢SQL样本列表仍然可用：系统持续从 pg_stat_activity 采样运行中的超阈值语句'
    }
  }
  if (dbKind.value === 'mysql') {
    return {
      title: '当前实例为 MySQL 5.6，不支持 performance_schema 语句摘要采集，暂无法提供 Top SQL 指纹分析',
      description:
        '慢SQL样本列表仍然可用：请在目标库开启慢日志表输出（SET GLOBAL slow_query_log=ON; '
        + 'SET GLOBAL log_output=\'TABLE\';），系统将自动从 mysql.slow_log 增量采集慢查询样本'
    }
  }
  if (dbKind.value === 'sqlserver') {
    return {
      title: 'SQL Server Top SQL 暂无可用数据',
      description: '请检查 Query Store/DMV 采集状态和监控账号只读状态权限。'
    }
  }
  return {
    title: '当前实例数据库类型未识别，暂无法提供 Top SQL 指纹分析',
    description: '请检查实例的数据库类型配置，系统不会按 MySQL 规则进行降级处理'
  }
})

/** 慢SQL样本空态说明：按类型说明样本来源与产生条件 */
const sampleEmptyText = computed(() => {
  if (dbKind.value === 'postgresql') {
    return '统计窗口内暂无慢SQL执行样本（系统按分钟从 pg_stat_activity 采样运行中的超阈值语句，阈值取 log_min_duration_statement，未配置时默认 1 秒）'
  }
  if (dbKind.value === 'mysql') {
    return '统计窗口内暂无慢SQL执行样本（样本自采集功能启用后开始积累，需实例产生超过 long_query_time 的语句）'
  }
  if (dbKind.value === 'sqlserver') return 'SQL Server 当前提供 Query Store/DMV 聚合 Top SQL，不采集逐次执行样本'
  return '当前实例数据库类型未识别，无法确定慢SQL样本来源'
})

/** 当前激活的分析页签 */
const activeTab = ref('fp')


const filters = reactive<{
  sqlType: string
  minAvgMs: number | undefined
  maxAvgMs: number | undefined
}>({ sqlType: '', minAvgMs: undefined, maxAvgMs: undefined })

// ── 表格列定义（ProTable）─────────────────────────────────────────────────
const fpColumns = computed<TableColumn[]>(() => {
  const columns: TableColumn[] = [
  { prop: 'digestText', label: 'SQL模式', minWidth: 280, slot: 'col-digest-text' },
  { prop: 'schemaName', label: '所属库', width: 104, formatter: r => r.schemaName || '-' },
  { prop: 'execCount', label: '出现次数', width: 105, align: 'right', sortable: 'custom', formatter: r => fmtCount(r.execCount) },
  { prop: 'avgTimeMs', label: '平均时长', width: 105, align: 'right', sortable: 'custom', slot: 'col-avg-time' },
  { prop: 'maxAvgTimeMs', label: '最大时长', width: 98, align: 'right', slot: 'col-max-avg-time' },
  { prop: 'noIndexUsed', label: '无索引', width: 72, align: 'center', slot: 'col-no-index' },
  { prop: 'tmpTables', label: '临时表', width: 72, align: 'center', slot: 'col-tmp-tables' },
  { prop: 'optimizeStatus', label: '优化状态', width: 90, align: 'center', slot: 'col-optimize-status' },
  { prop: 'alertCount', label: '关联告警', width: 90, align: 'center', slot: 'col-alerts' }
  ]
  return columns.filter(column => dbKind.value !== 'sqlserver' || !['noIndexUsed', 'tmpTables'].includes(column.prop ?? ''))
})

const listColumns: TableColumn[] = [
  { prop: 'sqlType', label: 'SQL类型', width: 88, align: 'center', slot: 'col-sql-type' },
  { prop: 'sqlText', label: 'SQL语句', minWidth: 280, slot: 'col-sql-text' },
  { prop: 'schemaName', label: '所属库', width: 100, formatter: r => r.schemaName || '-' },
  { prop: 'tableName', label: '表名', width: 110, formatter: r => extractTableName(r.sqlText) },
  { prop: 'connUser', label: '执行用户', width: 110, formatter: r => r.connUser || '-' },
  { prop: 'execTimeMs', label: '执行时间', width: 105, align: 'right', sortable: 'custom', slot: 'col-exec-time' },
  { prop: 'rowsExamined', label: '扫描行数', width: 105, align: 'right', sortable: 'custom', formatter: r => fmtCount(r.rowsExamined) },
  { prop: 'rowsSent', label: '返回行数', width: 92, align: 'right', formatter: r => fmtCount(r.rowsSent) },
  { prop: 'noIndexUsed', label: '无索引', width: 72, align: 'center', slot: 'col-no-index' },
  { prop: 'tmpTables', label: '临时表', width: 72, align: 'center', slot: 'col-tmp-tables' },
  { prop: 'sortRows', label: '排序行数', width: 105, align: 'right', sortable: 'custom', formatter: r => fmtCount(r.sortRows) },
  { prop: 'collectTime', label: '时间', width: 122, sortable: 'custom', formatter: r => fmtTime(r.collectTime) }
]

// ── 指纹分析表状态 ───────────────────────────────────────────────────────
const fpSortField = ref('execCount')
const fpSortAsc = ref(false)
const fpLoading = ref(false)
const fpRows = ref<SlowSqlDigestVo[]>([])
const fpTotal = ref(0)
const fpPageNum = ref(1)
const fpPageSize = ref(20)

// ── 慢SQL列表状态（真实执行样本） ────────────────────────────────────────
const listSortField = ref('execTimeUs')
const listSortAsc = ref(false)
const listLoading = ref(false)
const listRows = ref<SlowSqlSampleVo[]>([])
const listTotal = ref(0)
const listPageNum = ref(1)
const listPageSize = ref(20)

const statsLoading = ref(false)
const stats = ref<SlowSqlStatsVo | null>(null)
const sqlServerCollectState = ref<string | null>(null)

const sqlServerSourceNotice = computed<{ title: string; description: string; type: 'info' | 'warning' | 'error' } | null>(() => {
  if (dbKind.value !== 'sqlserver' || !sqlServerCollectState.value || sqlServerCollectState.value === 'available') return null
  const state = sqlServerCollectState.value
  if (state === 'permission_denied' || state === 'collect_error') {
    return { title: 'SQL Server Top SQL 采集受限', description: 'Query Store 与 DMV 均未能正常读取，请检查监控账号权限和最近采集日志。', type: 'error' }
  }
  return {
    title: 'SQL Server Top SQL 正在使用 DMV 降级数据',
    description: state === 'version_not_support'
      ? '当前版本不支持 Query Store，页面展示实例启动以来 DMV 累计快照。'
      : '目标数据库未启用 Query Store，页面展示实例启动以来 DMV 累计快照。',
    type: state === 'version_not_support' ? 'info' : 'warning'
  }
})

/** 窗口内慢SQL相关告警事件（一次加载，前端按指纹出现期交叠计数） */
const alerts = ref<SlowSqlAlertVo[]>([])

// ── 时段对比 ─────────────────────────────────────────────────────────────
const compareLoading = ref(false)
const compare = ref<SlowSqlWindowCompareVo | null>(null)

const compareColumns: TableColumn[] = [
  { prop: 'rank', label: '排名', width: 64, align: 'center' },
  { prop: 'digestText', label: 'SQL模式', minWidth: 260, slot: 'col-cmp-sql' },
  { prop: 'schemaName', label: '所属库', width: 104, formatter: r => r.schemaName || '-' },
  { prop: 'execCount', label: '执行次数', width: 100, align: 'right', formatter: r => fmtCount(r.execCount) },
  { prop: 'avgTimeMs', label: '平均耗时', width: 100, align: 'right', slot: 'col-cmp-avg' },
  { prop: 'yesterdayRank', label: '较昨日同时段', width: 170, slot: 'col-cmp-yesterday' },
  { prop: 'lastWeekRank', label: '较上周同时段', width: 170, slot: 'col-cmp-lastweek' }
]

interface CompareChip {
  label: string
  current: string
  deltaText: string | null
  deltaClass: string
}

/** 汇总数值变化 chip：变多为红（恶化），变少为绿（好转） */
function buildChips(cur: SlowSqlWindowSummary, base: SlowSqlWindowSummary): CompareChip[] {
  const defs: { label: string; curVal: number | null; baseVal: number | null; fmt: (v: number) => string }[] = [
    { label: '慢SQL指纹数', curVal: cur.digestCount, baseVal: base.digestCount, fmt: fmtCount },
    { label: '总执行次数', curVal: cur.totalExecCount, baseVal: base.totalExecCount, fmt: fmtCount },
    { label: '平均耗时', curVal: cur.avgTimeMs, baseVal: base.avgTimeMs, fmt: fmtMs }
  ]
  return defs.map(d => {
    const current = d.curVal == null ? '-' : d.fmt(d.curVal)
    if (d.curVal == null || d.baseVal == null || d.baseVal <= 0) {
      return { label: d.label, current, deltaText: null, deltaClass: '' }
    }
    const pct = ((d.curVal - d.baseVal) / d.baseVal) * 100
    if (Math.abs(pct) < 0.05) {
      return { label: d.label, current, deltaText: '持平', deltaClass: 'chip-delta--flat' }
    }
    return {
      label: d.label,
      current,
      deltaText: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`,
      deltaClass: pct > 0 ? 'chip-delta--worse' : 'chip-delta--better'
    }
  })
}

const compareSummaryRows = computed(() => {
  const c = compare.value
  if (!c) return []
  return [
    { label: '较昨日同时段', chips: buildChips(c.current, c.yesterday) },
    { label: '较上周同时段', chips: buildChips(c.current, c.lastWeek) }
  ]
})

async function loadCompare() {
  if (!inst.value) return
  compareLoading.value = true
  try {
    const { from, to } = windowRange()
    compare.value = await getSlowSqlWindowCompare({ instanceId: inst.value.id, from, to })
  } catch {
    compare.value = null
  } finally {
    compareLoading.value = false
  }
}

// ── 指纹聚类 ─────────────────────────────────────────────────────────────
const clusterLoading = ref(false)
const clusters = ref<SlowSqlClusterVo[]>([])
const clusterTotal = ref(0)
const clusterPageNum = ref(1)
const clusterPageSize = ref(20)

const clusterColumns: TableColumn[] = [
  { prop: 'statementType', label: '类型', width: 88, align: 'center', slot: 'col-cluster-type' },
  { prop: 'tables', label: '涉及表', minWidth: 160, slot: 'col-cluster-tables' },
  { prop: 'digestCount', label: '指纹数', width: 80, align: 'right', formatter: r => fmtCount(r.digestCount) },
  { prop: 'sampleCount', label: '执行次数', width: 96, align: 'right', formatter: r => fmtCount(r.sampleCount) },
  { prop: 'totalTimeMs', label: '总耗时', width: 100, align: 'right', formatter: r => fmtMs(r.totalTimeMs) },
  { prop: 'avgTimeMs', label: '平均耗时', width: 100, align: 'right', slot: 'col-cluster-avg' },
  { prop: 'maxTimeMs', label: '最慢单次', width: 100, align: 'right', formatter: r => fmtMs(r.maxTimeMs) },
  { prop: 'sampleSql', label: '代表SQL', minWidth: 260, slot: 'col-cluster-sql' }
]

async function loadClusters() {
  if (!inst.value) return
  clusterLoading.value = true
  try {
    const { from, to } = windowRange()
    const res = await getSlowSqlClusters({
      instanceId: inst.value.id,
      from,
      to,
      pageNum: clusterPageNum.value,
      pageSize: clusterPageSize.value
    })
    clusters.value = res.list ?? []
    clusterTotal.value = res.total ?? 0
  } catch {
    clusters.value = []
    clusterTotal.value = 0
  } finally {
    clusterLoading.value = false
  }
}

const fpDetailVisible = ref(false)
const fpDetailRow = ref<SlowSqlDigestVo | null>(null)
const listDetailVisible = ref(false)
const listDetailRow = ref<SlowSqlDigestVo | null>(null)
const listDetailRealSql = ref<string | null>(null)
/** 聚合统计缺失，详情展示的是样本单次执行数据（弹窗内提示口径差异） */
const listDetailSampleOnly = ref(false)

function windowRange() {
  const now = Date.now()
  return { from: now - WINDOW_MS, to: now }
}

// ── 统计卡片（对齐原型：慢SQL总数/平均执行时间/最慢SQL/总执行次数/无索引查询/使用临时表） ──
const statCards = computed(() => {
  const s = stats.value
  const common = [
    { label: 'Top SQL 指纹数', value: s ? fmtCount(s.digestCount) : '-', tone: 'primary', valueTone: 'none', sub: '统计窗口内指纹数' },
    { label: '平均执行时间', value: s ? fmtMs(s.avgTimeMs) : '-', tone: 'success', valueTone: 'none', sub: '全部 Top SQL 平均' },
    { label: '最慢 SQL', value: s ? fmtMs(s.maxAvgTimeMs) : '-', tone: 'danger', valueTone: s && s.maxAvgTimeMs >= 5000 ? 'danger' : 'none', sub: '单条指纹峰值' },
    { label: '总执行次数', value: s ? fmtCount(s.totalExecCount) : '-', tone: 'primary', valueTone: 'none', sub: '窗口内累计执行' }
  ]
  if (dbKind.value === 'sqlserver') return common
  return [
    ...common,
    { label: '无索引查询', value: s ? fmtCount(s.noIndexDigestCount) : '-', tone: 'warning', valueTone: s && s.noIndexDigestCount > 0 ? 'warning' : 'none', sub: '建议补充索引' },
    { label: '使用临时表', value: s ? fmtCount(s.tmpTableDigestCount) : '-', tone: 'warning', valueTone: s && s.tmpTableDigestCount > 0 ? 'warning' : 'none', sub: '关注排序与分组' }
  ]
})

// ── 关联告警计数（digest 精确匹配或活跃期与指纹出现期交叠） ─────────────
function alertCountFor(rowInput: unknown): number {
  const row = rowInput as SlowSqlDigestVo
  const now = Date.now()
  return alerts.value.filter(a =>
    a.dimensionKey === row.digest ||
    (a.triggerTime <= row.lastSeen && (a.recoveryTime ?? now) >= row.firstSeen)
  ).length
}

// ── 表名提取（从归一化 SQL 的 FROM/INTO/UPDATE 子句解析首个表名） ────────
function extractTableName(digestText: string | null): string {
  if (!digestText) return '-'
  const m = /(?:FROM|INTO|UPDATE|JOIN)\s+(?:`?(\w+)`?\s*\.\s*)?`?(\w+)`?/i.exec(digestText)
  return m ? m[2] : '-'
}

function sqlTypeTag(t: string) {
  switch (t) {
    case 'SELECT': return 'primary'
    case 'INSERT': return 'success'
    case 'UPDATE': return 'warning'
    case 'DELETE': return 'danger'
    default: return 'info'
  }
}

function avgTimeClass(ms: number) {
  if (ms >= 5000) return 'text-danger'
  if (ms >= 1000) return 'text-warning'
  return ''
}

// ── 交互 ─────────────────────────────────────────────────────────────────
function onSearch() {
  fpPageNum.value = 1
  listPageNum.value = 1
  loadFpPage()
  loadListPage()
}

function onReset() {
  filters.sqlType = ''
  filters.minAvgMs = undefined
  filters.maxAvgMs = undefined
  onSearch()
}

/** el-table 排序字段 → 后端 sortField 白名单映射 */
const SORT_FIELD_MAP: Record<string, string> = {
  execCount: 'execCount',
  totalTimeMs: 'totalTimerWait',
  avgTimeMs: 'avgTimerWaitUs',
  rowsExamined: 'rowsExamined',
  sortRows: 'sortRows',
  lastSeen: 'lastSeen'
}

function onFpSortChange({ prop, order }: { prop: string | null; order: string | null }) {
  if (!order || !prop || !SORT_FIELD_MAP[prop]) {
    fpSortField.value = 'execCount'
    fpSortAsc.value = false
  } else {
    fpSortField.value = SORT_FIELD_MAP[prop]
    fpSortAsc.value = order === 'ascending'
  }
  fpPageNum.value = 1
  loadFpPage()
}

/** 样本表排序字段 → 后端 sortField 白名单映射 */
const SAMPLE_SORT_FIELD_MAP: Record<string, string> = {
  execTimeMs: 'execTimeUs',
  rowsExamined: 'rowsExamined',
  sortRows: 'sortRows',
  collectTime: 'collectTime'
}

function onListSortChange({ prop, order }: { prop: string | null; order: string | null }) {
  if (!order || !prop || !SAMPLE_SORT_FIELD_MAP[prop]) {
    listSortField.value = 'execTimeUs'
    listSortAsc.value = false
  } else {
    listSortField.value = SAMPLE_SORT_FIELD_MAP[prop]
    listSortAsc.value = order === 'ascending'
  }
  listPageNum.value = 1
  loadListPage()
}

function openFpDetail(row: unknown) {
  fpDetailRow.value = row as SlowSqlDigestVo
  fpDetailVisible.value = true
}

/** 样本行 → 单次执行统计（聚合缺失时的降级数据源：样本表自身字段） */
function sampleToDigestVo(row: SlowSqlSampleVo): SlowSqlDigestVo {
  return {
    schemaName: row.schemaName,
    digest: row.digest ?? '',
    digestText: row.sqlText,
    sqlType: row.sqlType,
    execCount: 1,
    totalTimeMs: row.execTimeMs,
    avgTimeMs: row.execTimeMs,
    maxAvgTimeMs: row.execTimeMs,
    rowsExamined: row.rowsExamined,
    rowsSent: row.rowsSent,
    scanRatio: row.rowsSent > 0 ? Math.round(row.rowsExamined / row.rowsSent) : null,
    lockTimeMs: row.lockTimeMs,
    sortRows: row.sortRows,
    noIndexUsed: row.noIndexUsed ? 1 : 0,
    tmpTables: row.tmpTables,
    tmpDiskTables: row.tmpDiskTables,
    optimizeStatus: 'unoptimized',
    firstSeen: row.collectTime,
    lastSeen: row.collectTime
  }
}

/** 样本行详情：优先按指纹取窗口聚合详情；聚合缺失（小时级采集滞后 /
 *  语句不在 Top 100 内 / 样本无指纹）时降级为样本自身的单次执行统计。 */
async function openListDetail(rowInput: unknown) {
  const row = rowInput as SlowSqlSampleVo
  if (!inst.value) return
  let detail: SlowSqlDigestVo | null = null
  if (row.digest) {
    const { from, to } = windowRange()
    try {
      detail = await getSlowSqlDigestDetail({
        instanceId: inst.value.id,
        schemaName: row.schemaName,
        digest: row.digest,
        from,
        to
      })
    } catch {
      detail = null
    }
  }
  listDetailSampleOnly.value = !detail
  listDetailRow.value = detail ?? sampleToDigestVo(row)
  listDetailRealSql.value = row.sqlText
  listDetailVisible.value = true
}

/** 指纹详情中标记优化状态后，同步指纹表中同一指纹行 */
function onOptimizeStatusChanged(digest: string, schemaName: string | null, status: string) {
  for (const r of fpRows.value) {
    if (r.digest === digest && (r.schemaName ?? null) === schemaName) {
      r.optimizeStatus = status
    }
  }
}

// ── 数据加载 ─────────────────────────────────────────────────────────────
function buildDigestQuery(pageNumVal: number, pageSizeVal: number, sortFieldVal: string, ascVal: boolean) {
  const { from, to } = windowRange()
  return {
    instanceId: inst.value!.id,
    from,
    to,
    sqlType: filters.sqlType || undefined,
    minAvgMs: filters.minAvgMs || undefined,
    maxAvgMs: filters.maxAvgMs || undefined,
    sortField: sortFieldVal,
    asc: ascVal,
    pageNum: pageNumVal,
    pageSize: pageSizeVal
  }
}

async function loadFpPage() {
  if (!inst.value) return
  fpLoading.value = true
  try {
    const res = await pageSlowSqlDigest(
      buildDigestQuery(fpPageNum.value, fpPageSize.value, fpSortField.value, fpSortAsc.value))
    fpRows.value = res.list ?? []
    fpTotal.value = res.total ?? 0
  } finally {
    fpLoading.value = false
  }
}

function buildSampleQuery(pageNumVal: number, pageSizeVal: number) {
  const { from, to } = windowRange()
  return {
    instanceId: inst.value!.id,
    from,
    to,
    sqlType: filters.sqlType || undefined,
    minExecMs: filters.minAvgMs || undefined,
    maxExecMs: filters.maxAvgMs || undefined,
    sortField: listSortField.value,
    asc: listSortAsc.value,
    pageNum: pageNumVal,
    pageSize: pageSizeVal
  }
}

async function loadListPage() {
  if (!inst.value) return
  listLoading.value = true
  try {
    const res = await pageSlowSqlSamples(buildSampleQuery(listPageNum.value, listPageSize.value))
    listRows.value = res.list ?? []
    listTotal.value = res.total ?? 0
  } finally {
    listLoading.value = false
  }
}

async function loadStats() {
  if (!inst.value) return
  statsLoading.value = true
  try {
    const { from, to } = windowRange()
    stats.value = await getSlowSqlStats({ instanceId: inst.value.id, from, to })
  } finally {
    statsLoading.value = false
  }
}

async function loadSqlServerSourceState() {
  if (!inst.value || dbKind.value !== 'sqlserver') {
    sqlServerCollectState.value = null
    return
  }
  try {
    const res = await getMetricTextLatest(inst.value.id, ['sqlserver.query_store.collect_state'], '1h')
    sqlServerCollectState.value = res.values?.['sqlserver.query_store.collect_state'] ?? null
  } catch {
    sqlServerCollectState.value = null
  }
}

async function loadAlerts() {
  if (!inst.value) return
  const { from, to } = windowRange()
  try {
    alerts.value = await listSlowSqlAlerts({ instanceId: inst.value.id, from, to })
  } catch {
    alerts.value = []
  }
}

function reloadAll() {
  fpPageNum.value = 1
  listPageNum.value = 1
  clusterPageNum.value = 1
  loadFpPage()
  loadListPage()
  loadStats()
  loadSqlServerSourceState()
  loadAlerts()
  loadCompare()
  loadClusters()
}

// ── CSV 导出（慢SQL列表当前筛选与排序下，最多前 100 条） ────────────────
async function exportCsv() {
  if (!inst.value) return
  const res = await pageSlowSqlSamples(buildSampleQuery(1, 100))
  const list = res.list ?? []
  const header = ['SQL类型', 'SQL语句', '所属库', '表名', '执行用户', '来源主机', '执行时间(ms)',
    '锁等待(ms)', '扫描行数', '返回行数', '无索引', '临时表', '排序行数', '时间']
  const csvRows = list.map(r => [
    r.sqlType,
    `"${(r.sqlText || '').replace(/"/g, '""')}"`,
    r.schemaName || '',
    extractTableName(r.sqlText),
    r.connUser || '',
    r.connHost || '',
    r.execTimeMs,
    r.lockTimeMs,
    r.rowsExamined,
    r.rowsSent,
    r.noIndexUsed ? '是' : '否',
    r.tmpTables > 0 ? '是' : '否',
    r.sortRows,
    fmtFullTime(r.collectTime)
  ])
  const csv = '\uFEFF' + [header, ...csvRows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  a.href = url
  a.download = `慢SQL分析_${inst.value.name}_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function fmtFullTime(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

watch(() => inst.value?.id, (id) => {
  if (id) reloadAll()
}, { immediate: true })
</script>

<style scoped>
.slowsql-page {
  display: flex;
  flex-direction: column;
  gap: var(--density-gap, 16px);
  min-height: 400px;
}
.page-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-base);
  padding: 12px 16px;
}
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.window-tag {
  cursor: default;
  font-size: 13px;
}
.threshold-hint {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: var(--density-gap, 16px);
}
@media (max-width: 1400px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
.filter-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.filter-label {
  font-size: 13px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
}
.filter-sep {
  color: var(--el-text-color-secondary);
}
.filter-unit {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.type-select {
  width: 130px;
}
.time-input {
  width: 100px;
}
.table-card :deep(.el-card__header) {
  padding: 10px 16px;
}
.table-card :deep(.el-card__body) {
  padding: 12px 16px 16px;
}
.card-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.card-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.sql-cell {
  font-family: Consolas, monospace;
  font-size: 12px;
}
.text-danger {
  color: var(--el-color-danger);
  font-weight: 600;
}
.text-warning {
  color: var(--el-color-warning);
  font-weight: 600;
}

.clickable-tag {
  cursor: pointer;
}

/* ── 分析页签 ── */
.analysis-card :deep(.el-card__body) {
  padding: 4px 16px 16px;
}
.analysis-card :deep(.el-tabs__header) {
  margin-bottom: 12px;
}
.pane-filter {
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-base, 6px);
  background: var(--el-fill-color-lighter);
}
.pane-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 12px;
}

/* ── 指纹聚类 ── */
.cluster-table-tag {
  margin-right: 4px;
  margin-bottom: 2px;
}

/* ── 时段对比 ── */
.compare-summary {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
}
.compare-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.compare-row-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  min-width: 100px;
}
.compare-chips {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.compare-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-base, 6px);
  background: var(--el-fill-color-blank);
  font-size: 12px;
}
.chip-label {
  color: var(--el-text-color-secondary);
}
.chip-value {
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.chip-delta {
  font-weight: 600;
}
.chip-delta--worse {
  color: var(--el-color-danger);
}
.chip-delta--better {
  color: var(--el-color-success);
}
.chip-delta--flat,
.chip-delta--none {
  color: var(--el-text-color-secondary);
  font-weight: 400;
}
</style>
