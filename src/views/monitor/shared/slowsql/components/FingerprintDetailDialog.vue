<template>
  <el-dialog
    :model-value="visible"
    title="SQL指纹详情"
    width="1080px"
    top="4vh"
    @update:model-value="emit('update:visible', $event)"
  >
    <template v-if="row">
      <!-- ── 基本信息 ─────────────────────────────────────────────── -->
      <div class="section-title">基本信息（最近 24 小时）</div>
      <el-descriptions :column="3" border size="small" class="detail-desc">
        <el-descriptions-item label="所属库">{{ row.schemaName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="SQL类型">
          <el-tag :type="sqlTypeTag(row.sqlType)" size="small">{{ row.sqlType }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="优化状态">
          <div class="status-cell">
            <DictTag dict="slow_sql_optimize_status" :value="row.optimizeStatus" />
            <el-button
              v-permission="'slowsql:mark'"
              link
              type="primary"
              size="small"
              :loading="marking"
              @click="toggleOptimizeStatus"
            >{{ row.optimizeStatus === 'optimized' ? '标记为未优化' : '标记为已优化' }}</el-button>
          </div>
        </el-descriptions-item>
        <el-descriptions-item label="出现次数">{{ fmtCount(row.execCount) }}</el-descriptions-item>
        <el-descriptions-item label="平均时长">
          <span :class="avgTimeClass(row.avgTimeMs)">{{ fmtMs(row.avgTimeMs) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="最大时长">
          <span :class="avgTimeClass(row.maxAvgTimeMs)">{{ fmtMs(row.maxAvgTimeMs) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="总耗时">{{ fmtMs(row.totalTimeMs) }}</el-descriptions-item>
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
        <el-descriptions-item label="首次出现">{{ fmtFullTime(row.firstSeen) }}</el-descriptions-item>
        <el-descriptions-item label="最后出现">{{ fmtFullTime(row.lastSeen) }}</el-descriptions-item>
        <el-descriptions-item label="关联告警">
          <el-tag v-if="relatedAlerts.length" type="danger" size="small">{{ relatedAlerts.length }} 条</el-tag>
          <span v-else>无</span>
        </el-descriptions-item>
      </el-descriptions>

      <!-- ── SQL 模式（指纹） ─────────────────────────────────────── -->
      <div class="section-title">SQL模式（指纹）</div>
      <SqlBlock :sql="row.digestText" />
      <div class="desc-hint">指纹哈希：<span class="digest-text">{{ row.digest }}</span></div>

      <!-- ── SQL 明细列表（真实执行样本） ─────────────────────────── -->
      <div class="section-title">SQL明细列表（该指纹的真实执行样本，SQL 含参数原文）</div>
      <el-table v-loading="recordsLoading" :data="records" stripe size="small" max-height="260" row-key="sampleKey">
        <el-table-column label="SQL语句" min-width="300" show-overflow-tooltip>
          <template #default="{ row: r }">
            <span class="sql-cell">{{ r.sqlText }}</span>
          </template>
        </el-table-column>
        <el-table-column label="执行时间" width="100" align="right">
          <template #default="{ row: r }">
            <span :class="avgTimeClass(r.execTimeMs)">{{ fmtMs(r.execTimeMs) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="扫描行数" width="92" align="right">
          <template #default="{ row: r }">{{ fmtCount(r.rowsExamined) }}</template>
        </el-table-column>
        <el-table-column label="执行用户" width="110" show-overflow-tooltip>
          <template #default="{ row: r }">{{ r.connUser || '-' }}</template>
        </el-table-column>
        <el-table-column label="时间" width="150">
          <template #default="{ row: r }">{{ fmtFullTime(r.collectTime) }}</template>
        </el-table-column>
        <template #empty>
          <el-empty description="窗口内暂无真实执行样本（样本自采集功能启用后开始积累，保留 7 天）" :image-size="50" />
        </template>
      </el-table>
      <div class="pager-row">
        <el-pagination
          v-model:current-page="recordPageNum"
          :page-size="recordPageSize"
          :total="recordTotal"
          size="small"
          layout="total, prev, pager, next"
          @current-change="loadRecords"
        />
      </div>

      <!-- ── 关联慢SQL告警列表 ────────────────────────────────────── -->
      <div class="section-title">关联慢SQL告警列表</div>
      <el-table :data="relatedAlerts" stripe size="small" max-height="220">
        <el-table-column label="触发时间" width="150">
          <template #default="{ row: a }">{{ fmtFullTime(a.triggerTime) }}</template>
        </el-table-column>
        <el-table-column label="规则名称" prop="ruleName" min-width="150" show-overflow-tooltip />
        <el-table-column label="级别" width="80" align="center">
          <template #default="{ row: a }">
            <DictTag dict="alert_level" :value="a.ruleLevel" />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="88" align="center">
          <template #default="{ row: a }">
            <DictTag dict="alert_event_status" :value="a.status" />
          </template>
        </el-table-column>
        <el-table-column label="触发值/阈值" width="120" align="right">
          <template #default="{ row: a }">{{ a.triggerValue ?? '-' }} / {{ a.thresholdValue ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="告警信息" min-width="200" show-overflow-tooltip>
          <template #default="{ row: a }">{{ a.alertMessage || '-' }}</template>
        </el-table-column>
        <template #empty>
          <el-empty description="该指纹活跃期内无慢SQL相关告警" :image-size="50" />
        </template>
      </el-table>
      <div class="desc-hint">
        关联规则：告警事件的活跃期与该指纹在窗口内的出现期存在时间交叠（慢查询增量类告警为实例级，同一时段的指纹会关联到相同事件）
      </div>

      <!-- ── AI 智能分析（LLM，可选增强） ─────────────────────────── -->
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
          {{ aiResult ? '重新分析' : 'AI 分析该指纹' }}
        </el-button>
      </div>
      <el-alert v-if="aiError" type="error" show-icon :closable="false" :title="aiError" class="ai-alert" />
      <div v-if="aiResult && aiResult.success" class="ai-card">
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
          AI 生成（{{ aiResult.model }}），仅供参考；索引与改写变更须评估锁表影响并经人工确认后在低峰窗口执行
        </div>
      </div>
      <div v-else-if="!aiLoading && !aiError" class="desc-hint">
        点击「AI 分析该指纹」，系统将把指纹统计与脱敏后的语句发送给已配置的大模型生成慢因分析与优化建议（须先在「系统设置 → 智能分析设置」启用）
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { MagicStick } from '@element-plus/icons-vue'
import DictTag from '@/components/DictTag.vue'
import SqlBlock from '@/components/SqlBlock.vue'
import { fmtCount, fmtMs, fmtYmdHm as fmtFullTime } from '@/utils/format'
import { pageSlowSqlSamples, setSlowSqlOptimizeStatus } from '@/api/slowsql'
import { analyzeSlowSqlLlm, type LlmAnalysisVo } from '@/api/llm'
import type { SlowSqlDigestVo, SlowSqlSampleVo, SlowSqlAlertVo } from '@/types/monitor'

const props = defineProps<{
  visible: boolean
  instanceId: number | null
  row: SlowSqlDigestVo | null
  alerts: SlowSqlAlertVo[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'status-changed', digest: string, schemaName: string | null, status: string): void
}>()


const marking = ref(false)
const recordsLoading = ref(false)
const records = ref<SlowSqlSampleVo[]>([])
const recordTotal = ref(0)
const recordPageNum = ref(1)
const recordPageSize = 10

/** 该指纹关联的告警：digest 精确匹配，或活跃期与指纹出现期交叠 */
const relatedAlerts = computed<SlowSqlAlertVo[]>(() => {
  const r = props.row
  if (!r) return []
  const now = Date.now()
  return props.alerts.filter(a =>
    a.dimensionKey === r.digest ||
    (a.triggerTime <= r.lastSeen && (a.recoveryTime ?? now) >= r.firstSeen)
  )
})

async function loadRecords() {
  if (!props.instanceId || !props.row) return
  recordsLoading.value = true
  try {
    const res = await pageSlowSqlSamples({
      instanceId: props.instanceId,
      digest: props.row.digest,
      sortField: 'collectTime',
      pageNum: recordPageNum.value,
      pageSize: recordPageSize
    })
    records.value = res.list ?? []
    recordTotal.value = res.total ?? 0
  } finally {
    recordsLoading.value = false
  }
}

// ── AI 智能分析 ──────────────────────────────────────────────────────────
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
      // 优先带上真实样本 SQL（含参数，服务端按配置脱敏）
      sqlText: records.value[0]?.sqlText ?? null
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

async function toggleOptimizeStatus() {
  const r = props.row
  if (!props.instanceId || !r) return
  const next = r.optimizeStatus === 'optimized' ? 'unoptimized' : 'optimized'
  marking.value = true
  try {
    await setSlowSqlOptimizeStatus({
      instanceId: props.instanceId,
      schemaName: r.schemaName,
      digest: r.digest,
      status: next
    })
    r.optimizeStatus = next
    ElMessage.success(next === 'optimized' ? '已标记为已优化' : '已标记为未优化')
    emit('status-changed', r.digest, r.schemaName, next)
  } finally {
    marking.value = false
  }
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

watch(() => props.visible, (v) => {
  if (v && props.row) {
    recordPageNum.value = 1
    records.value = []
    recordTotal.value = 0
    aiResult.value = null
    aiError.value = null
    loadRecords()
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
.status-cell {
  display: flex;
  align-items: center;
  gap: 8px;
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
.pager-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
.ai-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.ai-alert {
  margin-bottom: 10px;
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
</style>
