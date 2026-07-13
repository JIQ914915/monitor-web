<template>
  <div class="alert-rule-page">

    <!-- 无实例提示 -->
    <InstanceEmpty v-if="!inst" />

    <template v-else>
      <el-tabs v-model="activeTab" class="alert-tabs">
        <el-tab-pane label="告警事件" name="events">
          <div class="alert-tab-section">
            <AlertEventPanel :instance-id="inst?.id" />
          </div>
        </el-tab-pane>
        <el-tab-pane label="告警规则" name="rules">
          <div class="alert-tab-section">
            <!-- 统计卡片 -->
            <el-row :gutter="12" class="stat-row">
              <el-col :span="6">
                <StatCard label="总规则数" :value="enabledTotal + disabledTotal" sub="当前实例" tone="primary" />
              </el-col>
              <el-col :span="6">
                <StatCard label="已启用" :value="enabledTotal" sub="监控中" tone="success" />
              </el-col>
              <el-col :span="6">
                <StatCard label="已停用" :value="disabledTotal" sub="暂停监控" tone="info" />
              </el-col>
              <el-col :span="6">
                <StatCard label="触发中" :value="firingCount" sub="需处理" tone="danger" />
              </el-col>
            </el-row>

            <!-- 启停状态页签（默认展示已启用） -->
            <el-tabs v-model="enabledTab" class="rule-status-tabs" @tab-change="onEnabledTabChange">
              <el-tab-pane :label="`已启用 (${enabledTotal})`" name="enabled" />
              <el-tab-pane :label="`已停用 (${disabledTotal})`" name="disabled" />
            </el-tabs>

            <!-- ProTable ──────────────────────────────────────────────── -->
            <ProTable
              :data="tableData"
              :columns="columns"
              :loading="loading"
              :total="total"
              v-model:page-num="pagination.pageNum"
              v-model:page-size="pagination.pageSize"
              show-selection
              :show-add="false"
              :operation-width="190"
              :collapsible="false"
              :delete-confirm-msg="(row: any) => `确认删除规则「${row.ruleName}」？删除后不可恢复。`"
              :delete-request="handleDelete"
              @search="handleSearch"
              @reset="handleReset"
              @page-change="fetchList"
              @selection-change="(rows) => selectedRules = rows as AlertRuleVo[]"
            >
            <!-- 搜索条件 -->
            <template #search>
              <el-form-item label="规则名称">
                <el-input
                  v-model="filters.keyword"
                  placeholder="搜索规则名称"
                  clearable
                  style="width: 200px"
                />
              </el-form-item>
              <el-form-item label="告警级别">
                <el-select v-model="filters.ruleLevel" placeholder="全部" clearable style="width: 120px">
                  <el-option
                    v-for="item in getDictItems('alert_level')"
                    :key="item.itemValue as string"
                    :label="item.itemLabel as string"
                    :value="item.itemValue as string"
                  />
                </el-select>
              </el-form-item>
            </template>

            <!-- 工具栏 -->
            <template #toolbar>
              <el-button v-permission="'alert_rule:add'" type="primary" :icon="Plus" @click="openCustomDialog">自定义规则</el-button>
              <el-button
                v-permission="'alert_rule:edit'"
                type="success"
                plain
                :icon="MagicStick"
                :loading="enablingRecommended"
                @click="handleEnableRecommended"
              >一键开启常用</el-button>
              <el-button
                v-if="enabledTab === 'disabled'"
                v-permission="'alert_rule:edit'"
                type="success"
                :disabled="!selectedRules.length"
                @click="handleBatchToggle(selectedRules, true)"
              >批量启用</el-button>
              <el-button
                v-if="enabledTab === 'enabled'"
                v-permission="'alert_rule:edit'"
                type="warning"
                :disabled="!selectedRules.length"
                @click="handleBatchToggle(selectedRules, false)"
              >批量停用</el-button>
            </template>

            <!-- 列 slot：来源（alert_rule_type 字典解析标签与颜色） -->
            <template #col-source="{ row }">
              <DictTag dict="alert_rule_type" :value="row.ruleType" effect="plain" />
            </template>

            <!-- 列 slot：规则名称（含版本标签） -->
            <template #col-name="{ row }">
              <div class="rule-name-cell">
                <span class="rule-name" :title="row.ruleName">
                  {{ row.ruleName }}
                  <el-tag v-if="row.recommended" size="small" type="success" effect="plain">常用</el-tag>
                </span>
                <!--                <el-tag-->
                <!--                  v-if="row.ruleType === 'builtin' && row.dbVersion"-->
                <!--                  size="small"-->
                <!--                  type="warning"-->
                <!--                  effect="plain"-->
                <!--                  class="version-tag"-->
                <!--                >{{ formatVersions(row.dbVersion) }}</el-tag>-->
              </div>
            </template>

            <!-- 列 slot：告警级别 -->
            <template #col-level="{ row }">
              <DictTag dict="alert_level" :value="(row as AlertRuleVo).ruleLevel" effect="dark" />
            </template>

            <!-- 列 slot：触发条件 -->
            <template #col-condition="{ row }">
              <span v-if="row.conditionDisplay">{{ row.conditionDisplay }}</span>
              <span v-else-if="row.operator != null">
                {{ row.operator }} {{ row.threshold }} {{ row.unit }}
                <span v-if="row.duration" class="cond-dur">（持续 {{ row.duration }}s）</span>
              </span>
              <span v-else-if="row.customSql" class="cond-dur">自定义 SQL</span>
              <span v-else class="no-data">-</span>
            </template>

            <!-- 列 slot：扫描间隔 -->
            <template #col-interval="{ row }">
              <span>{{ row.scanIntervalMin ? `${row.scanIntervalMin} 分钟` : '-' }}</span>
            </template>

            <!-- 列 slot：触发次数 -->
            <template #col-trigger-count="{ row }">
              <span :class="{ 'firing-count': row.triggerCount > 0 }">{{ row.triggerCount }}</span>
            </template>

            <!-- 操作列 -->
            <template #operation="{ row, confirmDelete }">
              <el-button v-permission="'alert_rule:edit'" link type="primary" size="small" @click="handleEdit(row as AlertRuleVo)">编辑</el-button>
              <el-button v-permission="'alert_rule:edit'" link type="primary" size="small" @click="openIntervalDialog(row as AlertRuleVo)">调频</el-button>
              <el-button
                v-permission="'alert_rule:edit'"
                link
                :type="row.instanceEnabled ? 'warning' : 'success'"
                size="small"
                @click="handleToggle(row as AlertRuleVo)"
              >{{ row.instanceEnabled ? '停用' : '启用' }}</el-button>
              <el-button
                v-if="row.ruleType !== 'builtin'"
                v-permission="'alert_rule:add'"
                link
                type="primary"
                size="small"
                @click="handleCopy(row as AlertRuleVo)"
              >复制</el-button>
              <el-button
                v-permission="'alert_rule:delete'"
                link
                type="danger"
                size="small"
                :disabled="row.ruleType === 'builtin'"
                @click="confirmDelete(row as AlertRuleVo)"
              >删除</el-button>
            </template>
            </ProTable>
          </div>
        </el-tab-pane>
      </el-tabs>
    </template>

    <!-- 内置/标准规则编辑抽屉 -->
    <AlertRuleDialog
      v-if="ruleDialogVisible"
      v-model:visible="ruleDialogVisible"
      :rule="editingRule"
      :instance-id="inst?.id"
      @saved="onSaved"
    />

    <!-- 自定义 SQL 规则编辑抽屉 -->
    <CustomRuleDialog
      v-if="customDialogVisible"
      v-model:visible="customDialogVisible"
      :rule="editingCustomRule"
      :instance-id="inst?.id"
      :db-type="inst?.dbType"
      @saved="onSaved"
    />

    <el-dialog
      v-model="quickIntervalVisible"
      title="快速调整扫描频率"
      width="420px"
      destroy-on-close
    >
      <template v-if="intervalEditingRule">
        <div class="quick-interval-hint">
          <div>规则：{{ intervalEditingRule.ruleName }}</div>
          <div>最小可配：{{ quickMinAllowed }} 分钟</div>
        </div>
        <el-form label-width="92px">
          <el-form-item label="扫描间隔">
            <el-select v-model="quickIntervalValue" style="width: 220px">
              <el-option
                v-for="item in quickIntervalOptions"
                :key="item"
                :label="`每 ${item} 分钟`"
                :value="item"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="quickIntervalVisible = false">取消</el-button>
        <el-button type="primary" :loading="quickIntervalSaving" @click="saveQuickInterval">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MagicStick, Plus } from '@element-plus/icons-vue'
import { ProTable } from '@/components/ProTable'
import StatCard from '@/components/StatCard.vue'
import DictTag from '@/components/DictTag.vue'
import type { TableColumn } from '@/components/ProTable'
import AlertRuleDialog from './components/AlertRuleDialog.vue'
import CustomRuleDialog from './components/CustomRuleDialog.vue'
import AlertEventPanel from './components/AlertEventPanel.vue'
import { pageAlertRules, toggleAlertRule, deleteAlertRule, updateAlertRuleScanInterval, enableRecommendedAlertRules } from '@/api/alert'
import { countAlertEvents } from '@/api/metric'
import { useInstanceStore } from '@/stores/instance'
import InstanceEmpty from '@/components/InstanceEmpty.vue'
import type { AlertRuleVo, AlertRulePageRequest } from '@/types/alert'

// ── 实例 ─────────────────────────────────────────────────────────────────────
const instanceStore = useInstanceStore()
const inst = computed(() => instanceStore.current)
const activeTab = ref<'events' | 'rules'>('events')

// ── 字典 ─────────────────────────────────────────────────────────────────────
import { useDict } from '@/composables/useDict'
const { getDictItems, loadDict } = useDict('alert_level', 'alert_rule_type')

function formatVersions(dbVersion: string | null | undefined) {
  if (!dbVersion) return '全版本'
  return dbVersion.split(',').map((v) => v.trim()).join(' / ')
}

// ── 列定义 ───────────────────────────────────────────────────────────────────
const columns: TableColumn[] = [
  { label: '来源',     width: 80,  align: 'center', slot: 'col-source' },
  { label: '规则名称', minWidth: 200, slot: 'col-name' },
  { label: '告警级别', width: 85,  slot: 'col-level' },
  { label: '触发条件', minWidth: 150, slot: 'col-condition', showOverflowTooltip: true },
  { label: '扫描间隔', width: 100, align: 'center', slot: 'col-interval' },
  { label: '触发次数', width: 90,  align: 'center', slot: 'col-trigger-count' },
  { label: '描述',     prop: 'description', minWidth: 200, showOverflowTooltip: true },
]

// ── 状态 ─────────────────────────────────────────────────────────────────────
const loading   = ref(false)
const tableData = ref<AlertRuleVo[]>([])
const total     = ref(0)
const selectedRules = ref<AlertRuleVo[]>([])

const filters = reactive<{
  keyword: string
  ruleLevel: string
}>({
  keyword: '',
  ruleLevel: '',
})
const pagination = reactive({ pageNum: 1, pageSize: 20 })

// 启停状态页签（默认已启用）；两个页签的总数用于页签角标与统计卡片
const enabledTab = ref<'enabled' | 'disabled'>('enabled')
const enabledTotal  = ref(0)
const disabledTotal = ref(0)
const firingCount   = ref(0)

function onEnabledTabChange() {
  pagination.pageNum = 1
  selectedRules.value = []
  fetchList()
}

// ── 数据加载 ──────────────────────────────────────────────────────────────────
async function fetchList() {
  if (!inst.value) return
  loading.value = true
  const isEnabledTab = enabledTab.value === 'enabled'
  try {
    // 当前页签列表 + 另一页签总数（仅取 total）并行请求，统计卡片与页签角标同步刷新
    const [res, otherRes] = await Promise.all([
      pageAlertRules({
        instanceId: inst.value.id,
        ...filters,
        enabled: isEnabledTab,
        pageNum: pagination.pageNum,
        pageSize: pagination.pageSize,
      }),
      pageAlertRules({
        instanceId: inst.value.id,
        ...filters,
        enabled: !isEnabledTab,
        pageNum: 1,
        pageSize: 1,
      }),
    ])
    tableData.value = res.list
    total.value     = res.total
    if (isEnabledTab) {
      enabledTotal.value = res.total
      disabledTotal.value = otherRes.total
    } else {
      disabledTotal.value = res.total
      enabledTotal.value = otherRes.total
    }
  } finally {
    loading.value = false
  }
}

async function fetchFiringCount() {
  if (!inst.value) return
  try {
    firingCount.value = await countAlertEvents({
      instanceId: inst.value.id,
      statuses: ['pending', 'confirmed', 'handling']
    })
  } catch { firingCount.value = 0 }
}

// ── 一键开启常用规则 ──────────────────────────────────────────────────────────
const enablingRecommended = ref(false)

async function handleEnableRecommended() {
  if (!inst.value) return
  try {
    await ElMessageBox.confirm(
      '将开启系统推荐的常用内置规则（可用性、磁盘写满、复制中断、锁与慢 SQL 等关键项，带「常用」标签），已启用的规则与已有配置不受影响。是否继续？',
      '一键开启常用规则',
      { type: 'info', confirmButtonText: '开启', cancelButtonText: '取消' }
    )
  } catch { return }
  enablingRecommended.value = true
  try {
    const count = await enableRecommendedAlertRules(inst.value.id)
    ElMessage.success(count > 0 ? `已新开启 ${count} 条常用规则` : '常用规则均已处于开启状态')
    pagination.pageNum = 1
    fetchList()
  } finally {
    enablingRecommended.value = false
  }
}

function handleSearch() { pagination.pageNum = 1; fetchList() }
function handleReset() {
  Object.assign(filters, { keyword: '', ruleLevel: '' })
  pagination.pageNum = 1
  fetchList()
}

watch(() => inst.value?.id, (id) => {
  if (!id) return
  pagination.pageNum = 1
  fetchList()
  // 仅在规则页签需要「触发中」统计时请求，避免默认进入页面与事件面板重复请求 events/page
  if (activeTab.value === 'rules') fetchFiringCount()
})
onMounted(() => {
  loadDict('alert_level')
  if (!inst.value) return
  fetchList()
  if (activeTab.value === 'rules') fetchFiringCount()
})

watch(activeTab, (tab) => {
  if (tab === 'rules' && inst.value) fetchFiringCount()
})

// ── 弹窗 ─────────────────────────────────────────────────────────────────────
const ruleDialogVisible   = ref(false)
const customDialogVisible = ref(false)
const editingRule         = ref<AlertRuleVo | null>(null)
const editingCustomRule   = ref<AlertRuleVo | null>(null)
const quickIntervalVisible = ref(false)
const quickIntervalSaving = ref(false)
const intervalEditingRule = ref<AlertRuleVo | null>(null)
const quickIntervalValue = ref(1)
const quickMinAllowed = computed(() => Math.max(1, intervalEditingRule.value?.minAllowedIntervalMin ?? 1))
const quickIntervalOptions = computed(() => buildIntervalOptions(quickMinAllowed.value))

function handleEdit(row: AlertRuleVo) {
  if (row.customSql) {
    editingCustomRule.value = row
    customDialogVisible.value = true
  } else {
    editingRule.value = row
    ruleDialogVisible.value = true
  }
}

function openCustomDialog() {
  editingCustomRule.value = null
  customDialogVisible.value = true
}

function handleCopy(row: AlertRuleVo) {
  const copy: AlertRuleVo = {
    ...row, id: 0,
    ruleName: row.ruleName + '_副本',
    ruleType: 'custom',
    createdAt: null, updatedAt: null,
    triggerCount: 0, lastTriggerAt: null,
  }
  if (row.customSql) {
    editingCustomRule.value = copy
    customDialogVisible.value = true
  } else {
    editingRule.value = copy
    ruleDialogVisible.value = true
  }
}

function onSaved() {
  ruleDialogVisible.value   = false
  customDialogVisible.value = false
  fetchList()
}

function openIntervalDialog(row: AlertRuleVo) {
  intervalEditingRule.value = row
  quickIntervalValue.value = row.scanIntervalMin ?? Math.max(1, row.minAllowedIntervalMin ?? 1)
  quickIntervalVisible.value = true
}

async function saveQuickInterval() {
  if (!intervalEditingRule.value) return
  quickIntervalSaving.value = true
  try {
    await updateAlertRuleScanInterval(intervalEditingRule.value.ruleCode, quickIntervalValue.value, inst.value?.id)
    ElMessage.success('扫描间隔更新成功')
    quickIntervalVisible.value = false
    fetchList()
  } catch {
    ElMessage.error('更新失败，请稍后重试')
  } finally {
    quickIntervalSaving.value = false
  }
}

// ── 启停（含二次确认） ────────────────────────────────────────────────────────
async function handleToggle(row: AlertRuleVo) {
  const newEnabled = !row.instanceEnabled
  const action = newEnabled ? '启用' : '停用'
  try {
    await ElMessageBox.confirm(
      `确认${action}规则「${row.ruleName}」？`,
      `${action}确认`,
      { confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' }
    )
  } catch { return }
  await toggleAlertRule(row.ruleCode, newEnabled, inst.value?.id)
  ElMessage.success(`${action}成功`)
  fetchList()
}

async function handleBatchToggle(rows: AlertRuleVo[], enabled: boolean) {
  if (!rows.length) return
  const action = enabled ? '启用' : '停用'
  try {
    await ElMessageBox.confirm(
      `确认批量${action}所选 ${rows.length} 条规则？`,
      `批量${action}确认`,
      { confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' }
    )
  } catch { return }
  await Promise.all(rows.map((r) => toggleAlertRule(r.ruleCode, enabled, inst.value?.id)))
  ElMessage.success(`批量${action}成功`)
  fetchList()
}

// ── 删除 ─────────────────────────────────────────────────────────────────────
async function handleDelete(row: AlertRuleVo) {
  await deleteAlertRule(row.ruleCode)
  fetchList()
}

function buildIntervalOptions(minAllowed: number): number[] {
  const preset = [1, 2, 5, 10, 15, 30, 60, 120, 180, 240, 360, 720, 1440]
    .filter((v) => v >= minAllowed)
    .filter((v) => v % minAllowed === 0)
  if (preset.length) return preset
  return [1, 2, 3, 6, 12, 24].map((factor) => minAllowed * factor)
}
</script>

<style scoped>
.alert-rule-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 顶部页签：做成同一张面板的“导航 + 内容”结构 */
.alert-tabs {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-base);
  background: var(--el-bg-color);
  box-shadow: 0 1px 2px rgba(14, 26, 43, 0.04);
  overflow: hidden;
}
.alert-tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: linear-gradient(180deg, var(--el-fill-color-lighter) 0%, var(--el-bg-color) 100%);
}
.alert-tabs :deep(.el-tabs__nav-wrap) {
  padding: 0;
}
.alert-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}
.alert-tabs :deep(.el-tabs__item) {
  height: 42px;
  line-height: 42px;
  padding: 0 14px;
  font-size: 14px;
  color: var(--el-text-color-secondary);
  border-radius: var(--radius-sm);
}
.alert-tabs :deep(.el-tabs__item.is-active) {
  color: var(--el-color-primary);
  font-weight: 600;
}
.alert-tabs :deep(.el-tabs__content) {
  padding: 14px;
}
.alert-tab-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* 启停状态页签：轻量线型，与外层卡片式页签区分 */
.rule-status-tabs {
  margin-bottom: -4px;
}
.rule-status-tabs :deep(.el-tabs__header) {
  margin: 0;
}
.rule-status-tabs :deep(.el-tabs__item) {
  font-size: 13px;
}

/* 统计卡片 */
.stat-row { flex-shrink: 0; }

/* 规则名称单元格 */
.rule-name-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.rule-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.version-tag {
  align-self: flex-start;
  font-size: 11px;
}

/* 触发条件 / 辅助文字 */
.cond-dur     { color: var(--el-text-color-secondary); font-size: 12px; }
.firing-count { color: var(--el-color-danger); font-weight: 600; }
.no-data      { color: var(--el-text-color-placeholder); }

.quick-interval-hint {
  margin-bottom: 10px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.8;
}

</style>
