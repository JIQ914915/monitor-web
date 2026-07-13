<template>
  <div class="scenario-page">
    <!-- 无实例选中提示 -->
    <InstanceEmpty v-if="!inst" description="请先在顶栏选择一个实例，查看其场景化监控" />

    <template v-else>
      <!-- 统计卡片 -->
      <div class="stats-grid" v-loading="loading">
        <StatCard label="适配场景" :value="page?.total" sub="当前实例" tone="primary" />
        <StatCard label="已启用" :value="page?.enabledCount" sub="评估中" tone="success" />
        <StatCard label="已停用" :value="page?.disabledCount" sub="暂停评估" tone="info" />
      </div>

      <!-- 场景列表 -->
      <el-card shadow="never" class="table-card">
        <template #header>
          <div class="card-head">
            <span class="card-title">监控场景</span>
            <span class="card-sub">信号红色=当前满足触发条件，绿色=正常，灰色=数据缺失</span>
            <el-button
              v-if="canToggle"
              class="head-action"
              type="success"
              plain
              size="small"
              :icon="MagicStick"
              :loading="enablingRecommended"
              @click="handleEnableRecommended"
            >一键开启常用</el-button>
          </div>
        </template>
        <!-- 启停状态页签（与告警规则管理一致，默认展示已启用） -->
        <el-tabs v-model="enabledTab" class="scenario-status-tabs" @tab-change="onEnabledTabChange">
          <el-tab-pane :label="`已启用 (${page?.enabledCount ?? 0})`" name="enabled" />
          <el-tab-pane :label="`已停用 (${page?.disabledCount ?? 0})`" name="disabled" />
        </el-tabs>
        <ProTable
          embedded
          :data="rows"
          :columns="columns"
          :loading="loading"
          :total="page?.filteredTotal ?? 0"
          v-model:page-num="pagination.pageNum"
          v-model:page-size="pagination.pageSize"
          :show-toolbar="false"
          :operation-width="80"
          @page-change="fetchList"
        >
          <template #col-name="{ row }">
            <div class="name-cell">
              <span class="scenario-name">{{ row.scenarioName }}</span>
              <el-tag v-if="row.builtin" size="small" type="info" effect="plain">
                {{ getDictLabel('alert_rule_type', 'builtin') || '内置' }}
              </el-tag>
              <el-tag v-if="row.recommended" size="small" type="success" effect="plain">常用</el-tag>
            </div>
          </template>

          <template #col-severity="{ row }">
            <DictTag dict="alert_level" :value="row.severity" effect="dark" />
          </template>

          <template #col-logic="{ row }">
            <div class="logic-cell">
              <template v-for="(sig, idx) in (row as ScenarioVo).signals" :key="sig.code || idx">
                <el-tooltip :content="signalTooltip(sig)" placement="top">
                  <el-tag :type="signalTag(sig)" size="small" effect="plain" class="signal-tag">
                    {{ sig.name }}
                  </el-tag>
                </el-tooltip>
                <span v-if="idx < (row as ScenarioVo).signals.length - 1" class="logic-sep">
                  {{ row.logic }}
                </span>
              </template>
            </div>
          </template>

          <template #col-status="{ row }">
            <DictTag dict="scenario_status" :value="row.currentStatus" effect="plain" />
          </template>

          <template #col-enabled="{ row }">
            <el-switch
              :model-value="row.enabled"
              :loading="togglingCode === row.scenarioCode"
              :disabled="!canToggle"
              @change="(v: string | number | boolean) => handleToggle(row as ScenarioVo, Boolean(v))"
            />
          </template>

          <template #operation="{ row }">
            <el-button link type="primary" size="small" @click="showDetail(row as ScenarioVo)">详情</el-button>
          </template>
        </ProTable>
      </el-card>

      <!-- 场景详情抽屉 -->
      <CrudDrawer
        :visible="detailVisible"
        type="drawer"
        mode="view"
        :title="detail?.scenarioName || '场景详情'"
        size="640px"
        @update:visible="detailVisible = $event"
      >
        <template #default>
          <div v-if="detail" v-loading="detailLoading" class="detail-body">
            <!-- 基本信息 -->
            <div class="detail-head">
              <DictTag dict="alert_level" :value="detail.severity" effect="dark" />
              <DictTag dict="scenario_status" :value="detail.currentStatus" effect="plain" />
              <el-tag type="info" size="small" effect="plain">
                触发逻辑：{{ detail.logic === 'OR' ? '任一信号满足（OR）' : '全部信号满足（AND）' }}
              </el-tag>
              <el-tag v-if="detail.duration" type="info" size="small" effect="plain">
                持续 {{ detail.duration }}s 触发
              </el-tag>
            </div>
            <p class="detail-desc">{{ detail.description || '-' }}</p>

            <!-- 各信号状态 -->
            <div class="section-head">
              <div class="section-title">信号状态</div>
              <template v-if="canEdit">
                <el-button v-if="!thresholdEditing" link type="primary" size="small" @click="startThresholdEdit">
                  调整阈值
                </el-button>
                <div v-else class="edit-actions">
                  <el-button link size="small" @click="resetThresholdDefaults">恢复默认</el-button>
                  <el-button link size="small" @click="thresholdEditing = false">取消</el-button>
                  <el-button link type="primary" size="small" :loading="thresholdSaving" @click="saveThresholds">
                    保存
                  </el-button>
                </div>
              </template>
            </div>
            <div class="signal-list">
              <div
                v-for="(sig, idx) in detail.signals"
                :key="sig.code || idx"
                class="signal-card"
                :class="`signal-${sig.state}`"
              >
                <div class="signal-head">
                  <span class="signal-name">{{ sig.name }}</span>
                  <el-tag :type="signalTag(sig)" size="small" effect="plain">
                    {{ signalStateLabel(sig.state) }}
                  </el-tag>
                </div>
                <div class="signal-meta">
                  <span>触发条件：{{ sig.expr || '-' }}</span>
                  <span>当前值：{{ sig.currentVal }}</span>
                  <span
                    v-if="!thresholdEditing && sig.threshold != null && sig.defaultThreshold != null
                      && sig.threshold !== sig.defaultThreshold"
                    class="override-hint"
                  >已调整（默认 {{ sig.defaultThreshold }}{{ sig.unit || '' }}）</span>
                </div>
                <div v-if="thresholdEditing && sig.code && sig.threshold != null" class="signal-edit">
                  <span class="edit-label">触发阈值 {{ sig.operator || '' }}</span>
                  <el-input-number
                    v-model="thresholdDraft[sig.code]"
                    :min="0"
                    :precision="2"
                    :step="thresholdStep(sig)"
                    controls-position="right"
                    size="small"
                    style="width: 140px"
                  />
                  <span v-if="sig.unit" class="edit-unit">{{ sig.unit }}</span>
                  <span class="edit-default">默认 {{ sig.defaultThreshold }}{{ sig.unit || '' }}</span>
                </div>
              </div>
            </div>
            <div v-if="thresholdEditing" class="edit-tip">
              仅可调整触发阈值数值，信号组合与判断方向不可改；保存后下一评估周期生效
            </div>

            <!-- 诊断结论：触发中显示实际结论，否则显示模板预览 -->
            <div class="section-title">
              {{ detail.currentStatus === 'triggered' ? '诊断结论' : '触发后诊断（预览）' }}
            </div>
            <el-alert
              v-if="detail.currentStatus === 'triggered' && detail.diagnosis"
              type="error"
              :closable="false"
              show-icon
            >
              <template #title>
                <span class="diagnosis-text">{{ detail.diagnosis }}</span>
              </template>
            </el-alert>
            <el-alert v-else type="info" :closable="false" show-icon>
              <template #title>
                <span class="diagnosis-text">
                  当前场景未触发。触发后将结合命中信号给出诊断，默认结论：{{ detail.diagnosisTemplate || '-' }}
                </span>
              </template>
            </el-alert>

            <!-- 关联知识库 -->
            <div class="section-title">关联知识库</div>
            <div v-if="detail.knowledgeArticles?.length" class="kb-list">
              <el-link
                v-for="article in detail.knowledgeArticles"
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
            <el-empty v-else description="暂无关联文章" :image-size="48" />

            <!-- 关联事件入口 -->
            <div class="detail-actions">
              <el-button type="primary" plain @click="goRelatedEvents">查看关联事件</el-button>
            </div>
          </div>
        </template>
      </CrudDrawer>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Collection, MagicStick } from '@element-plus/icons-vue'
import { useInstanceStore } from '@/stores/instance'
import InstanceEmpty from '@/components/InstanceEmpty.vue'
import { useUserStore } from '@/stores/user'
import { useDict } from '@/composables/useDict'
import { enableRecommendedScenarios, getScenarioDetail, pageScenarios, toggleScenario, updateScenarioThresholds } from '@/api/scenario'
import type { ScenarioPageVo, ScenarioSignal, ScenarioVo } from '@/types/monitor'
import { ProTable, CrudDrawer } from '@/components/ProTable'
import type { TableColumn } from '@/components/ProTable'
import StatCard from '@/components/StatCard.vue'
import DictTag from '@/components/DictTag.vue'
import { getAlertPath } from '@/utils/instanceMenu'

const router = useRouter()
const instanceStore = useInstanceStore()
const userStore = useUserStore()
const inst = computed(() => instanceStore.current)

const { getDictLabel } = useDict('alert_rule_type')

const loading = ref(false)
const page = ref<ScenarioPageVo | null>(null)

// 启停状态页签（与告警规则管理一致，默认已启用）；过滤、级别排序与分页均由后端完成
const enabledTab = ref<'enabled' | 'disabled'>('enabled')
const pagination = reactive({ pageNum: 1, pageSize: 10 })

const rows = computed(() => page.value?.scenarios ?? [])

function onEnabledTabChange() {
  pagination.pageNum = 1
  fetchList()
}

const togglingCode = ref<string | null>(null)

const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<ScenarioVo | null>(null)

const canToggle = computed(() => userStore.hasPermission('scenario_mgmt:toggle'))
const canEdit = computed(() => userStore.hasPermission('scenario_mgmt:edit'))

// ── 阈值编辑 ─────────────────────────────────────────────────────────────
const thresholdEditing = ref(false)
const thresholdSaving = ref(false)
const thresholdDraft = ref<Record<string, number>>({})

function startThresholdEdit() {
  if (!detail.value) return
  const draft: Record<string, number> = {}
  for (const sig of detail.value.signals) {
    if (sig.code && sig.threshold != null) draft[sig.code] = sig.threshold
  }
  thresholdDraft.value = draft
  thresholdEditing.value = true
}

function resetThresholdDefaults() {
  if (!detail.value) return
  for (const sig of detail.value.signals) {
    if (sig.code && sig.defaultThreshold != null) thresholdDraft.value[sig.code] = sig.defaultThreshold
  }
}

function thresholdStep(sig: ScenarioSignal) {
  const base = sig.defaultThreshold ?? sig.threshold ?? 1
  return base >= 100 ? 10 : base >= 10 ? 5 : 1
}

async function saveThresholds() {
  if (!inst.value || !detail.value) return
  // 只上送与默认不同的覆盖值，等于默认视为恢复
  const overrides: Record<string, number> = {}
  for (const sig of detail.value.signals) {
    if (!sig.code) continue
    const v = thresholdDraft.value[sig.code]
    if (v != null && v !== sig.defaultThreshold) overrides[sig.code] = v
  }
  thresholdSaving.value = true
  try {
    await updateScenarioThresholds({
      instanceId: inst.value.id,
      scenarioCode: detail.value.scenarioCode,
      overrides
    })
    ElMessage.success('阈值已保存，下一评估周期生效')
    thresholdEditing.value = false
    await showDetail(detail.value)
    await fetchList()
  } finally {
    thresholdSaving.value = false
  }
}

const columns: TableColumn[] = [
  { prop: 'scenarioName', label: '场景名称', minWidth: 160, slot: 'col-name' },
  { prop: 'severity', label: '级别', width: 84, align: 'center', slot: 'col-severity' },
  { label: '触发逻辑', minWidth: 320, slot: 'col-logic' },
  { prop: 'currentStatus', label: '当前状态', width: 100, align: 'center', slot: 'col-status' },
  { prop: 'triggerCount', label: '触发次数', width: 90, align: 'right' },
  { prop: 'enabled', label: '启用', width: 76, align: 'center', slot: 'col-enabled' }
]

async function fetchList() {
  if (!inst.value) return
  loading.value = true
  try {
    page.value = await pageScenarios({
      instanceId: inst.value.id,
      enabled: enabledTab.value === 'enabled',
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize
    })
    // 启停切换后当前页可能变空（行移入另一页签），自动回退到最后一页
    const filteredTotal = page.value.filteredTotal ?? 0
    if (!page.value.scenarios.length && filteredTotal > 0 && pagination.pageNum > 1) {
      pagination.pageNum = Math.max(1, Math.ceil(filteredTotal / pagination.pageSize))
      await fetchList()
    }
  } finally {
    loading.value = false
  }
}

// ── 一键开启常用场景 ──────────────────────────────────────────────────────────
const enablingRecommended = ref(false)

async function handleEnableRecommended() {
  if (!inst.value) return
  try {
    await ElMessageBox.confirm(
      '将开启系统推荐的常用场景（带「常用」标签，如连接池耗尽、锁竞争、复制风险、磁盘空间预警等），已启用的场景与已调整的阈值不受影响。是否继续？',
      '一键开启常用场景',
      { type: 'info', confirmButtonText: '开启', cancelButtonText: '取消' }
    )
  } catch { return }
  enablingRecommended.value = true
  try {
    const count = await enableRecommendedScenarios(inst.value.id)
    ElMessage.success(count > 0 ? `已新开启 ${count} 个常用场景` : '常用场景均已处于开启状态')
    enabledTab.value = 'enabled'
    pagination.pageNum = 1
    await fetchList()
  } finally {
    enablingRecommended.value = false
  }
}

async function handleToggle(row: ScenarioVo, enabled: boolean) {
  if (!inst.value) return
  togglingCode.value = row.scenarioCode
  try {
    await toggleScenario({ instanceId: inst.value.id, scenarioCode: row.scenarioCode, enabled })
    ElMessage.success(enabled ? '场景已启用，下一评估周期生效' : '场景已停用，关联综合事件已联动关闭')
    await fetchList()
  } finally {
    togglingCode.value = null
  }
}

async function showDetail(row: ScenarioVo) {
  thresholdEditing.value = false
  detail.value = row
  detailVisible.value = true
  if (!inst.value) return
  detailLoading.value = true
  try {
    detail.value = await getScenarioDetail({ instanceId: inst.value.id, scenarioCode: row.scenarioCode })
  } finally {
    detailLoading.value = false
  }
}

function goKnowledge(articleId: number) {
  router.push({ path: '/system/knowledge', query: { articleId: String(articleId) } })
}

function goRelatedEvents() {
  if (!detail.value) return
  const path = getAlertPath(inst.value?.dbType)
  if (!path) {
    ElMessage.warning('当前实例数据库类型未识别，无法打开关联事件')
    return
  }
  router.push({
    path,
    query: { eventSource: 'scenario', scenarioCode: detail.value.scenarioCode }
  })
}

// ── 展示辅助 ─────────────────────────────────────────────────────────────
function signalTag(sig: ScenarioSignal): 'danger' | 'success' | 'info' {
  if (sig.state === 'met') return 'danger'
  if (sig.state === 'normal') return 'success'
  return 'info'
}

function signalStateLabel(state: ScenarioSignal['state']) {
  if (state === 'met') return '满足'
  if (state === 'normal') return '正常'
  return '数据缺失'
}

function signalTooltip(sig: ScenarioSignal) {
  return `${sig.expr || '-'}，当前值 ${sig.currentVal}`
}

watch(inst, (v) => {
  page.value = null
  enabledTab.value = 'enabled'
  pagination.pageNum = 1
  if (v) fetchList()
}, { immediate: true })
</script>

<style scoped>
.scenario-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.card-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.card-head .head-action {
  margin-left: auto;
  align-self: center;
}

.card-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* 启停状态页签（与告警规则管理样式一致） */
.scenario-status-tabs {
  margin-bottom: -4px;
}
.scenario-status-tabs :deep(.el-tabs__header) {
  margin: 0;
}
.scenario-status-tabs :deep(.el-tabs__item) {
  font-size: 13px;
}

.name-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.scenario-name {
  font-weight: 500;
}

.logic-cell {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.signal-tag {
  cursor: default;
}

.logic-sep {
  font-size: 11px;
  font-weight: 600;
  color: var(--el-text-color-placeholder);
  padding: 0 2px;
}

/* 详情抽屉 */
.detail-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail-head {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.detail-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}

.section-title {
  margin-top: 8px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.edit-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.override-hint {
  color: var(--el-color-warning);
}

.signal-edit {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.edit-label {
  white-space: nowrap;
}

.edit-unit {
  color: var(--el-text-color-regular);
}

.edit-default {
  color: var(--el-text-color-placeholder);
}

.edit-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 2px 0;
}

.signal-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.signal-card {
  border: 1px solid var(--el-border-color-lighter);
  border-left-width: 4px;
  border-radius: var(--radius-base);
  padding: 10px 14px;
}

.signal-met {
  border-left-color: #ef4444;
  background: #fef2f2;
}

.signal-normal {
  border-left-color: #10b981;
}

.signal-unknown {
  border-left-color: #9ca3af;
  background: var(--el-fill-color-lighter);
}

.signal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.signal-name {
  font-weight: 500;
}

.signal-meta {
  margin-top: 4px;
  display: flex;
  gap: 18px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.diagnosis-text {
  line-height: 1.6;
  white-space: normal;
}

.kb-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kb-link {
  justify-content: flex-start;
  gap: 4px;
}

.detail-actions {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}
</style>
