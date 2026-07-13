<template>
  <CrudDrawer
    ref="drawerRef"
    :visible="visible"
    type="drawer"
    :mode="form.id ? 'edit' : 'create'"
    title="自定义规则"
    size="620px"
    :form-ref="formRef"
    :confirm-on-save="false"
    @update:visible="emit('update:visible', $event)"
    @save="onDrawerSave"
    @closed="resetForm"
  >
    <template #default>
      <div class="drawer-body">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
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
          <el-option
            v-for="item in intervalOptions"
            :key="item"
            :label="`每 ${item} 分钟`"
            :value="item"
          />
        </el-select>
        <span class="hint-after">最小可配 {{ minAllowedIntervalMin }} 分钟（由依赖指标采样频率决定）</span>
      </el-form-item>

      <!-- SQL 查询 -->
      <div class="section-title">SQL 查询</div>
      <el-form-item label="结果模式" prop="resultMode">
        <el-radio-group v-model="form.resultMode">
          <el-radio value="single">
            <span class="mode-label">单值模式</span>
            <span class="mode-hint">SQL 返回一个聚合数值，如 COUNT(*)、AVG()</span>
          </el-radio>
          <el-radio value="multi" style="margin-top: 6px">
            <span class="mode-label">多行模式</span>
            <span class="mode-hint">SQL 返回多行，每行代表一个监控实体（如磁盘、用户、表）</span>
          </el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="查询语句" prop="customSql">
        <el-input
          v-model="form.customSql"
          type="textarea"
          :rows="7"
          :placeholder="sqlPlaceholder"
          class="sql-input"
        />
      </el-form-item>
      <el-form-item v-if="form.resultMode === 'multi'" label="消息模板">
        <el-input
          v-model="form.displayTemplate"
          placeholder="如 磁盘{disk_name}使用率达到{used_pct}，超过{thresholdValue}预设阈值"
        />
      </el-form-item>

      <!-- 单值模式 -->
      <el-row v-if="form.resultMode === 'single'" :gutter="16">
        <el-col :span="12">
          <el-form-item label="返回值字段">
            <el-input v-model="form.sqlReturnField" placeholder="如 cnt、used_pct" />
            <div class="field-hint">用于与告警阈值比较的数值列名</div>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="执行间隔">
            <el-select v-model="form.scanIntervalMin" style="width: 100%">
              <el-option
                v-for="item in intervalOptions"
                :key="`single-${item}`"
                :label="`每 ${item} 分钟`"
                :value="item"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <!-- 多行模式 -->
      <template v-if="form.resultMode === 'multi'">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="实体标识列" prop="entityColumn">
              <el-input v-model="form.entityColumn" placeholder="如 disk_name、username" />
              <div class="field-hint">唯一标识监控对象的列名，可用逗号分隔多列</div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="数值列" prop="valueColumn">
              <el-input v-model="form.valueColumn" placeholder="如 used_pct、days_left" />
              <div class="field-hint">用于与告警阈值比较的数值列名</div>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="10" :offset="14">
            <el-form-item label="执行间隔">
              <el-select v-model="form.scanIntervalMin" style="width: 100%">
                <el-option
                  v-for="item in intervalOptions"
                  :key="`multi-${item}`"
                  :label="`每 ${item} 分钟`"
                  :value="item"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-alert type="info" :closable="false" style="margin-bottom: 8px">
          <template #default>
            <strong>多行模式行为</strong>：每次执行后对每行数值列分别与阈值比较；每个触发实体单独产生一条告警；当值满足恢复条件时自动恢复，互不影响。
          </template>
        </el-alert>
      </template>

      <el-alert type="warning" :closable="false" style="margin-bottom: 8px">
        <template #title>SQL 在只读账号下执行，不得含修改操作；建议添加时间范围条件避免全表扫描</template>
      </el-alert>

      <!-- 触发条件 -->
      <div class="section-title">触发条件</div>
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
            <el-input-number
              v-model="form.threshold"
              controls-position="right"
              style="width: 100%"
              placeholder="阈值"
            />
          </el-col>
          <el-col :span="10" style="display: flex; align-items: center; gap: 4px">
            <span class="hint-text">持续</span>
            <el-input-number
              v-model="form.duration"
              :min="0"
              :step="60"
              controls-position="right"
              style="width: 112px"
            />
            <span class="hint-text">秒</span>
          </el-col>
        </el-row>
      </el-form-item>

      <!-- 恢复条件 -->
      <div class="section-title">恢复条件</div>
      <el-form-item label="恢复阈值">
        <el-row :gutter="8" style="width: 100%">
          <el-col :span="7">
            <el-select v-model="form.recoveryOperator" style="width: 100%">
              <el-option label="小于 <" value="<" />
              <el-option label="小于等于 <=" value="<=" />
              <el-option label="大于 >" value=">" />
              <el-option label="大于等于 >=" value=">=" />
            </el-select>
          </el-col>
          <el-col :span="7">
            <el-input-number
              v-model="form.recoveryThreshold"
              controls-position="right"
              style="width: 100%"
              placeholder="恢复阈值"
            />
          </el-col>
          <el-col :span="10">
            <span class="hint-inline">与触发条件单位一致</span>
          </el-col>
        </el-row>
      </el-form-item>

      <!-- 通知设置 -->
      <div class="section-title">通知设置</div>
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
      <el-form-item
        v-if="form.channelWebhook || form.channelDingtalk || form.channelWecom || form.channelFeishu"
        label=" "
      >
        <span class="hint-after">Webhook/机器人地址与签名密钥在「系统管理 → 通知通道」统一配置</span>
      </el-form-item>
      <el-form-item label="静默期">
        <el-input-number
          v-model="form.silencePeriod"
          :min="0"
          :max="1440"
          controls-position="right"
          style="width: 160px"
        />
        <span class="hint-after">分钟（同规则静默期内不重复通知）</span>
      </el-form-item>

      <!-- 其他 -->
      <div class="section-title">其他</div>
      <el-form-item label="启用">
        <el-switch v-model="form.enabled" />
        <span class="hint-after">{{ form.enabled ? '保存后立即生效' : '保存后不启用' }}</span>
      </el-form-item>
    </el-form>
      </div>
    </template>
  </CrudDrawer>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { saveAlertRule } from '@/api/alert'
import type { AlertRuleVo, AlertRuleSaveRequest } from '@/types/alert'
import { useDict } from '@/composables/useDict'
import { CrudDrawer } from '@/components/ProTable'
import type { DrawerMode } from '@/components/ProTable'
import { validateQueryOnlySql } from '@/utils/sqlSafety'

const { getDictItems } = useDict('alert_level')

const props = defineProps<{
  visible: boolean
  rule: AlertRuleVo | null
  instanceId?: number
  dbType?: string
}>()

const emit = defineEmits<{
  'update:visible': [v: boolean]
  saved: []
}>()

interface FormState {
  id: number | undefined
  ruleCode: string
  ruleName: string
  ruleLevel: string
  description: string
  customSql: string
  scanIntervalMin: number
  resultMode: 'single' | 'multi'
  sqlReturnField: string
  entityColumn: string
  valueColumn: string
  displayTemplate: string
  operator: string
  threshold: number | null
  duration: number
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
  enabled: boolean
}

const defaultForm = (): FormState => ({
  id: undefined,
  ruleCode: '',
  ruleName: '',
  ruleLevel: 'level_3',
  description: '',
  customSql: '',
  scanIntervalMin: 1,
  resultMode: 'single',
  sqlReturnField: '',
  entityColumn: '',
  valueColumn: '',
  displayTemplate: '',
  operator: '>',
  threshold: null,
  duration: 0,
  recoveryOperator: '<',
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
  enabled: true,
})

const form = reactive<FormState>(defaultForm())
const formRef = ref<FormInstance>()
const drawerRef = ref<{ stopSaving: (close?: boolean) => void } | null>(null)

const sqlPlaceholder = computed(() =>
  form.resultMode === 'single'
    ? `单值模式示例（返回一个聚合数值）：\nSELECT COUNT(*) AS cnt\nFROM information_schema.processlist\nWHERE TIME > 60 AND COMMAND != 'Sleep'`
    : `多行模式示例（每行代表一个实体）：\n-- 磁盘使用率\nSELECT disk_name, used_gb, total_gb,\n  ROUND(used_gb/total_gb*100, 1) AS used_pct\nFROM disk_usage`
)

const rules: FormRules = {
  ruleName: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  ruleLevel: [{ required: true, message: '请选择告警级别', trigger: 'change' }],
  customSql: [
    {
      required: true,
      trigger: 'blur',
      validator: (_: unknown, value: unknown, cb: (e?: Error) => void) => {
        try {
          validateQueryOnlySql(String(value ?? ''), props.dbType)
          cb()
        } catch (e) {
          cb(e instanceof Error ? e : new Error('SQL 校验失败'))
        }
      },
    },
  ],
  scanIntervalMin: [{ required: true, message: '请选择扫描间隔', trigger: 'change' }],
  resultMode: [{ required: true, message: '请选择结果模式', trigger: 'change' }],
  operator: [{ required: true, message: '请选择运算符', trigger: 'change' }],
  entityColumn: [
    {
      required: true,
      message: '请输入实体标识列',
      trigger: 'blur',
      validator: (_: unknown, __: unknown, cb: (e?: Error) => void) => {
        if (form.resultMode === 'multi' && !form.entityColumn.trim()) {
          cb(new Error('请输入实体标识列'))
        } else {
          cb()
        }
      },
    },
  ],
  valueColumn: [
    {
      required: true,
      message: '请输入数值列',
      trigger: 'blur',
      validator: (_: unknown, __: unknown, cb: (e?: Error) => void) => {
        if (form.resultMode === 'multi' && !form.valueColumn.trim()) {
          cb(new Error('请输入数值列'))
        } else {
          cb()
        }
      },
    },
  ],
}

const minAllowedIntervalMin = computed(() => Math.max(1, props.rule?.minAllowedIntervalMin ?? 1))
const intervalOptions = computed(() => buildIntervalOptions(minAllowedIntervalMin.value))

watch(
  () => props.visible,
  (v) => {
    if (v && props.rule) {
      Object.assign(form, {
        id: props.rule.id || undefined,
        ruleCode: props.rule.ruleCode ?? '',
        ruleName: props.rule.ruleName,
        ruleLevel: props.rule.ruleLevel,
        description: props.rule.description ?? '',
        customSql: props.rule.customSql ?? '',
        scanIntervalMin: props.rule.scanIntervalMin ?? Math.max(1, props.rule.minAllowedIntervalMin ?? 1),
        resultMode: props.rule.resultMode ?? 'single',
        sqlReturnField: props.rule.sqlReturnField ?? '',
        entityColumn: props.rule.entityColumn ?? '',
        valueColumn: props.rule.valueColumn ?? '',
        displayTemplate: props.rule.displayTemplate ?? '',
        operator: props.rule.operator ?? '>',
        threshold: props.rule.threshold ?? null,
        duration: props.rule.duration ?? 0,
        recoveryOperator: props.rule.recoveryOperator ?? '<',
        recoveryThreshold: props.rule.recoveryThreshold ?? null,
        notifyOnTrigger: props.rule.notifyOnTrigger ?? true,
        notifyOnRecovery: props.rule.notifyOnRecovery ?? true,
        channelEmail: props.rule.channelEmail ?? true,
        channelSms: props.rule.channelSms ?? false,
        channelWebhook: props.rule.channelWebhook ?? false,
        channelDingtalk: props.rule.channelDingtalk ?? false,
        channelWecom: props.rule.channelWecom ?? false,
        channelFeishu: props.rule.channelFeishu ?? false,
        silencePeriod: props.rule.silencePeriod ?? 0,
        enabled: props.rule.instanceEnabled,
      })
    }
  },
  { immediate: true }
)

function resetForm() {
  Object.assign(form, defaultForm())
  formRef.value?.clearValidate()
}

async function onDrawerSave(_mode: DrawerMode) {
  try {
    validateQueryOnlySql(form.customSql, props.dbType)
    const req: AlertRuleSaveRequest = {
      id: form.id,
      ruleCode: form.ruleCode || undefined,
      instanceId: props.instanceId,
      ruleName: form.ruleName,
      ruleType: 'custom',
      ruleLevel: form.ruleLevel as any,
      description: form.description,
      operator: form.operator,
      threshold: form.threshold ?? undefined,
      duration: form.duration,
      recoveryOperator: form.recoveryOperator,
      recoveryThreshold: form.recoveryThreshold ?? undefined,
      customSql: form.customSql,
      scanIntervalMin: form.scanIntervalMin,
      resultMode: form.resultMode,
      sqlReturnField: form.resultMode === 'single' ? form.sqlReturnField : undefined,
      entityColumn: form.resultMode === 'multi' ? form.entityColumn : undefined,
      valueColumn: form.resultMode === 'multi' ? form.valueColumn : undefined,
      displayTemplate: form.resultMode === 'multi' ? (form.displayTemplate || undefined) : undefined,
      notifyOnTrigger: form.notifyOnTrigger,
      notifyOnRecovery: form.notifyOnRecovery,
      channelEmail: form.channelEmail,
      channelSms: form.channelSms,
      channelWebhook: form.channelWebhook,
      channelDingtalk: form.channelDingtalk,
      channelWecom: form.channelWecom,
      channelFeishu: form.channelFeishu,
      silencePeriod: form.silencePeriod,
      enabled: form.enabled,
    }
    await saveAlertRule(req)
    ElMessage.success('保存成功')
    drawerRef.value?.stopSaving(true)
    emit('saved')
  } catch {
    drawerRef.value?.stopSaving(false)
    ElMessage.error('保存失败，请稍后重试')
  }
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
.drawer-body {
  padding: 0 4px;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 0 0;
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

.field-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  line-height: 1.4;
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

:deep(.el-checkbox__inner) {
  border-radius: 2px;
}
</style>
