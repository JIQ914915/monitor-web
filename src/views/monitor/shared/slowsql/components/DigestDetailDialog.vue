<template>
  <el-dialog
    :model-value="visible"
    title="慢SQL详情"
    width="1080px"
    top="4vh"
    @update:model-value="emit('update:visible', $event)"
  >
    <template v-if="row">
      <el-alert
        v-if="sampleOnly"
        type="info"
        show-icon
        :closable="false"
        title="该语句暂无窗口聚合统计（小时级聚合尚未覆盖本次执行，或该语句累计耗时未进入实例 Top 100），以下展示本次执行的实际数据"
        class="sample-only-alert"
      />
      <el-tabs v-model="activeTab">
        <!-- ── Tab 1：SQL信息 ─────────────────────────────────────────── -->
        <el-tab-pane label="SQL信息" name="info">
          <template v-if="realSql">
            <div class="section-title">本次执行 SQL（真实语句，含参数）</div>
            <SqlBlock :sql="realSql" copy-tip="真实 SQL 已复制到剪贴板" />
          </template>

          <!-- 兜底：无真实 SQL 时才展示归一化文本，避免与真实语句重复 -->
          <template v-else-if="row.digestText">
            <div class="section-title">SQL 语句（归一化，参数以 ? 占位）</div>
            <SqlBlock :sql="row.digestText" />
          </template>

          <div class="section-title">{{ sampleOnly ? '执行统计（本次执行）' : '执行统计（最近 24 小时）' }}</div>
          <el-descriptions :column="3" border size="small" class="detail-desc">
            <el-descriptions-item label="所属库">{{ row.schemaName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="SQL类型">
              <el-tag :type="sqlTypeTag(row.sqlType)" size="small">{{ row.sqlType }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="SQL指纹">
              <span class="digest-text">{{ row.digest }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="执行次数">{{ fmtCount(row.execCount) }}</el-descriptions-item>
            <el-descriptions-item label="总耗时">{{ fmtMs(row.totalTimeMs) }}</el-descriptions-item>
            <el-descriptions-item label="平均耗时">
              <span :class="avgTimeClass(row.avgTimeMs)">{{ fmtMs(row.avgTimeMs) }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="最慢周期平均耗时">{{ fmtMs(row.maxAvgTimeMs) }}</el-descriptions-item>
            <el-descriptions-item label="扫描行数">{{ fmtCount(row.rowsExamined) }}</el-descriptions-item>
            <el-descriptions-item label="返回行数">{{ fmtCount(row.rowsSent) }}</el-descriptions-item>
            <el-descriptions-item label="扫描/返回比">
              <span :class="{ 'text-danger': (row.scanRatio ?? 0) >= 100 }">
                {{ row.scanRatio == null ? '-' : fmtCount(row.scanRatio) }}
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="锁等待">{{ fmtMs(row.lockTimeMs) }}</el-descriptions-item>
            <el-descriptions-item label="排序行数">{{ fmtCount(row.sortRows) }}</el-descriptions-item>
            <el-descriptions-item label="无索引执行">
              <el-tag v-if="row.noIndexUsed > 0" type="danger" size="small">{{ fmtCount(row.noIndexUsed) }} 次</el-tag>
              <span v-else>无</span>
            </el-descriptions-item>
            <el-descriptions-item label="临时表">
              <el-tag v-if="row.tmpTables > 0" :type="row.tmpDiskTables > 0 ? 'danger' : 'warning'" size="small">
                {{ fmtCount(row.tmpTables) }} 个{{ row.tmpDiskTables > 0 ? `（磁盘 ${fmtCount(row.tmpDiskTables)}）` : '' }}
              </el-tag>
              <span v-else>无</span>
            </el-descriptions-item>
            <el-descriptions-item label="首次出现">{{ fmtTime(row.firstSeen) }}</el-descriptions-item>
            <el-descriptions-item label="最后出现">{{ fmtTime(row.lastSeen) }}</el-descriptions-item>
          </el-descriptions>
          <div class="desc-hint">扫描/返回比越大，说明每返回一行需要扫描的行越多，索引效率越差（≥100 建议重点排查）</div>
        </el-tab-pane>

        <!-- ── Tab 2：执行计划（真实 EXPLAIN + 指标诊断） ─────────────── -->
        <el-tab-pane label="执行计划" name="explain">
          <!-- 真实执行计划：连目标库 EXPLAIN 本次真实 SQL -->
          <template v-if="realSql">
            <div class="section-title explain-head">
              <span>执行计划（目标库实时 EXPLAIN）</span>
              <el-button size="small" :loading="explainLoading" @click="loadExplain">
                {{ explainResult ? '重新获取' : '获取执行计划' }}
              </el-button>
            </div>
            <el-alert
              v-if="sqlTruncated"
              type="warning"
              show-icon
              :closable="false"
              title="该 SQL 采集时已被目标库截断（受 performance_schema_max_sql_text_length 限制，默认 1024 字符），语句不完整无法生成执行计划；可在目标库调大该参数后重启以采集完整语句"
              class="explain-alert"
            />
            <el-alert
              v-else-if="explainError"
              type="error"
              show-icon
              :closable="false"
              :title="explainError"
              class="explain-alert"
            />
            <el-table
              v-if="explainResult && explainResult.rows.length"
              :data="explainTableRows"
              stripe
              size="small"
              max-height="260"
              class="explain-table"
            >
              <el-table-column
                v-for="col in explainResult.columns"
                :key="col"
                :prop="col"
                :label="col"
                :min-width="explainColWidth(col)"
                show-overflow-tooltip
              />
            </el-table>
            <div v-else-if="!explainLoading && !explainError && !sqlTruncated && !explainResult" class="explain-hint">
              点击「获取执行计划」，系统将使用采集账号连接目标库执行 EXPLAIN（只做优化器分析，不会真正执行该语句）
            </div>
          </template>
          <el-alert
            v-else
            type="info"
            show-icon
            :closable="false"
            title="缺少真实 SQL 文本（参数化指纹无法直接 EXPLAIN），可复制归一化语句并代入实际参数后在目标库执行 EXPLAIN"
            class="explain-alert"
          />

          <div class="section-title">{{ sampleOnly ? '问题诊断（基于本次执行指标）' : '问题诊断（基于最近 24 小时采集指标）' }}</div>
          <el-timeline v-if="diagnosis.length" class="diag-timeline">
            <el-timeline-item
              v-for="(d, i) in diagnosis"
              :key="i"
              :type="d.level === 'danger' ? 'danger' : d.level === 'warning' ? 'warning' : 'success'"
            >
              <div class="diag-title" :class="`diag-${d.level}`">{{ d.title }}</div>
              <div class="diag-desc">{{ d.desc }}</div>
            </el-timeline-item>
          </el-timeline>
          <el-button :icon="CopyDocument" @click="copyExplainSql">复制 EXPLAIN 语句</el-button>
        </el-tab-pane>

        <!-- ── Tab 3：优化建议 ────────────────────────────────────────── -->
        <el-tab-pane label="优化建议" name="optimization">
          <el-alert
            type="warning"
            show-icon
            :closable="false"
            title="以下建议由诊断规则自动生成，仅供参考；请在充分评估并经人工确认后，通过变更流程在目标库执行。"
            class="explain-alert"
          />
          <el-empty v-if="!suggestions.length" description="未发现明显问题，暂无优化建议" :image-size="60" />
          <div v-for="(s, i) in suggestions" :key="i" class="suggest-card">
            <div class="suggest-head">
              <el-tag :type="s.priority === '高' ? 'danger' : s.priority === '中' ? 'warning' : 'info'" size="small">
                优先级：{{ s.priority }}
              </el-tag>
              <span class="suggest-problem">{{ s.problem }}</span>
            </div>
            <div class="suggest-body">{{ s.advice }}</div>
            <div v-if="s.expect" class="suggest-expect">预期效果：{{ s.expect }}</div>
          </div>

          <!-- AI 智能分析（LLM，可选增强） -->
          <div class="section-title ai-head">
            <span>AI 智能分析</span>
            <el-button
              size="small"
              type="primary"
              plain
              :icon="MagicStick"
              :loading="aiLoading"
              @click="runAiAnalysis"
            >
              {{ aiResult ? '重新分析' : 'AI 分析本条 SQL' }}
            </el-button>
          </div>
          <el-alert
            v-if="aiError"
            type="error"
            show-icon
            :closable="false"
            :title="aiError"
            class="explain-alert"
          />
          <template v-if="aiResult && aiResult.success">
            <div class="ai-card">
              <div class="ai-summary">{{ aiResult.summary }}</div>
              <template v-if="aiResult.causes?.length">
                <div class="ai-sub-title">慢因分析</div>
                <ol class="ai-list">
                  <li v-for="(c, i) in aiResult.causes" :key="i">{{ c }}</li>
                </ol>
              </template>
              <template v-if="aiResult.suggestions?.length">
                <div class="ai-sub-title">优化建议</div>
                <ol class="ai-list">
                  <li v-for="(s, i) in aiResult.suggestions" :key="i">{{ s }}</li>
                </ol>
              </template>
              <div class="ai-meta">
                AI 生成（{{ aiResult.model }}，{{ aiResult.durationMs != null ? Math.round(aiResult.durationMs / 100) / 10 : '-' }}s），
                仅供参考；索引与改写变更须评估锁表影响并经人工确认后在低峰窗口执行
              </div>
            </div>
          </template>
          <div v-else-if="!aiLoading && !aiError" class="explain-hint">
            点击「AI 分析本条 SQL」，系统将把指纹统计与脱敏后的语句发送给已配置的大模型，
            生成慢因分析与优化建议（须先在「系统设置 → 智能分析设置」启用）
          </div>
        </el-tab-pane>

        <!-- ── Tab 4：历史对比 ────────────────────────────────────────── -->
        <el-tab-pane label="历史对比" name="history">
          <div v-loading="trendLoading">
            <!-- 7 天汇总统计 -->
            <div class="hist-stats">
              <div v-for="st in histStats" :key="st.label" class="hist-stat">
                <div class="hist-value">{{ st.value }}</div>
                <div class="hist-label">{{ st.label }}</div>
              </div>
            </div>

            <!-- 趋势图 -->
            <div class="section-title">执行趋势（最近 7 天，小时级采集周期）</div>
            <el-empty v-if="!trendLoading && !trendPoints.length" description="最近 7 天暂无采集数据" :image-size="60" />
            <div v-show="trendPoints.length" ref="chartRef" class="trend-chart" />

            <!-- 周期明细表 -->
            <template v-if="trendPoints.length">
              <div class="section-title hist-table-head">
                <span>采集周期明细（最近 {{ Math.min(trendPoints.length, 50) }} 条）</span>
                <el-button size="small" :icon="Download" @click="exportHistoryCsv">导出 CSV</el-button>
              </div>
              <el-table :data="historyRows" stripe size="small" max-height="260">
                <el-table-column label="采集时间" width="150">
                  <template #default="{ row: r }">{{ fmtTime(r.ts) }}</template>
                </el-table-column>
                <el-table-column label="执行次数" align="right">
                  <template #default="{ row: r }">{{ fmtCount(r.execCount) }}</template>
                </el-table-column>
                <el-table-column label="平均耗时" align="right">
                  <template #default="{ row: r }">
                    <span :class="avgTimeClass(r.avgTimeMs)">{{ fmtMs(r.avgTimeMs) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="扫描行数" align="right">
                  <template #default="{ row: r }">{{ fmtCount(r.rowsExamined) }}</template>
                </el-table-column>
                <el-table-column label="较 7 天均值" align="right">
                  <template #default="{ row: r }">
                    <span :class="r.avgTimeMs > histAvgMs * 1.5 ? 'text-danger' : r.avgTimeMs > histAvgMs * 1.2 ? 'text-warning' : ''">
                      {{ histAvgMs > 0 ? `${r.avgTimeMs >= histAvgMs ? '+' : ''}${Math.round((r.avgTimeMs - histAvgMs) / histAvgMs * 100)}%` : '-' }}
                    </span>
                  </template>
                </el-table-column>
              </el-table>
            </template>
          </div>
        </el-tab-pane>
      </el-tabs>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { CopyDocument, Download, MagicStick } from '@element-plus/icons-vue'
import SqlBlock from '@/components/SqlBlock.vue'
import { fmtCount, fmtMs, fmtYmdHm as fmtTime, pct } from '@/utils/format'
import * as echarts from 'echarts/core'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useECharts } from '@/composables/useECharts'
import { getSlowSqlDigestTrend, explainSlowSql } from '@/api/slowsql'
import { analyzeSlowSqlLlm, type LlmAnalysisVo } from '@/api/llm'
import type { SlowSqlDigestVo, SlowSqlDigestTrendVo, SlowSqlExplainVo } from '@/types/monitor'

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const props = defineProps<{
  visible: boolean
  instanceId: number | null
  row: SlowSqlDigestVo | null
  /** 从样本行进入时透传本次真实执行 SQL（含参数），展示在归一化 SQL 之上 */
  realSql?: string | null
  /** 窗口聚合缺失，row 为样本单次执行数据（小时级聚合滞后或语句不在 Top 100 内） */
  sampleOnly?: boolean
}>()

const emit = defineEmits<{ (e: 'update:visible', v: boolean): void }>()

const activeTab = ref('info')
const trendLoading = ref(false)
const trendPoints = ref<SlowSqlDigestTrendVo['points']>([])
const chartRef = ref<HTMLDivElement>()

// ── 真实执行计划（目标库实时 EXPLAIN） ──────────────────────────────────
const explainLoading = ref(false)
const explainResult = ref<SlowSqlExplainVo | null>(null)
const explainError = ref<string | null>(null)

/** SQL 在采集时被目标库截断（performance_schema 以 ... 结尾标记），无法 EXPLAIN */
const sqlTruncated = computed(() => (props.realSql ?? '').trimEnd().endsWith('...'))

/** EXPLAIN 结果行 → el-table 行对象（按列名映射） */
const explainTableRows = computed(() => {
  const res = explainResult.value
  if (!res) return []
  return res.rows.map(r => {
    const obj: Record<string, string> = {}
    res.columns.forEach((c, i) => { obj[c] = r[i] ?? 'NULL' })
    return obj
  })
})

function explainColWidth(col: string): number {
  const wide = ['table', 'possible_keys', 'key', 'ref', 'Extra']
  return wide.includes(col) ? 150 : 90
}

async function loadExplain() {
  if (!props.instanceId || !props.realSql || sqlTruncated.value) return
  explainLoading.value = true
  explainError.value = null
  try {
    explainResult.value = await explainSlowSql({
      instanceId: props.instanceId,
      schemaName: props.row?.schemaName ?? null,
      sql: props.realSql
    })
  } catch (e) {
    explainResult.value = null
    explainError.value = e instanceof Error && e.message
      ? e.message
      : '执行计划获取失败，请检查目标库连通性与采集账号权限'
  } finally {
    explainLoading.value = false
  }
}

// ── AI 智能分析（LLM，可选增强） ─────────────────────────────────────────
const aiLoading = ref(false)
const aiResult = ref<LlmAnalysisVo | null>(null)
const aiError = ref<string | null>(null)

async function runAiAnalysis() {
  if (!props.instanceId || !props.row?.digest) return
  aiLoading.value = true
  aiError.value = null
  try {
    const res = await analyzeSlowSqlLlm({
      instanceId: props.instanceId,
      digest: props.row.digest,
      schemaName: props.row.schemaName ?? null,
      sqlText: props.realSql ?? null
    })
    if (res && res.success === false) {
      aiResult.value = null
      aiError.value = res.errorMessage || 'AI 分析失败，请稍后重试'
    } else {
      aiResult.value = res
    }
  } catch (e) {
    aiResult.value = null
    aiError.value = e instanceof Error && e.message ? e.message : 'AI 分析失败，请检查智能分析设置'
  } finally {
    aiLoading.value = false
  }
}

// ── 问题诊断（基于窗口聚合指标的规则判断） ───────────────────────────────
interface DiagItem { level: 'danger' | 'warning' | 'success'; title: string; desc: string }

const diagnosis = computed<DiagItem[]>(() => {
  const r = props.row
  if (!r) return []
  const items: DiagItem[] = []
  if (r.noIndexUsed > 0) {
    items.push({
      level: 'danger',
      title: '存在未使用索引的执行',
      desc: `窗口内 ${fmtCount(r.noIndexUsed)} 次执行未使用索引（可能全表扫描），占执行次数的 ${pct(r.noIndexUsed, r.execCount)}`
    })
  }
  if ((r.scanRatio ?? 0) >= 100) {
    items.push({
      level: 'danger',
      title: '扫描/返回比过高',
      desc: `每返回 1 行平均需扫描 ${fmtCount(r.scanRatio!)} 行，WHERE 条件的过滤大部分发生在存储引擎扫描之后，索引选择性不足`
    })
  } else if ((r.scanRatio ?? 0) >= 10) {
    items.push({
      level: 'warning',
      title: '扫描/返回比偏高',
      desc: `每返回 1 行平均需扫描 ${fmtCount(r.scanRatio!)} 行，存在一定的无效扫描`
    })
  }
  if (r.tmpDiskTables > 0) {
    items.push({
      level: 'danger',
      title: '产生磁盘临时表',
      desc: `窗口内创建 ${fmtCount(r.tmpDiskTables)} 个磁盘临时表，中间结果集超出内存临时表上限（tmp_table_size），磁盘 IO 拖慢执行`
    })
  } else if (r.tmpTables > 0) {
    items.push({
      level: 'warning',
      title: '使用内存临时表',
      desc: `窗口内创建 ${fmtCount(r.tmpTables)} 个内存临时表，通常由 GROUP BY / DISTINCT / UNION 引起`
    })
  }
  if (r.sortRows > 0) {
    items.push({
      level: r.sortRows >= 100000 ? 'danger' : 'warning',
      title: '存在排序（可能 filesort）',
      desc: `窗口内排序 ${fmtCount(r.sortRows)} 行，ORDER BY / GROUP BY 未能利用索引有序性`
    })
  }
  if (r.totalTimeMs > 0 && r.lockTimeMs / r.totalTimeMs >= 0.2) {
    items.push({
      level: 'warning',
      title: '锁等待占比偏高',
      desc: `锁等待 ${fmtMs(r.lockTimeMs)}，占总耗时的 ${pct(r.lockTimeMs, r.totalTimeMs)}，存在并发争用`
    })
  }
  if (!items.length) {
    items.push({
      level: 'success',
      title: '未发现明显问题',
      desc: '窗口内未检测到无索引执行、临时表、大量排序或锁等待，如平均耗时仍偏高，建议复制 SQL 在目标库 EXPLAIN 分析'
    })
  }
  return items
})

// ── 优化建议（由诊断规则生成） ───────────────────────────────────────────
interface SuggestItem { priority: '高' | '中' | '低'; problem: string; advice: string; expect?: string }

const suggestions = computed<SuggestItem[]>(() => {
  const r = props.row
  if (!r) return []
  const items: SuggestItem[] = []
  const text = (r.digestText || '').toUpperCase()

  if (r.noIndexUsed > 0 || (r.scanRatio ?? 0) >= 100) {
    items.push({
      priority: '高',
      problem: '缺少合适索引，存在全表扫描或大量无效扫描',
      advice: '结合 WHERE / JOIN 条件中的等值列与范围列，为高频过滤条件创建复合索引（等值列在前、范围列在后）；创建前用 EXPLAIN 验证索引是否被选中',
      expect: '扫描行数与执行时间显著下降'
    })
  }
  if (text.startsWith('SELECT *') || text.startsWith('SELECT `*`')) {
    items.push({
      priority: '中',
      problem: 'SELECT * 返回全部列',
      advice: '只查询业务需要的列，减少网络传输与回表；配合覆盖索引可避免回表',
      expect: '减少 IO 与内存占用'
    })
  }
  if (r.tmpDiskTables > 0) {
    items.push({
      priority: '高',
      problem: 'GROUP BY / DISTINCT / UNION 产生磁盘临时表',
      advice: '优先通过索引消除临时表（让 GROUP BY 走索引有序性）；无法消除时评估适当调大 tmp_table_size / max_heap_table_size（需 DBA 确认内存余量）',
      expect: '消除磁盘 IO，执行时间下降'
    })
  }
  if (r.sortRows > 0) {
    items.push({
      priority: '中',
      problem: 'ORDER BY 未利用索引，产生 filesort',
      advice: '为排序列（含 WHERE 等值条件 + 排序列的复合索引）建立索引，使排序直接利用索引有序性；大结果集排序考虑增加 LIMIT 限制',
      expect: '消除 filesort'
    })
  }
  if (text.startsWith('SELECT') && !text.includes('LIMIT') && r.rowsSent / Math.max(1, r.execCount) > 1000) {
    items.push({
      priority: '低',
      problem: '单次返回行数较多且未使用 LIMIT',
      advice: '确认业务是否需要全量结果，列表类查询建议增加 LIMIT 分页',
      expect: '减少网络传输与内存占用'
    })
  }
  if (r.totalTimeMs > 0 && r.lockTimeMs / r.totalTimeMs >= 0.2) {
    items.push({
      priority: '中',
      problem: '锁等待占比高，存在并发争用',
      advice: '排查同表的长事务与热点行更新；缩短事务持锁时间，将大事务拆分为小批次',
      expect: '降低锁等待时间'
    })
  }
  return items
})

// ── 历史对比 ─────────────────────────────────────────────────────────────
const histAvgMs = computed(() => {
  const pts = trendPoints.value
  if (!pts.length) return 0
  const totalExec = pts.reduce((s, p) => s + p.execCount, 0)
  if (totalExec <= 0) return 0
  const totalTime = pts.reduce((s, p) => s + p.avgTimeMs * p.execCount, 0)
  return totalTime / totalExec
})

const histStats = computed(() => {
  const pts = trendPoints.value
  if (!pts.length) return []
  const totalExec = pts.reduce((s, p) => s + p.execCount, 0)
  const maxAvg = Math.max(...pts.map(p => p.avgTimeMs))
  const totalRows = pts.reduce((s, p) => s + p.rowsExamined, 0)
  return [
    { label: '7天执行次数', value: fmtCount(totalExec) },
    { label: '7天平均耗时', value: fmtMs(histAvgMs.value) },
    { label: '最慢周期平均耗时', value: fmtMs(maxAvg) },
    { label: '7天扫描行数', value: fmtCount(totalRows) }
  ]
})

/** 周期明细表（按时间倒序，最多 50 条） */
const historyRows = computed(() => [...trendPoints.value].reverse().slice(0, 50))

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

// ── 复制与导出 ───────────────────────────────────────────────────────────
async function copyText(text: string, tip: string) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(tip)
  } catch {
    ElMessage.warning('复制失败，请手动选择复制')
  }
}

function copyExplainSql() {
  if (props.realSql) {
    copyText(`EXPLAIN ${props.realSql}`, 'EXPLAIN 语句已复制（真实 SQL 含参数），可直接在目标库执行')
  } else if (props.row) {
    copyText(`EXPLAIN ${props.row.digestText || ''}`, 'EXPLAIN 语句已复制，请代入实际参数后在目标库执行')
  }
}

function exportHistoryCsv() {
  if (!props.row) return
  const header = ['采集时间', '执行次数', '平均耗时(ms)', '扫描行数']
  const rows = [...trendPoints.value].reverse().map(p => [
    fmtTime(p.ts), p.execCount, p.avgTimeMs, p.rowsExamined
  ])
  const csv = '\uFEFF' + [header, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `慢SQL历史_${props.row.digest.slice(0, 12)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── 趋势图 ───────────────────────────────────────────────────────────────
function buildOption() {
  const root = document.documentElement
  const isDark = root.classList.contains('dark')
  const textColor = isDark ? '#8A9CB8' : '#9CA3AF'
  const splitLineColor = isDark ? 'rgba(138, 156, 184, 0.20)' : '#F3F4F6'

  return {
    backgroundColor: 'transparent',
    grid: { top: 44, right: 56, bottom: 26, left: 56 },
    legend: {
      top: 0,
      right: 10,
      itemWidth: 14,
      itemHeight: 8,
      textStyle: { color: textColor, fontSize: 11 },
      data: ['执行次数', '平均耗时']
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const items = params as { seriesName: string; value: [number, number]; marker: string }[]
        if (!items.length) return ''
        const lines = [fmtTime(items[0].value[0])]
        for (const it of items) {
          const val = it.seriesName === '平均耗时' ? fmtMs(it.value[1]) : fmtCount(it.value[1])
          lines.push(`${it.marker}${it.seriesName}: <b>${val}</b>`)
        }
        return lines.join('<br/>')
      }
    },
    xAxis: {
      type: 'time',
      axisLabel: { color: textColor, fontSize: 11, hideOverlap: true },
      splitLine: { show: false }
    },
    yAxis: [
      {
        type: 'value',
        name: '次数',
        nameTextStyle: { color: textColor, fontSize: 11 },
        axisLabel: { color: textColor, fontSize: 11, formatter: (v: number) => fmtCount(v) },
        splitLine: { lineStyle: { color: splitLineColor } }
      },
      {
        type: 'value',
        name: '耗时',
        nameTextStyle: { color: textColor, fontSize: 11 },
        position: 'right',
        axisLabel: { color: textColor, fontSize: 11, formatter: (v: number) => fmtMs(v) },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: '执行次数',
        type: 'bar',
        data: trendPoints.value.map(p => [p.ts, p.execCount]),
        itemStyle: { color: '#0C7C97' },
        barMaxWidth: 14
      },
      {
        name: '平均耗时',
        type: 'line',
        yAxisIndex: 1,
        data: trendPoints.value.map(p => [p.ts, p.avgTimeMs]),
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#E08600', width: 2 },
        itemStyle: { color: '#E08600' }
      }
    ]
  }
}

const { update, getInstance } = useECharts(chartRef, buildOption)

async function loadTrend() {
  if (!props.instanceId || !props.row || !props.row.digest) return
  trendLoading.value = true
  try {
    const res = await getSlowSqlDigestTrend({
      instanceId: props.instanceId,
      schemaName: props.row.schemaName,
      digest: props.row.digest
    })
    trendPoints.value = res.points ?? []
    await nextTick()
    update()
  } finally {
    trendLoading.value = false
  }
}

watch(() => props.visible, (v) => {
  if (v && props.row) {
    activeTab.value = 'info'
    trendPoints.value = []
    explainResult.value = null
    explainError.value = null
    aiResult.value = null
    aiError.value = null
    loadTrend()
  }
})

// 切到历史对比 Tab 时容器由隐藏变可见，触发一次 resize 让图表撑满
watch(activeTab, (tab) => {
  if (tab === 'history') {
    nextTick(() => getInstance()?.resize())
  }
})
</script>

<style scoped>
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 14px 0 8px;
}
.section-title:first-child {
  margin-top: 0;
}
.detail-desc :deep(.el-descriptions__label) {
  white-space: nowrap;
}
.digest-text {
  font-family: Consolas, monospace;
  font-size: 12px;
  word-break: break-all;
}
.desc-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 6px;
}
.text-danger {
  color: var(--el-color-danger);
  font-weight: 600;
}
.text-warning {
  color: var(--el-color-warning);
  font-weight: 600;
}
.explain-alert {
  margin-bottom: 12px;
}
.sample-only-alert {
  margin-bottom: 10px;
}
.explain-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  padding: 8px 2px;
}
.ai-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18px;
}
.ai-card {
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  background: var(--el-color-primary-light-9);
}
.ai-summary {
  font-size: 13px;
  color: var(--el-text-color-primary);
  line-height: 1.7;
}
.ai-sub-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 10px 0 4px;
}
.ai-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}
.ai-meta {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-top: 10px;
  border-top: 1px dashed var(--el-border-color-lighter);
  padding-top: 8px;
}
.diag-timeline {
  padding-left: 4px;
  margin-bottom: 12px;
}
.diag-title {
  font-size: 13px;
  font-weight: 600;
}
.diag-danger {
  color: var(--el-color-danger);
}
.diag-warning {
  color: var(--el-color-warning);
}
.diag-success {
  color: var(--el-color-success);
}
.diag-desc {
  font-size: 12px;
  color: var(--el-text-color-regular);
  margin-top: 2px;
}
.suggest-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  margin-bottom: 10px;
  background: var(--el-fill-color-blank);
}
.suggest-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.suggest-problem {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.suggest-body {
  font-size: 13px;
  color: var(--el-text-color-regular);
  margin-top: 8px;
  line-height: 1.6;
}
.suggest-expect {
  font-size: 12px;
  color: var(--el-color-success);
  margin-top: 6px;
}
.hist-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 4px;
}
.hist-stat {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  background: var(--el-fill-color-blank);
}
.hist-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}
.hist-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}
.hist-table-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.trend-chart {
  width: 100%;
  height: 240px;
}
</style>
