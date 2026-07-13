<template>
  <div>
    <ProTable
      :data="list"
      :columns="columns"
      :loading="loading"
      :total="total"
      v-model:page-num="query.pageNum"
      v-model:page-size="query.pageSize"
      :show-add="false"
      :operation-width="130"
      :delete-confirm-msg="(row: any) => `确认删除内置规则「${row.ruleName}」？删除后各实例的启停配置与活跃告警事件将被联动清理。`"
      :delete-request="remove"
      @search="search"
      @reset="reset"
      @page-change="load"
    >
      <template #toolbar>
        <el-button v-permission="'builtin_rule:create'" type="primary" :icon="Plus" @click="openCreate">新增规则</el-button>
      </template>

      <template #search>
        <el-form-item label="关键词">
          <el-input v-model="query.keyword" placeholder="搜索规则名称 / 编码" clearable style="width: 220px">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
        </el-form-item>
        <el-form-item label="数据库类型">
          <el-select v-model="query.dbTypeId" placeholder="全部类型" clearable style="width: 150px">
            <el-option v-for="t in dbTypeOptions" :key="t.id" :label="t.label" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="告警级别">
          <el-select v-model="query.ruleLevel" placeholder="全部级别" clearable style="width: 140px">
            <el-option
              v-for="item in getDictItems('alert_level')"
              :key="item.itemValue"
              :label="item.itemLabel"
              :value="item.itemValue"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="数据来源">
          <el-select v-model="query.dataSource" placeholder="全部来源" clearable style="width: 150px">
            <el-option
              v-for="item in getDictItems('alert_rule_data_source')"
              :key="item.itemValue"
              :label="item.itemLabel"
              :value="item.itemValue"
            />
          </el-select>
        </el-form-item>
      </template>

      <template #col-ruleName="{ row }">
        <div class="rule-name-cell">
          <span class="rule-name">{{ row.ruleName }}</span>
          <span class="rule-code">{{ row.ruleCode }}</span>
        </div>
      </template>

      <template #col-ruleLevel="{ row }">
        <DictTag dict="alert_level" :value="row.ruleLevel" />
      </template>

      <template #col-dataSource="{ row }">
        <DictTag dict="alert_rule_data_source" :value="row.dataSource" effect="plain" />
      </template>

      <template #col-dbVersion="{ row }">
        {{ row.dbVersion || '全部版本' }}
      </template>

      <template #col-condition="{ row }">
        <span v-if="row.conditionDisplay" class="condition-text">{{ row.conditionDisplay }}</span>
        <el-tooltip v-else-if="row.dataSource === 'target_sql'" :content="row.customSql || ''" placement="top">
          <span class="condition-text">SQL 结果 {{ row.operator }} {{ row.threshold }}{{ row.unit || '' }}</span>
        </el-tooltip>
        <span v-else class="condition-text">
          {{ row.metricName || '-' }} {{ row.operator }} {{ row.threshold }}{{ row.unit || '' }}
        </span>
      </template>

      <template #col-scanIntervalMin="{ row }">
        {{ row.scanIntervalMin ? `每 ${row.scanIntervalMin} 分钟` : '-' }}
      </template>

      <template #operation="{ row, confirmDelete }">
        <el-button v-permission="'builtin_rule:update'" link type="primary" size="small" @click="openEdit(row as AlertRuleVo)">编辑</el-button>
        <el-button v-permission="'builtin_rule:delete'" link type="danger" size="small" @click="confirmDelete(row)">删除</el-button>
      </template>
    </ProTable>

    <CrudDrawer
      ref="drawerRef"
      :visible="drawerVisible"
      type="drawer"
      :mode="form.id ? 'edit' : 'create'"
      title="内置规则"
      size="640px"
      :form-ref="formRef"
      :confirm-on-save="false"
      @update:visible="drawerVisible = $event"
      @save="submit"
      @closed="resetForm"
    >
      <template #default>
        <div class="drawer-body">
          <el-form ref="formRef" :model="form" :rules="rules" label-width="96px">
            <!-- 基础信息 -->
            <div class="section-title">基础信息</div>
            <el-row :gutter="16">
              <el-col :span="14">
                <el-form-item label="规则名称" prop="ruleName">
                  <el-input v-model="form.ruleName" placeholder="请输入规则名称" maxlength="50" show-word-limit />
                </el-form-item>
              </el-col>
              <el-col :span="10">
                <el-form-item label="告警级别" prop="ruleLevel">
                  <el-select v-model="form.ruleLevel" style="width: 100%">
                    <el-option
                      v-for="item in getDictItems('alert_level')"
                      :key="item.itemValue"
                      :label="item.itemLabel"
                      :value="item.itemValue"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="规则编码" prop="ruleCode">
              <el-input
                v-model="form.ruleCode"
                :disabled="!!form.id"
                placeholder="全局唯一，如 mysql.security.empty_password（保存后不可修改）"
              />
            </el-form-item>
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="数据库类型" prop="dbTypeId">
                  <el-select v-model="form.dbTypeId" style="width: 100%" @change="onDbTypeChange">
                    <el-option v-for="t in dbTypeOptions" :key="t.id" :label="t.label" :value="t.id" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="适用版本">
                  <el-select
                    v-model="form.dbVersionIds"
                    multiple
                    collapse-tags
                    style="width: 100%"
                    placeholder="不选表示全部版本"
                  >
                    <el-option v-for="v in versionOptions" :key="v.id" :label="v.label" :value="v.id" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="描述">
              <el-input
                v-model="form.description"
                type="textarea"
                :rows="2"
                placeholder="简要描述规则用途和触发场景"
                maxlength="200"
                show-word-limit
              />
            </el-form-item>
            <el-form-item label="扫描间隔" prop="scanIntervalMin">
              <el-select v-model="form.scanIntervalMin" style="width: 220px">
                <el-option v-for="item in intervalOptions" :key="item" :label="`每 ${item} 分钟`" :value="item" />
              </el-select>
              <span v-if="form.dataSource === 'target_sql'" class="hint-after">目标库 SQL 规则建议 5 分钟及以上，降低目标库压力</span>
            </el-form-item>

            <!-- 数据来源 -->
            <div class="section-title">数据来源</div>
            <el-form-item label="评估方式" prop="dataSource">
              <el-radio-group v-model="form.dataSource">
                <el-radio value="metric">
                  <span class="mode-label">{{ getDictLabel('alert_rule_data_source', 'metric') }}</span>
                  <span class="mode-hint">基于已采集入库的指标数据评估（推荐）</span>
                </el-radio>
                <el-radio value="target_sql" style="margin-top: 6px">
                  <span class="mode-label">{{ getDictLabel('alert_rule_data_source', 'target_sql') }}</span>
                  <span class="mode-hint">直连被监控数据库执行只读 SQL 评估（存在性/合规巡检类）</span>
                </el-radio>
              </el-radio-group>
            </el-form-item>

            <!-- 产品库指标模式 -->
            <template v-if="form.dataSource === 'metric'">
              <el-form-item label="监控指标" prop="metricName">
                <el-select v-model="form.metricName" filterable style="width: 100%" placeholder="选择指标" @change="onMetricChange">
                  <el-option
                    v-for="m in metricOptions"
                    :key="m.metricCode"
                    :label="`${m.metricName || m.metricCode}（${m.metricCode}）`"
                    :value="m.metricCode"
                  />
                </el-select>
              </el-form-item>
            </template>

            <!-- 目标库 SQL 模式 -->
            <template v-if="form.dataSource === 'target_sql'">
              <el-form-item label="结果模式" prop="resultMode">
                <el-radio-group v-model="form.resultMode">
                  <el-radio value="single">
                    <span class="mode-label">单值模式</span>
                    <span class="mode-hint">SQL 返回一个聚合数值，如 COUNT(*)</span>
                  </el-radio>
                  <el-radio value="multi" style="margin-top: 6px">
                    <span class="mode-label">多行模式</span>
                    <span class="mode-hint">SQL 返回多行，每行代表一个监控实体</span>
                  </el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="查询语句" prop="customSql">
                <el-input v-model="form.customSql" type="textarea" :rows="7" :placeholder="sqlPlaceholder" class="sql-input" />
              </el-form-item>
              <el-form-item v-if="form.resultMode === 'single'" label="返回值字段">
                <el-input v-model="form.sqlReturnField" placeholder="如 cnt（留空取第一列）" style="width: 260px" />
              </el-form-item>
              <template v-if="form.resultMode === 'multi'">
                <el-row :gutter="16">
                  <el-col :span="12">
                    <el-form-item label="实体标识列" prop="entityColumn">
                      <el-input v-model="form.entityColumn" placeholder="如 user_name" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="数值列" prop="valueColumn">
                      <el-input v-model="form.valueColumn" placeholder="如 cnt" />
                    </el-form-item>
                  </el-col>
                </el-row>
                <el-form-item label="消息模板">
                  <el-input v-model="form.displayTemplate" placeholder="如 账号{dimensionKey}存在风险，当前值{triggerValue}" />
                </el-form-item>
              </template>
              <el-alert type="warning" :closable="false" style="margin-bottom: 12px">
                <template #title>SQL 在被监控库的只读采集账号下执行；需按数据库版本差异分别建规则（可在「适用版本」中限定）</template>
              </el-alert>
            </template>

            <!-- 触发条件 -->
            <div class="section-title">触发条件</div>
            <el-form-item label="布尔型规则">
              <el-switch v-model="form.booleanCondition" />
              <span class="hint-after">指标为 0/1 状态值（如线程停止）：实例侧锁定条件编辑，列表与告警消息按状态化文案展示</span>
            </el-form-item>
            <el-form-item label="条件" prop="operator">
              <el-row :gutter="8" style="width: 100%">
                <el-col :span="7">
                  <el-select v-model="form.operator" style="width: 100%">
                    <el-option label="大于 >" value=">" />
                    <el-option label="大于等于 >=" value=">=" />
                    <el-option label="小于 <" value="<" />
                    <el-option label="小于等于 <=" value="<=" />
                    <el-option label="等于 =" value="=" />
                    <el-option label="不等于 !=" value="!=" />
                  </el-select>
                </el-col>
                <el-col :span="7">
                  <el-input-number v-model="form.threshold" controls-position="right" style="width: 100%" placeholder="阈值" />
                </el-col>
                <el-col :span="4">
                  <el-input v-model="form.unit" placeholder="单位" />
                </el-col>
                <el-col :span="6" style="display: flex; align-items: center; gap: 4px">
                  <span class="hint-text">持续</span>
                  <el-input-number v-model="form.duration" :min="0" :step="60" controls-position="right" style="width: 96px" />
                  <span class="hint-text">秒</span>
                </el-col>
              </el-row>
            </el-form-item>
            <el-form-item v-if="form.booleanCondition" label="触发描述">
              <el-input
                v-model="form.conditionDisplay"
                placeholder="如：检测到复制 IO 线程停止（Slave_IO_Running = No）时立即触发"
                maxlength="100"
                show-word-limit
              />
            </el-form-item>

            <!-- 恢复条件 -->
            <div class="section-title">恢复条件</div>
            <el-form-item label="恢复阈值">
              <el-row :gutter="8" style="width: 100%">
                <el-col :span="7">
                  <el-select v-model="form.recoveryOperator" clearable style="width: 100%" placeholder="留空按触发反义">
                    <el-option label="小于 <" value="<" />
                    <el-option label="小于等于 <=" value="<=" />
                    <el-option label="大于 >" value=">" />
                    <el-option label="大于等于 >=" value=">=" />
                  </el-select>
                </el-col>
                <el-col :span="7">
                  <el-input-number v-model="form.recoveryThreshold" controls-position="right" style="width: 100%" placeholder="恢复阈值" />
                </el-col>
                <el-col :span="10">
                  <span class="hint-inline">留空则以触发条件的反义作为恢复条件</span>
                </el-col>
              </el-row>
            </el-form-item>
            <el-form-item v-if="form.booleanCondition" label="恢复描述">
              <el-input
                v-model="form.recoveryDisplay"
                placeholder="如：复制 IO 线程恢复运行（Slave_IO_Running = Yes）时自动恢复"
                maxlength="100"
                show-word-limit
              />
            </el-form-item>

            <!-- 通知默认值 -->
            <div class="section-title">默认通知设置（各实例可单独覆盖）</div>
            <el-form-item label="通知时机">
              <el-checkbox v-model="form.notifyOnTrigger">触发时通知</el-checkbox>
              <el-checkbox v-model="form.notifyOnRecovery" style="margin-left: 16px">恢复时通知</el-checkbox>
            </el-form-item>
            <el-form-item label="通知渠道">
              <el-checkbox v-model="form.channelEmail">邮件</el-checkbox>
              <el-checkbox v-model="form.channelSms" style="margin-left: 16px">短信</el-checkbox>
              <el-checkbox v-model="form.channelWebhook" style="margin-left: 16px">Webhook</el-checkbox>
              <el-checkbox v-model="form.channelDingtalk" style="margin-left: 16px">钉钉机器人</el-checkbox>
              <el-checkbox v-model="form.channelWecom" style="margin-left: 16px">企业微信机器人</el-checkbox>
              <el-checkbox v-model="form.channelFeishu" style="margin-left: 16px">飞书机器人</el-checkbox>
            </el-form-item>
            <el-form-item label="静默期">
              <el-input-number v-model="form.silencePeriod" :min="0" :max="1440" controls-position="right" style="width: 160px" />
              <span class="hint-after">分钟（同规则静默期内不重复通知）</span>
            </el-form-item>

            <el-alert type="info" :closable="false" style="margin-top: 4px">
              <template #title>模板保存后默认对各实例停用，需在「预警管理」中按实例启用；已有实例覆盖的阈值不受模板修改影响</template>
            </el-alert>
          </el-form>
        </div>
      </template>
    </CrudDrawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import ProTable from '@/components/ProTable/index.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { CrudDrawer } from '@/components/ProTable'
import DictTag from '@/components/DictTag.vue'
import { useDict } from '@/composables/useDict'
import { listDbTypes } from '@/api/db-type'
import {
  pageBuiltinRules,
  createBuiltinRule,
  updateBuiltinRule,
  deleteBuiltinRule,
  listMetricDefinitions,
  type MetricDefinitionOption
} from '@/api/builtin-rule'
import type { AlertRuleVo, BuiltinRuleSaveRequest, RuleDataSource, ResultMode } from '@/types/alert'
import type { DbTypeOption } from '@/types'
import { validateQueryOnlySql } from '@/utils/sqlSafety'

const { getDictItems, getDictLabel } = useDict('alert_level', 'alert_rule_data_source')

const columns: TableColumn[] = [
  { prop: 'ruleName', label: '规则名称', minWidth: 220, slot: 'col-ruleName' },
  { prop: 'dbType', label: '数据库类型', width: 110 },
  { prop: 'dbVersion', label: '适用版本', width: 110, slot: 'col-dbVersion' },
  { prop: 'ruleLevel', label: '级别', width: 90, align: 'center', slot: 'col-ruleLevel' },
  { prop: 'dataSource', label: '数据来源', width: 110, align: 'center', slot: 'col-dataSource' },
  { label: '触发条件', minWidth: 220, slot: 'col-condition' },
  { prop: 'scanIntervalMin', label: '扫描间隔', width: 100, slot: 'col-scanIntervalMin' },
  { prop: 'enabledInstanceCount', label: '启用实例数', width: 100, align: 'center' },
  { prop: 'updatedAt', label: '更新时间', width: 160 }
]

// ===== 列表 =====
const list = ref<AlertRuleVo[]>([])
const loading = ref(false)
const total = ref(0)
const query = reactive({
  pageNum: 1,
  pageSize: 10,
  keyword: '',
  dbTypeId: undefined as number | undefined,
  ruleLevel: '',
  dataSource: undefined as RuleDataSource | undefined
})

async function load() {
  loading.value = true
  try {
    const res = await pageBuiltinRules({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      dbTypeId: query.dbTypeId,
      ruleLevel: query.ruleLevel || undefined,
      dataSource: query.dataSource
    })
    list.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function search() {
  query.pageNum = 1
  load()
}

function reset() {
  query.keyword = ''
  query.dbTypeId = undefined
  query.ruleLevel = ''
  query.dataSource = undefined
  search()
}

async function remove(row: AlertRuleVo) {
  await deleteBuiltinRule(row.ruleCode)
  load()
}

// ===== 数据库类型 / 版本选项 =====
const dbTypeOptions = ref<DbTypeOption[]>([])

const versionOptions = computed(
  () => dbTypeOptions.value.find((t) => t.id === form.dbTypeId)?.versions ?? []
)

function onDbTypeChange() {
  form.dbVersionIds = []
  form.metricName = ''
  loadMetricOptions()
}

// ===== 指标选项（metric 模式） =====
const metricOptions = ref<MetricDefinitionOption[]>([])

async function loadMetricOptions() {
  const type = dbTypeOptions.value.find((t) => t.id === form.dbTypeId)
  if (!type) {
    metricOptions.value = []
    return
  }
  const all = await listMetricDefinitions(type.code.toLowerCase())
  metricOptions.value = all.filter((m) => m.valueType === 'numeric' && m.enabled !== false)
}

function onMetricChange(code: string) {
  const def = metricOptions.value.find((m) => m.metricCode === code)
  if (def?.unit) {
    form.unit = def.unit
  }
}

// ===== 新增/编辑 =====
const drawerVisible = ref(false)
const drawerRef = ref<{ stopSaving: (close?: boolean) => void } | null>(null)
const formRef = ref<FormInstance>()

interface FormState {
  id: number | undefined
  ruleCode: string
  ruleName: string
  ruleLevel: string
  dbTypeId: number | undefined
  dbVersionIds: number[]
  description: string
  dataSource: RuleDataSource
  metricName: string
  scanIntervalMin: number
  operator: string
  threshold: number | null
  unit: string
  duration: number
  customSql: string
  resultMode: ResultMode
  sqlReturnField: string
  entityColumn: string
  valueColumn: string
  displayTemplate: string
  recoveryOperator: string
  recoveryThreshold: number | null
  notifyOnTrigger: boolean
  notifyOnRecovery: boolean
  channelEmail: boolean
  channelSms: boolean
  channelWebhook: boolean
  channelDingtalk: boolean
  channelWecom: boolean
  channelFeishu: boolean
  silencePeriod: number
  /** 布尔型（状态类）规则：实例侧锁定条件编辑，页面按状态化文案展示 */
  booleanCondition: boolean
  conditionDisplay: string
  recoveryDisplay: string
}

const defaultForm = (): FormState => ({
  id: undefined,
  ruleCode: '',
  ruleName: '',
  ruleLevel: 'level_3',
  dbTypeId: undefined,
  dbVersionIds: [],
  description: '',
  dataSource: 'metric',
  metricName: '',
  scanIntervalMin: 5,
  operator: '>',
  threshold: null,
  unit: '',
  duration: 0,
  customSql: '',
  resultMode: 'single',
  sqlReturnField: '',
  entityColumn: '',
  valueColumn: '',
  displayTemplate: '',
  recoveryOperator: '',
  recoveryThreshold: null,
  notifyOnTrigger: true,
  notifyOnRecovery: true,
  channelEmail: true,
  channelSms: false,
  channelWebhook: false,
  channelDingtalk: false,
  channelWecom: false,
  channelFeishu: false,
  silencePeriod: 0,
  booleanCondition: false,
  conditionDisplay: '',
  recoveryDisplay: ''
})

const form = reactive<FormState>(defaultForm())

const intervalOptions = [1, 2, 5, 10, 15, 30, 60, 120, 360, 720, 1440]

const sqlPlaceholder = `目标库 SQL 示例（只读 SELECT）：
-- 单值：空密码账号数
SELECT COUNT(*) AS cnt
FROM mysql.user
WHERE authentication_string = ''`

const rules: FormRules = {
  ruleName: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  ruleCode: [{ required: true, message: '请输入规则编码', trigger: 'blur' }],
  ruleLevel: [{ required: true, message: '请选择告警级别', trigger: 'change' }],
  dbTypeId: [{ required: true, message: '请选择数据库类型', trigger: 'change' }],
  dataSource: [{ required: true, message: '请选择评估方式', trigger: 'change' }],
  scanIntervalMin: [{ required: true, message: '请选择扫描间隔', trigger: 'change' }],
  operator: [{ required: true, message: '请选择运算符', trigger: 'change' }],
  metricName: [
    {
      trigger: 'change',
      validator: (_: unknown, __: unknown, cb: (e?: Error) => void) => {
        if (form.dataSource === 'metric' && !form.metricName) {
          cb(new Error('请选择监控指标'))
        } else {
          cb()
        }
      }
    }
  ],
  customSql: [
    {
      trigger: 'blur',
      validator: (_: unknown, __: unknown, cb: (e?: Error) => void) => {
        if (form.dataSource !== 'target_sql') {
          cb()
          return
        }
        try {
          const dbType = dbTypeOptions.value.find((type) => type.id === form.dbTypeId)?.code
          validateQueryOnlySql(form.customSql, dbType)
          cb()
        } catch (e) {
          cb(e instanceof Error ? e : new Error('SQL 校验失败'))
        }
      }
    }
  ]
}

function openCreate() {
  Object.assign(form, defaultForm())
  drawerVisible.value = true
  loadMetricOptions()
}

function openEdit(row: AlertRuleVo) {
  Object.assign(form, defaultForm(), {
    id: row.id,
    ruleCode: row.ruleCode,
    ruleName: row.ruleName,
    ruleLevel: row.ruleLevel,
    dbTypeId: row.dbTypeId ?? undefined,
    dbVersionIds: row.dbVersionIds ?? [],
    description: row.description ?? '',
    dataSource: (row.dataSource ?? 'metric') as RuleDataSource,
    metricName: row.metricName ?? '',
    scanIntervalMin: row.scanIntervalMin ?? 5,
    operator: row.operator ?? '>',
    threshold: row.threshold ?? null,
    unit: row.unit ?? '',
    duration: row.duration ?? 0,
    customSql: row.customSql ?? '',
    resultMode: row.resultMode ?? 'single',
    sqlReturnField: row.sqlReturnField ?? '',
    entityColumn: row.entityColumn ?? '',
    valueColumn: row.valueColumn ?? '',
    displayTemplate: row.displayTemplate ?? '',
    recoveryOperator: row.recoveryOperator ?? '',
    recoveryThreshold: row.recoveryThreshold ?? null,
    notifyOnTrigger: row.notifyOnTrigger ?? true,
    notifyOnRecovery: row.notifyOnRecovery ?? true,
    channelEmail: row.channelEmail ?? true,
    channelSms: row.channelSms ?? false,
    channelWebhook: row.channelWebhook ?? false,
    channelDingtalk: row.channelDingtalk ?? false,
    channelWecom: row.channelWecom ?? false,
    channelFeishu: row.channelFeishu ?? false,
    silencePeriod: row.silencePeriod ?? 0,
    booleanCondition: !!row.conditionLocked,
    conditionDisplay: row.conditionDisplay ?? '',
    recoveryDisplay: row.recoveryDisplay ?? ''
  })
  drawerVisible.value = true
  loadMetricOptions()
}

function resetForm() {
  Object.assign(form, defaultForm())
  formRef.value?.clearValidate()
}

async function submit() {
  await formRef.value?.validate()
  if (form.threshold === null || form.threshold === undefined) {
    ElMessage.warning('请填写触发阈值')
    drawerRef.value?.stopSaving(false)
    return
  }
  const req: BuiltinRuleSaveRequest = {
    id: form.id,
    ruleCode: form.ruleCode.trim(),
    ruleName: form.ruleName.trim(),
    ruleLevel: form.ruleLevel,
    dbTypeId: form.dbTypeId!,
    dbVersionIds: form.dbVersionIds.length ? form.dbVersionIds : undefined,
    description: form.description || undefined,
    dataSource: form.dataSource,
    scanIntervalMin: form.scanIntervalMin,
    operator: form.operator,
    threshold: form.threshold,
    unit: form.unit || undefined,
    duration: form.duration,
    recoveryOperator: form.recoveryOperator || undefined,
    recoveryThreshold: form.recoveryThreshold ?? undefined,
    booleanCondition: form.booleanCondition,
    conditionDisplay: form.booleanCondition ? (form.conditionDisplay || undefined) : undefined,
    recoveryDisplay: form.booleanCondition ? (form.recoveryDisplay || undefined) : undefined,
    notifyOnTrigger: form.notifyOnTrigger,
    notifyOnRecovery: form.notifyOnRecovery,
    channelEmail: form.channelEmail,
    channelSms: form.channelSms,
    channelWebhook: form.channelWebhook,
    channelDingtalk: form.channelDingtalk,
    channelWecom: form.channelWecom,
    channelFeishu: form.channelFeishu,
    silencePeriod: form.silencePeriod
  }
  if (form.dataSource === 'metric') {
    req.metricName = form.metricName
  } else {
    req.customSql = form.customSql
    req.resultMode = form.resultMode
    if (form.resultMode === 'single') {
      req.sqlReturnField = form.sqlReturnField || undefined
    } else {
      req.entityColumn = form.entityColumn || undefined
      req.valueColumn = form.valueColumn || undefined
      req.displayTemplate = form.displayTemplate || undefined
    }
  }
  try {
    if (form.id) {
      await updateBuiltinRule(req)
    } else {
      await createBuiltinRule(req)
    }
    ElMessage.success('保存成功')
    drawerRef.value?.stopSaving(true)
    load()
  } catch {
    drawerRef.value?.stopSaving(false)
  }
}

onMounted(async () => {
  dbTypeOptions.value = await listDbTypes()
  load()
})
</script>

<style scoped>
.rule-name-cell {
  display: flex;
  flex-direction: column;
  line-height: 1.4;
}
.rule-name {
  color: var(--ink, #303133);
}
.rule-code {
  font-size: 12px;
  color: var(--muted, #909399);
}
.condition-text {
  font-size: 13px;
}
.drawer-body {
  padding: 0 4px;
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  padding: 8px 0 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  margin-bottom: 16px;
}
.mode-label {
  font-weight: 500;
  margin-right: 4px;
}
.mode-hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.sql-input :deep(textarea) {
  font-family: ui-monospace, monospace;
  font-size: 13px;
}
.hint-text {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
.hint-inline {
  line-height: 32px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.hint-after {
  margin-left: 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
