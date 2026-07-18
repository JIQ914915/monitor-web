<template>
  <div class="drilldown-page" v-loading="loading">
    <!-- 页头：面包屑 + 操作 -->
    <div class="page-header">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item class="bc-link" @click="goBack">告警管理</el-breadcrumb-item>
        <el-breadcrumb-item>事件分析</el-breadcrumb-item>
      </el-breadcrumb>
      <div class="header-actions">
        <el-button
          v-permission="'report:create'"
          :icon="Document"
          :disabled="!ctx"
          :loading="reportGenerating"
          @click="generateReport"
        >生成诊断报告</el-button>
        <el-button type="primary" @click="goBack">返回列表</el-button>
      </div>
    </div>

    <el-alert
      v-if="!loading && !ctx"
      type="warning"
      title="未找到告警事件，请从告警管理列表点击「下钻」进入"
      :closable="false"
      show-icon
    />

    <template v-if="ctx && ev">
      <!-- ① 触发信息 -->
      <el-card shadow="never" class="section-card">
        <template #header>
          <span class="section-title"><el-icon><Warning /></el-icon> 触发信息</span>
        </template>
        <el-descriptions :column="3" border size="small">
          <el-descriptions-item label="告警规则">{{ ev.ruleName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="告警级别">
            <DictTag dict="alert_level" :value="ev.ruleLevel" effect="dark" />
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <DictTag dict="alert_event_status" :value="ev.status" />
          </el-descriptions-item>
          <el-descriptions-item label="触发实例">{{ ev.instanceName }}</el-descriptions-item>
          <el-descriptions-item label="触发时间">{{ ev.triggerTime }}</el-descriptions-item>
          <el-descriptions-item label="持续时间">{{ fmtDuration(ev.durationSeconds) }}</el-descriptions-item>
          <el-descriptions-item label="当前值">
            <template v-if="isScenario">
              <span class="text-danger">命中 {{ metSignalCount }}/{{ totalSignalCount }} 个信号</span>
            </template>
            <template v-else-if="ev.booleanCondition">
              <el-tag type="danger" size="small" effect="plain">条件命中</el-tag>
            </template>
            <template v-else>
              <span class="text-danger">{{ ev.triggerValue ?? '-' }}{{ unit }}</span>
              <span v-if="thresholdText" class="threshold-hint">阈值：{{ thresholdText }}</span>
            </template>
          </el-descriptions-item>
          <el-descriptions-item label="告警类型">
            <el-tag size="small" type="info">{{ typeLabel }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="触发指标">
            <span v-if="isScenario" class="mono">多信号综合（{{ totalSignalCount }} 个信号）</span>
            <span v-else class="mono">{{ ctx.metricLabel || ctx.metricCode || '-' }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="告警信息" :span="3">{{ ev.alertMessage || '-' }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- ①.5 阻塞链现场（锁相关事件建单时抓取） -->
      <el-card v-if="blockingChain" shadow="never" class="section-card">
        <template #header>
          <div class="section-header">
            <span class="section-title"><el-icon><Connection /></el-icon> 阻塞链现场</span>
            <span class="chain-meta">
              抓取时间：{{ blockingChain.capturedAt || '-' }}
              <el-tag v-if="blockingChain.dbVersion" size="small" type="info" effect="plain">{{ blockingDbTypeLabel }} {{ blockingChain.dbVersion }}</el-tag>
            </span>
          </div>
        </template>
        <el-alert
          v-if="blockingChain.error"
          type="warning"
          :title="blockingChain.error"
          :closable="false"
          show-icon
        />
        <el-alert
          v-else-if="!blockingChainRows.length"
          type="success"
          title="抓取时已无阻塞会话，锁等待可能为瞬时现象且已自行消退"
          :closable="false"
          show-icon
        />
        <template v-else>
          <el-alert
            type="info"
            :closable="false"
            show-icon
            class="chain-alert"
            title="以下为告警建单时刻抓取的锁等待现场（一次性快照，非实时）。如需终止阻塞源会话，请由 DBA 人工确认后执行 KILL，系统不会自动执行"
          />
          <ProTable
            embedded
            :data="blockingChainRows"
            :columns="blockingColumns"
            :show-toolbar="false"
            :show-operation="false"
            :show-pagination="false"
          >
            <template #col-wait="{ row }"><span class="text-danger">{{ row.waitAgeSecs ?? '-' }}s</span></template>
            <template #col-object="{ row }">
              <span class="mono">{{ row.lockedTable || '-' }}</span>
              <el-tag v-if="row.lockedType" size="small" type="warning" effect="plain" class="chain-type-tag">{{ row.lockedType }}</el-tag>
            </template>
            <template #col-depth="{ row }">{{ row.chainDepth }}</template>
            <template #col-root="{ row }"><span class="mono">{{ row.rootBlockingPid ?? '-' }}</span></template>
            <template #col-waiting="{ row }">
              <div class="chain-session">
                <el-tag size="small" type="danger" effect="plain">会话 {{ row.waitingPid ?? '-' }}</el-tag>
                <div class="chain-sql mono" :title="row.waitingQuery || ''">{{ row.waitingQuery || '（无正在执行的 SQL）' }}</div>
              </div>
            </template>
            <template #col-blocking="{ row }">
              <div class="chain-session">
                <el-tag size="small" type="warning" effect="dark">会话 {{ row.blockingPid ?? '-' }}</el-tag>
                <div class="chain-sql mono" :title="row.blockingQuery || ''">{{ row.blockingQuery || '（空闲中，可能是未提交事务）' }}</div>
              </div>
            </template>
          </ProTable>
        </template>
      </el-card>

      <!-- ② 关联指标趋势 -->
      <el-card shadow="never" class="section-card">
        <template #header>
          <div class="section-header">
            <span class="section-title"><el-icon><TrendCharts /></el-icon> 关联指标趋势（告警前后 30 分钟）</span>
            <el-tag type="warning" size="small" effect="plain">红线：告警触发｜绿线：恢复</el-tag>
          </div>
        </template>
        <div v-loading="trendLoading" class="chart-grid">
          <DrilldownChart
            v-for="m in trendMetrics"
            :key="m.code"
            :ref="el => setChartRef(m.code, el)"
            :label="m.label"
            :unit="m.unit"
            :color="m.color"
            :points="trendPoints[m.code] ?? []"
            :error="trendErrors[m.code]"
            :trigger-ts="triggerTs"
            :recovery-ts="recoveryTs"
            :change="trendChange[m.code]"
          />
        </div>
      </el-card>

      <!-- ③ 可能原因分析 -->
      <el-card shadow="never" class="section-card">
        <template #header>
          <div class="section-header">
            <span class="section-title"><el-icon><Search /></el-icon> 可能原因分析</span>
            <el-tag type="info" size="small" effect="plain">基于告警类型画像与指标变化，仅供参考</el-tag>
          </div>
        </template>
        <el-empty v-if="!causes.length" description="暂无匹配的原因画像，可在「系统设置 → 下钻画像」中补充" :image-size="60" />
        <el-timeline v-else class="cause-timeline">
          <el-timeline-item
            v-for="(cause, idx) in causes"
            :key="idx"
            :type="cause.color"
            :size="idx === 0 ? 'large' : 'normal'"
            :timestamp="isScenario ? '诊断结论（多信号联合判断）' : '可信度：' + (cause.confidence * 100).toFixed(0) + '%'"
            placement="top"
          >
            <div class="cause-card" :class="'cause-' + cause.color">
              <div class="cause-title">{{ cause.cause }}</div>
              <ul class="cause-evidence">
                <li v-for="(evd, i) in cause.evidence" :key="i">{{ evd }}</li>
              </ul>
            </div>
          </el-timeline-item>
        </el-timeline>
        <template v-if="isScenario && ev.knowledgeArticles?.length">
          <div class="kb-title">关联知识库</div>
          <div class="kb-links">
            <el-link
              v-for="article in ev.knowledgeArticles"
              :key="article.id"
              type="primary"
              :underline="false"
              class="kb-link"
              @click="goKnowledge(article.id)"
            >
              <el-icon><Collection /></el-icon>
              <span>{{ article.title }}</span>
            </el-link>
          </div>
        </template>
      </el-card>

      <!-- ③.5 智能分析（AI 生成，仅供参考） -->
      <el-card shadow="never" class="section-card">
        <template #header>
          <div class="section-header">
            <span class="section-title"><el-icon><MagicStick /></el-icon> 智能分析</span>
            <el-space>
              <el-tag type="warning" size="small" effect="plain">AI 生成，仅供参考，处置须人工确认</el-tag>
              <el-button
                v-permission="'llm:analyze'"
                type="primary"
                size="small"
                :loading="aiGenerating"
                @click="generateAi(!!aiResult)"
              >{{ aiResult ? '重新生成' : '生成智能分析' }}</el-button>
            </el-space>
          </div>
        </template>
        <el-empty
          v-if="!aiResult && !aiGenerating"
          description="点击「生成智能分析」由大模型总结事件、分析可能原因并给出处理建议（需在系统设置中启用智能分析）"
          :image-size="60"
        />
        <div v-else-if="aiGenerating && !aiResult" class="ai-generating">
          <el-icon class="is-loading"><Loading /></el-icon> 正在生成分析，请稍候…
        </div>
        <template v-else-if="aiResult">
          <el-alert
            v-if="aiResult.success === false"
            type="error"
            :closable="false"
            show-icon
            :title="'生成失败：' + (aiResult.errorMessage || '未知错误')"
          />
          <template v-else>
            <div class="ai-block">
              <div class="ai-block-title">事件总结</div>
              <p class="ai-summary">{{ aiResult.summary || '-' }}</p>
            </div>
            <div v-if="aiResult.causes?.length" class="ai-block">
              <div class="ai-block-title">可能原因</div>
              <ol class="ai-list">
                <li v-for="(c, i) in aiResult.causes" :key="i">{{ c }}</li>
              </ol>
            </div>
            <div v-if="aiResult.suggestions?.length" class="ai-block">
              <div class="ai-block-title">处理建议</div>
              <ol class="ai-list">
                <li v-for="(s, i) in aiResult.suggestions" :key="i">{{ s }}</li>
              </ol>
            </div>
            <div class="ai-meta">
              来源：{{ aiResult.model || 'LLM' }} 生成 · {{ aiResult.operatorName || '-' }} 于 {{ aiResult.createdAt || '-' }}
              <span v-if="aiResult.durationMs != null">· 耗时 {{ (aiResult.durationMs / 1000).toFixed(1) }}s</span>
            </div>
          </template>
        </template>
      </el-card>

      <!-- ④ 排查路径 -->
      <el-card shadow="never" class="section-card">
        <template #header>
          <div class="section-header">
            <span class="section-title"><el-icon><Guide /></el-icon> 排查路径建议</span>
            <el-tag type="success" size="small" effect="plain">按步骤逐一排查</el-tag>
          </div>
        </template>
        <el-empty v-if="!steps.length" description="暂无排查路径画像" :image-size="60" />
        <el-steps v-else direction="vertical" :active="currentStep - 1" class="step-list">
          <el-step
            v-for="(step, idx) in steps"
            :key="idx"
            :title="step.title"
            :status="currentStep > idx + 1 ? 'finish' : currentStep === idx + 1 ? 'process' : 'wait'"
          >
            <template #description>
              <div class="step-body">
                <p class="step-desc">{{ step.description }}</p>
                <el-space>
                  <el-button v-if="step.link" type="primary" size="small" @click="goStep(step)">{{ step.action }}</el-button>
                  <el-button v-if="currentStep === idx + 1" size="small" @click="markStepComplete(idx + 1)">标记完成</el-button>
                </el-space>
              </div>
            </template>
          </el-step>
        </el-steps>
      </el-card>

      <!-- ⑤ 建议处理动作 -->
      <el-card shadow="never" class="section-card">
        <template #header>
          <span class="section-title"><el-icon><Tools /></el-icon> 建议处理动作</span>
        </template>
        <el-alert type="warning" :closable="false" show-icon class="action-alert">
          以下动作仅供辅助决策，请结合实际情况谨慎操作；高风险动作须人工确认并走变更流程执行，系统不会自动执行任何数据库操作
        </el-alert>
        <el-empty v-if="!actions.length" description="暂无建议动作画像" :image-size="60" />
        <el-row v-else :gutter="16">
          <el-col v-for="(action, idx) in actions" :key="idx" :span="12" class="action-col">
            <div class="action-card">
              <div class="action-head">
                <el-tag :type="riskTag(action.risk)" effect="dark" size="small">风险：{{ riskLabel(action.risk) }}</el-tag>
                <span class="action-name">{{ action.action }}</span>
              </div>
              <p class="action-desc">{{ action.description }}</p>
              <el-collapse class="action-collapse">
                <el-collapse-item title="查看 SQL / 命令">
                  <SqlBlock :sql="action.sql" copy-tip="已复制" />
                </el-collapse-item>
              </el-collapse>
              <div class="action-impact">
                <el-icon><InfoFilled /></el-icon> {{ action.impact }}
              </div>
            </div>
          </el-col>
        </el-row>
      </el-card>

      <!-- ⑥ 历史同期对比 -->
      <el-card shadow="never" class="section-card">
        <template #header>
          <div class="section-header">
            <span class="section-title"><el-icon><DataLine /></el-icon> 历史同期对比</span>
            <el-radio-group v-model="comparisonPeriod" size="small">
              <el-radio-button value="yesterday">昨日同时</el-radio-button>
              <el-radio-button value="lastWeek">上周同时</el-radio-button>
            </el-radio-group>
          </div>
        </template>
        <el-table :data="comparisonRows" border size="small" v-loading="comparisonLoading">
          <el-table-column prop="metric" label="指标" width="180" />
          <el-table-column label="当前窗口均值" width="140">
            <template #default="{ row }">
              <span :class="{ 'text-danger': row.change != null && Math.abs(row.change) > 20 }">{{ row.current }}</span>
            </template>
          </el-table-column>
          <el-table-column label="历史同期均值" width="140">
            <template #default="{ row }">{{ row.historical }}</template>
          </el-table-column>
          <el-table-column label="变化幅度" width="120">
            <template #default="{ row }">
              <el-tag v-if="row.change != null" :type="changeTag(row.change)" size="small">
                {{ row.change > 0 ? '+' : '' }}{{ row.change }}%
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="analysis" label="分析说明" min-width="180" />
        </el-table>
      </el-card>

      <!-- ⑦ 处理记录 -->
      <el-card shadow="never" class="section-card">
        <template #header>
          <span class="section-title"><el-icon><Tickets /></el-icon> 处理记录</span>
        </template>
        <el-timeline v-if="operateLogs.length">
          <el-timeline-item
            v-for="log in operateLogs"
            :key="log.id"
            :type="operateColor(log.operateType)"
            :timestamp="log.createdAt"
            placement="top"
          >
            <b>{{ log.operatorName || '系统' }}</b> {{ operateLabel(log.operateType) }}了此告警
            <span v-if="log.remark" class="log-remark">备注：{{ log.remark }}</span>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-else description="暂无处理记录" :image-size="60" />
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Collection, Connection, DataLine, Document, Guide, InfoFilled, Loading, MagicStick, Search, Tickets, Tools, TrendCharts, Warning
} from '@element-plus/icons-vue'
import { getAlertEventDrilldown, listAlertOperateLogs, type AlertEventDrilldownVo } from '@/api/alert'
import { getLlmAnalysis, generateLlmAnalysis, type LlmAnalysisVo } from '@/api/llm'
import { generateReport as generateArchivedReport } from '@/api/report'
import { getMetricTrend } from '@/api/metric'
import { getInstance } from '@/api/instance'
import { toDrilldownProfile, type DrilldownMetric, type DrilldownStep } from '@/config/alertDrilldown'
import DictTag from '@/components/DictTag.vue'
import ProTable from '@/components/ProTable/index.vue'
import type { TableColumn } from '@/components/ProTable/types'
import SqlBlock from '@/components/SqlBlock.vue'
import { fmtDurationCn as fmtDuration } from '@/utils/format'
import { useDict } from '@/composables/useDict'
import { useInstanceStore } from '@/stores/instance'
import { getAlertPath, getDrilldownPath, isInstanceScopedPath } from '@/utils/instanceMenu'
import type { AlertEventOperateLogVo, BlockingChainRow, TrendPoint } from '@/types/monitor'
import { M } from '@/constants/metrics'
import DrilldownChart from './components/DrilldownChart.vue'

const route = useRoute()
const router = useRouter()
const instanceStore = useInstanceStore()
const { getDictLabel } = useDict('alert_level', 'alert_event_status')

const loading = ref(false)
const trendLoading = ref(false)
const comparisonLoading = ref(false)
const ctx = ref<AlertEventDrilldownVo | null>(null)
const operateLogs = ref<AlertEventOperateLogVo[]>([])
const currentStep = ref(1)
const comparisonPeriod = ref<'yesterday' | 'lastWeek'>('yesterday')

const ev = computed(() => ctx.value?.event ?? null)

/** 指标定义 unit 存的是编码（percent/count/bytes…），展示前归一化为符号 */
const UNIT_DISPLAY: Record<string, string> = {
  percent: '%',
  count: '',
  qps: '',
  bytes: 'B',
  ms: 'ms',
  seconds: 's',
  'pages/s': '页/s'
}
function normalizeUnit(u?: string | null): string {
  if (!u) return ''
  return UNIT_DISPLAY[u] ?? u
}

const unit = computed(() => normalizeUnit(ctx.value?.unit))

/** 服务端按指标编码匹配好的画像（数据库配置，含「通用类」兜底画像）；画像库为空时为 null，页面空态降级 */
const profile = computed(() => toDrilldownProfile(ctx.value?.profile))
const steps = computed(() => profile.value?.steps ?? [])
const actions = computed(() => profile.value?.actions ?? [])

// ── 场景综合事件（多信号复合诊断）────────────────────────────────────────
const isScenario = computed(() => ev.value?.eventSource === 'scenario')

// ── 阻塞链现场（锁相关事件建单时抓取的一次性快照）────────────────────────
const blockingChain = computed(() => ev.value?.blockingChainSnapshot ?? null)
type BlockingDisplayRow = BlockingChainRow & { chainDepth: number; rootBlockingPid: number | null }
const blockingChainRows = computed<BlockingDisplayRow[]>(() => {
  const rows = blockingChain.value?.rows ?? []
  const blockers = new Map<number, number>()
  for (const row of rows) {
    if (row.waitingPid != null && row.blockingPid != null) blockers.set(row.waitingPid, row.blockingPid)
  }
  return rows.map(row => {
    let depth = 0
    let root = row.blockingPid ?? null
    let current = row.waitingPid ?? null
    const visited = new Set<number>()
    while (current != null && blockers.has(current) && !visited.has(current)) {
      visited.add(current)
      root = blockers.get(current) ?? root
      current = root
      depth++
    }
    return { ...row, chainDepth: depth, rootBlockingPid: root }
  })
})
const blockingDbTypeLabel = computed(() => {
  const type = (ctx.value?.profile?.dbType ?? instanceStore.current?.dbType ?? '').toLowerCase().replace(/[\s_-]/g, '')
  if (type === 'sqlserver') return 'SQL Server'
  if (type === 'postgresql') return 'PostgreSQL'
  if (type === 'mysql') return 'MySQL'
  return '数据库'
})
const blockingColumns: TableColumn[] = [
  { prop: 'waitAgeSecs', label: '已等待', width: 90, align: 'center', slot: 'col-wait' },
  { prop: 'lockedTable', label: '被锁对象', minWidth: 160, slot: 'col-object' },
  { prop: 'chainDepth', label: '链深', width: 72, align: 'center', slot: 'col-depth' },
  { prop: 'rootBlockingPid', label: '根阻塞者', width: 100, align: 'center', slot: 'col-root' },
  { prop: 'waitingPid', label: '被阻塞会话', minWidth: 220, slot: 'col-waiting' },
  { prop: 'blockingPid', label: '直接阻塞会话', minWidth: 220, slot: 'col-blocking' }
]
const signals = computed(() => ev.value?.signalsSnapshot ?? [])
const totalSignalCount = computed(() => signals.value.length)
const metSignalCount = computed(() => signals.value.filter(s => s.met).length)

const typeLabel = computed(() => (isScenario.value ? '场景综合诊断' : profile.value?.typeLabel || '未分类'))

/** 事件 thresholdValue 已含比较符（如 ">=20.0"），拆开后补空格与单位展示 */
const thresholdText = computed(() => {
  const raw = ev.value?.thresholdValue
  if (raw == null || raw === '') return ''
  const m = String(raw).match(/^([<>=!]+)?\s*(.*)$/)
  const op = m?.[1] ?? ''
  const num = m?.[2] ?? String(raw)
  return `${op ? op + ' ' : ''}${num}${unit.value}`
})

/** {threshold} 占位符用纯数值（不带比较符） */
const thresholdNum = computed(() => {
  const raw = ev.value?.thresholdValue
  if (raw == null) return '-'
  return String(raw).replace(/^[<>=!]+\s*/, '')
})

// ── 时间窗口（§11.7：告警前 30 分钟至告警后 30 分钟）───────────────────
const WINDOW_MS = 30 * 60_000
/** 小时级采集指标：分钟窗口内无数据，扩窗到 ±12h 按小时粒度查询 */
const HOURLY_CODES = new Set<string>([
  M.CAPACITY_TOTAL_BYTES, M.CAPACITY_DATA_BYTES, M.CAPACITY_INDEX_BYTES,
  M.BINLOG_TOTAL_BYTES, M.ERRORLOG_ERROR_COUNT, M.ERRORLOG_WARNING_COUNT
])
const HOURLY_WINDOW_MS = 12 * 3600_000

function parseTime(s?: string | null): number {
  if (!s) return 0
  const t = new Date(s.replace(' ', 'T')).getTime()
  return Number.isNaN(t) ? 0 : t
}

const triggerTs = computed(() => parseTime(ev.value?.triggerTime))
const recoveryTs = computed(() => {
  const t = parseTime(ctx.value?.recoveryTime)
  return t || null
})

// ── 关联指标 ─────────────────────────────────────────────────────────────
// 普通规则事件：画像指标 + 触发指标本身（未包含且可绘制时前置）
// 场景综合事件：直接取触发时信号快照对应的指标（多信号各画一张）
const SIGNAL_COLORS = ['#E5484D', '#E08600', '#0C7C97', '#9B59B6', '#15A36A', '#6366F1']

const trendMetrics = computed<DrilldownMetric[]>(() => {
  if (isScenario.value) {
    return signals.value
      .filter(s => !!s.metricCode)
      .map((s, i) => ({
        code: s.metricCode!,
        label: s.name || s.metricCode!,
        unit: normalizeUnit(s.unit),
        color: SIGNAL_COLORS[i % SIGNAL_COLORS.length]
      }))
  }
  const list = [...(profile.value?.metrics ?? [])]
  const code = ctx.value?.metricCode
  if (
    code &&
    code.startsWith('mysql.') &&
    !ev.value?.booleanCondition &&
    !list.some(m => m.code === code)
  ) {
    list.unshift({
      code,
      label: ctx.value?.metricLabel || code,
      unit: unit.value,
      color: '#E5484D'
    })
  }
  return list
})

/** 图表组件引用（按指标编码），用于诊断报告导出时截取趋势图 PNG */
const chartRefs = new Map<string, { getImage: () => string | null }>()
function setChartRef(code: string, el: unknown) {
  if (el) chartRefs.set(code, el as { getImage: () => string | null })
  else chartRefs.delete(code)
}

const trendPoints = reactive<Record<string, TrendPoint[]>>({})
/** 按指标记录趋势接口失败；成功空数组仍由图表显示“窗口内暂无数据”。 */
const trendErrors = reactive<Record<string, string | undefined>>({})
/** 触发前后均值变化率（%），衡量指标在告警时刻附近的异动幅度 */
const trendChange = reactive<Record<string, number | null>>({})

function toGBPoints(points: TrendPoint[]): TrendPoint[] {
  return points.map(p => ({ ts: p.ts, value: Number((p.value / 1024 ** 3).toFixed(2)) }))
}

function avg(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function calcChange(points: TrendPoint[], centerTs: number): number | null {
  const before = avg(points.filter(p => p.ts < centerTs).map(p => p.value))
  const after = avg(points.filter(p => p.ts >= centerTs).map(p => p.value))
  if (before == null || after == null || before === 0) return null
  return Math.round(((after - before) / Math.abs(before)) * 100)
}

async function fetchTrends() {
  if (!ev.value || !triggerTs.value) return
  trendLoading.value = true
  try {
    const instanceId = ev.value.instanceId
    await Promise.all(trendMetrics.value.map(async m => {
      const hourly = m.frequency ? m.frequency === '1h' : HOURLY_CODES.has(m.code)
      const win = hourly ? HOURLY_WINDOW_MS : WINDOW_MS
      const from = triggerTs.value - win
      const to = Math.min(Date.now(), triggerTs.value + win)
      trendErrors[m.code] = undefined
      try {
        const res = await getMetricTrend(instanceId, m.code, from, to, hourly ? '1h' : '1m')
        const points = m.toGB ? toGBPoints(res.points ?? []) : (res.points ?? [])
        trendPoints[m.code] = points
        trendChange[m.code] = calcChange(points, triggerTs.value)
      } catch {
        trendPoints[m.code] = []
        trendChange[m.code] = null
        trendErrors[m.code] = '趋势查询失败，请稍后重试或检查采集服务'
      }
    }))
  } finally {
    trendLoading.value = false
  }
}

// ── 可能原因 ─────────────────────────────────────────────────────────────
// 普通规则事件：画像模板 + 真实触发值/阈值替换
// 场景综合事件：诊断结论为首要结论，各信号命中情况作为判断依据
const causes = computed(() => {
  const e = ev.value
  if (isScenario.value) {
    const signalEvidence = signals.value.map(s => {
      const st = s.state === 'unknown' ? '数据缺失' : s.met ? '已满足' : '未满足'
      const cond = s.expr ? `，条件 ${s.expr}` : ''
      return `${s.name}：当前值 ${s.currentVal ?? '-'}${normalizeUnit(s.unit)}（${st}${cond}）`
    })
    const list: { cause: string; confidence: number; color: 'danger' | 'warning' | 'info'; evidence: string[] }[] = [{
      cause: e?.alertMessage?.trim() || '多个信号联合命中，触发场景综合诊断',
      confidence: 1,
      color: 'danger',
      evidence: signalEvidence.length ? signalEvidence : ['无信号快照']
    }]
    return list
  }
  const fill = (s: string) => s
    .replace(/\{value\}/g, e?.triggerValue ?? '-')
    .replace(/\{threshold\}/g, thresholdNum.value)
    .replace(/\{unit\}/g, unit.value)
  return [...(profile.value?.causes ?? [])]
    .sort((a, b) => b.confidence - a.confidence)
    .map(c => ({ ...c, evidence: c.evidence.map(fill) }))
})

// ── 历史同期对比：当前窗口均值 vs 昨日/上周同窗口均值（真实数据）────────
interface ComparisonRow {
  metric: string
  current: string
  historical: string
  change: number | null
  analysis: string
}
const comparisonRows = ref<ComparisonRow[]>([])

function fmtAvg(v: number | null, unit: string): string {
  if (v == null) return '-'
  const n = Math.abs(v) >= 100 ? Math.round(v) : Number(v.toFixed(2))
  return `${n}${unit}`
}

function analysisText(change: number | null): string {
  if (change == null) return '缺少可对比数据'
  if (change > 100) return '异常增长，与本次告警强相关'
  if (change > 50) return '显著增长，需重点关注'
  if (change > 20) return '明显上升'
  if (change < -50) return '显著下降，需关注'
  if (change < -20) return '明显下降'
  return '与历史同期基本持平，属正常波动'
}

async function fetchComparison() {
  if (!ev.value || !triggerTs.value) return
  comparisonLoading.value = true
  try {
    const instanceId = ev.value.instanceId
    const offset = comparisonPeriod.value === 'yesterday' ? 24 * 3600_000 : 7 * 24 * 3600_000
    const rows = await Promise.all(trendMetrics.value.map(async m => {
      const hourly = m.frequency ? m.frequency === '1h' : HOURLY_CODES.has(m.code)
      const win = hourly ? HOURLY_WINDOW_MS : WINDOW_MS
      const freq = hourly ? '1h' as const : '1m' as const
      const curPoints = trendPoints[m.code] ?? []
      let histPoints: TrendPoint[] = []
      try {
        const res = await getMetricTrend(
          instanceId, m.code,
          triggerTs.value - offset - win,
          triggerTs.value - offset + win,
          freq
        )
        histPoints = m.toGB ? toGBPoints(res.points ?? []) : (res.points ?? [])
      } catch {
        histPoints = []
      }
      const cur = avg(curPoints.map(p => p.value))
      const hist = avg(histPoints.map(p => p.value))
      const change = cur != null && hist != null && hist !== 0
        ? Math.round(((cur - hist) / Math.abs(hist)) * 100)
        : null
      return {
        metric: m.label,
        current: fmtAvg(cur, m.unit),
        historical: fmtAvg(hist, m.unit),
        change,
        analysis: analysisText(change)
      }
    }))
    comparisonRows.value = rows
  } finally {
    comparisonLoading.value = false
  }
}

// ── 排查路径跳转（带实例上下文）─────────────────────────────────────────
async function goStep(step: DrilldownStep) {
  if (!step.link) return
  const e = ev.value
  // 实例级页面依赖顶栏"当前实例"，跳转前把上下文切到告警实例（MySQL / PG 分组均适用）
  if (e && isInstanceScopedPath(step.link) && instanceStore.current?.id !== e.instanceId) {
    try {
      const ins = await getInstance(e.instanceId)
      if (ins) instanceStore.setCurrent(ins)
    } catch {
      // 实例可能已删除：仍然跳转，由目标页空态引导
    }
  }
  router.push(step.link)
}

function markStepComplete(step: number) {
  if (currentStep.value === step) {
    currentStep.value++
    ElMessage.success(`步骤${step}已完成`)
  }
}

// ── 展示辅助 ─────────────────────────────────────────────────────────────
function levelLabel(level?: string) {
  return (level && getDictLabel('alert_level', level)) || level || '-'
}
function statusLabel(status: string) {
  return getDictLabel('alert_event_status', status) || status
}
function riskLabel(r: string) {
  return { low: '低', medium: '中', high: '高' }[r] || r
}
function riskTag(r: string): 'success' | 'warning' | 'danger' {
  return ({ low: 'success', medium: 'warning', high: 'danger' } as const)[r as 'low' | 'medium' | 'high'] || 'warning'
}
function changeTag(c: number): 'danger' | 'warning' | 'success' | 'info' {
  if (c > 50) return 'danger'
  if (c > 20) return 'warning'
  if (c < -10) return 'info'
  return 'success'
}
function operateLabel(t: string) {
  return { confirm: '确认', handling: '受理', silence: '静默', close: '关闭' }[t] || t
}
function operateColor(t: string): 'success' | 'primary' | 'warning' | 'info' {
  return ({ confirm: 'success', handling: 'primary', silence: 'warning', close: 'info' } as const)[
    t as 'confirm' | 'handling' | 'silence' | 'close'
  ] || 'info'
}

function goBack() {
  // 返回当前实例类型对应的告警管理页（PG 下钻页复用本组件）
  const path = getAlertPath(instanceStore.current?.dbType)
  if (!path) {
    ElMessage.warning('当前实例数据库类型未识别，无法返回告警管理')
    return
  }
  router.push(path)
}

function goKnowledge(articleId: number) {
  router.push({ path: '/system/knowledge', query: { articleId: String(articleId) } })
}

// ── 诊断报告（§11.7）：后端生成归档到报告中心，跳转预览页可导出 Word ─────────
const reportGenerating = ref(false)

async function generateReport() {
  const e = ev.value
  if (!e || reportGenerating.value) return
  reportGenerating.value = true
  try {
    const reportId = await generateArchivedReport({ reportType: 'event', eventId: e.id })
    ElMessage.success('诊断报告已生成并归档到报告中心')
    router.push({ path: '/system/report-preview', query: { id: String(reportId) } })
  } finally {
    reportGenerating.value = false
  }
}

// ── 智能分析（AI 生成，仅供参考）────────────────────────────────────────
const aiResult = ref<LlmAnalysisVo | null>(null)
const aiGenerating = ref(false)

async function loadAiAnalysis(eventId: number) {
  try {
    aiResult.value = await getLlmAnalysis(eventId)
  } catch {
    aiResult.value = null
  }
}

async function generateAi(regenerate: boolean) {
  const eventId = Number(route.query.eventId)
  if (!eventId) return
  aiGenerating.value = true
  try {
    aiResult.value = await generateLlmAnalysis(eventId, regenerate)
    if (aiResult.value?.success === false) {
      ElMessage.warning('智能分析生成失败：' + (aiResult.value.errorMessage || '未知错误'))
    } else {
      ElMessage.success('智能分析已生成')
    }
  } catch {
    // request.ts 已弹出错误提示（如未启用/无权限/数据不出域拦截）
  } finally {
    aiGenerating.value = false
  }
}

// ── 数据加载 ────────────────────────────────────────────────────────────
async function load() {
  const eventId = Number(route.query.eventId)
  if (!eventId) {
    ctx.value = null
    return
  }
  loading.value = true
  try {
    ctx.value = await getAlertEventDrilldown(eventId)
    const eventInstance = await getInstance(ctx.value.event.instanceId)
    if (eventInstance) {
      instanceStore.setCurrent(eventInstance)
      const canonicalPath = getDrilldownPath(eventInstance.dbType)
      if (canonicalPath && route.path !== canonicalPath) {
        await router.replace({ path: canonicalPath, query: route.query })
      }
    }
    listAlertOperateLogs(eventId)
      .then(logs => { operateLogs.value = logs ?? [] })
      .catch(() => { operateLogs.value = [] })
    loadAiAnalysis(eventId)
    await fetchTrends()
    await fetchComparison()
  } catch {
    ctx.value = null
  } finally {
    loading.value = false
  }
}

watch(comparisonPeriod, fetchComparison)
watch(() => route.query.eventId, load, { immediate: true })
</script>

<style scoped>
.drilldown-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* ── 智能分析卡片 ── */
.ai-generating {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 24px 0;
  justify-content: center;
  color: var(--el-text-color-secondary);
}
.ai-block { margin-bottom: 14px; }
.ai-block-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--el-text-color-primary);
}
.ai-summary {
  margin: 0;
  padding: 10px 14px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  line-height: 1.8;
  font-size: 13px;
}
.ai-list {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  line-height: 1.9;
}
.ai-meta {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  border-top: 1px dashed var(--el-border-color-lighter);
  padding-top: 8px;
}

.bc-link {
  cursor: pointer;
}
.bc-link :deep(.el-breadcrumb__inner):hover {
  color: var(--el-color-primary);
}

.section-card :deep(.el-card__header) {
  padding: 12px 16px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.text-danger {
  color: var(--el-color-danger);
  font-weight: 600;
}

.threshold-hint {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.chart-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 12px;
  min-height: 120px;
}

.cause-timeline {
  padding-left: 4px;
}

.cause-card {
  border: 1px solid var(--el-border-color-lighter);
  border-left-width: 3px;
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  background: var(--el-bg-color);
}
.cause-danger { border-left-color: var(--el-color-danger); }
.cause-warning { border-left-color: var(--el-color-warning); }
.cause-info { border-left-color: var(--el-color-info); }

.cause-title {
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--el-text-color-primary);
}

.cause-evidence {
  margin: 0;
  padding-left: 18px;
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.8;
}

.kb-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 4px 0 8px;
}

.kb-links {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.kb-link :deep(.el-link__inner) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.step-list {
  padding: 8px 0 0 4px;
}

.step-body {
  padding: 6px 0 14px;
}

.step-desc {
  color: var(--el-text-color-regular);
  margin: 0 0 8px;
  font-size: 13px;
}

.action-alert {
  margin-bottom: 14px;
}

.action-col {
  margin-bottom: 14px;
}

.action-card {
  height: 100%;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-base);
  padding: 14px 16px;
  background: var(--el-bg-color);
}

.action-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.action-name {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.action-desc {
  color: var(--el-text-color-regular);
  font-size: 13px;
  margin: 0 0 8px;
}

.action-collapse {
  border-top: none;
}

.action-impact {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.chain-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.chain-alert {
  margin-bottom: 12px;
}

.chain-type-tag {
  margin-left: 6px;
}

.chain-session {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 2px 0;
}

.chain-sql {
  font-size: 12px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.log-remark {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
