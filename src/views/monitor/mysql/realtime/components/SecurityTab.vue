<template>
  <div class="security-tab" v-loading="loading">
    <template v-if="!loading">
      <!-- 概览状态行 -->
      <div class="status-row">
        <div class="status-card">
          <div class="status-label">传输加密（SSL）</div>
          <div class="status-value">
            <el-tag v-if="ssl.enabled === null" type="info" size="small">暂无数据</el-tag>
            <el-tag v-else-if="ssl.enabled" type="success" size="small">已启用</el-tag>
            <el-tag v-else type="warning" size="small">未启用</el-tag>
          </div>
          <div class="status-desc" v-if="ssl.enabled">
            <span v-if="ssl.tlsVersion">协议：{{ ssl.tlsVersion }}</span>
            <span v-if="ssl.certDaysLeft != null" :class="{ 'text-danger': ssl.certDaysLeft <= 30 }">
              证书剩余 {{ ssl.certDaysLeft }} 天
            </span>
          </div>
          <div class="status-desc" v-else-if="ssl.enabled === false">
            连接为明文传输；内网环境常见，如有合规要求请在数据库端配置 SSL 证书
          </div>
        </div>

        <div class="status-card">
          <div class="status-label">暴力破解检测</div>
          <div class="status-value">
            <el-tag v-if="bruteForce === null" type="info" size="small">暂无数据</el-tag>
            <el-tag v-else-if="bruteForce >= 1" type="danger" size="small">疑似攻击</el-tag>
            <el-tag v-else type="success" size="small">正常</el-tag>
          </div>
          <div class="status-desc">
            单一来源每分钟认证失败 ≥ 5 次或合计 ≥ 15 次时判定为疑似
          </div>
        </div>

        <div class="status-card">
          <div class="status-label">来源白名单</div>
          <div class="status-value">
            <el-tag v-if="unknownCount === null" type="info" size="small">未启用</el-tag>
            <el-tag v-else-if="unknownCount > 0" type="danger" size="small">{{ unknownCount }} 个白名单外连接</el-tag>
            <el-tag v-else type="success" size="small">来源全部在白名单内</el-tag>
          </div>
          <div class="status-desc">
            <template v-if="unknownCount === null">
              在「实例管理」编辑实例、配置来源白名单后开始监测
            </template>
            <template v-else>白名单外来源接入会触发告警</template>
          </div>
        </div>

        <div class="status-card">
          <div class="status-label">敏感语句（近1小时）</div>
          <div class="status-value">
            <span class="stat-num" :class="{ 'text-danger': privChangeSum + dangerOpSum > 0 }">
              {{ privChangeSum + dangerOpSum }}
            </span>
          </div>
          <div class="status-desc">权限变更 {{ privChangeSum }} 条 · 危险操作 {{ dangerOpSum }} 条</div>
        </div>
      </div>

      <!-- 认证失败趋势 + 来源明细 -->
      <div class="chart-section">
        <div class="section-title">登录安全</div>
        <div class="chart-grid">
          <TrendChart title="认证失败次数" :data="charts.authFail" color="#E5484D"
            tip="每分钟认证失败（密码错误等）的次数，来自 performance_schema.host_cache 按来源统计；skip_name_resolve 开启时无数据，以「连接失败次数」兜底" />
          <div class="detail-card">
            <div class="detail-title">认证失败来源（最近一分钟）</div>
            <el-table :data="authFailSources" size="small" max-height="200" empty-text="本周期无认证失败">
              <el-table-column prop="ip" label="来源 IP" min-width="140" show-overflow-tooltip />
              <el-table-column prop="delta" label="本周期失败" width="100" align="right" />
              <el-table-column prop="total" label="累计失败" width="100" align="right" />
            </el-table>
          </div>
        </div>
      </div>

      <!-- 白名单外来源 -->
      <div class="chart-section" v-if="unknownCount !== null && unknownSources.length">
        <div class="section-title">白名单外来源明细</div>
        <el-table :data="unknownSources" size="small" max-height="220">
          <el-table-column prop="host" label="来源主机" min-width="140" show-overflow-tooltip />
          <el-table-column prop="user" label="账号" min-width="100" show-overflow-tooltip />
          <el-table-column prop="db" label="数据库" min-width="100" show-overflow-tooltip />
          <el-table-column prop="total" label="连接数" width="90" align="right" />
        </el-table>
      </div>

      <!-- 权限变更与危险操作 -->
      <div class="chart-section">
        <div class="section-title">权限变更与危险操作审计</div>

        <!-- 完整审计（数据库侧审计插件）对接状态 -->
        <el-alert
          v-if="auditPlugin.active"
          type="success"
          :closable="false"
          show-icon
        >
          <template #title>
            已检测到数据库审计插件 <b>{{ auditPlugin.plugin }}</b>（{{ auditPlugin.status }}）：
            完整审计（含执行账号与来源）由插件在数据库服务器侧记录
            <span v-if="auditPlugin.output">，输出：{{ auditPlugin.output }}</span>
            <span v-if="auditPlugin.policy">，策略：{{ auditPlugin.policy }}</span>
          </template>
        </el-alert>
        <el-alert
          v-else-if="auditPlugin.checked"
          type="info"
          :closable="false"
          show-icon
          title="未检测到数据库审计插件，当前为平台轻审计（可发现语句与次数，无法还原执行账号）。有合规级完整审计要求时，可在目标库安装 Percona Audit Log 或 MariaDB Audit Plugin，安装后平台自动识别其状态与配置"
        />

        <el-alert
          v-if="!auditSupported"
          type="info"
          :closable="false"
          show-icon
          title="当前实例版本（MySQL 5.6）不支持语句审计，需 5.7/8.0 的 performance_schema 语句摘要能力"
        />
        <template v-else>
          <div class="chart-grid">
            <TrendChart title="权限变更语句数" :data="charts.privChange" color="#E08600"
              tip="每分钟执行的 GRANT / REVOKE / CREATE USER / DROP USER / ALTER USER 等权限变更语句数，发生即触发提醒" />
            <TrendChart title="危险操作语句数" :data="charts.dangerOp" color="#B91C1C"
              tip="每分钟执行的 DROP / TRUNCATE / 不带 WHERE 的整表 DELETE/UPDATE 语句数，发生即告警" />
          </div>
          <div class="detail-card">
            <div class="detail-title">
              敏感语句明细（最近周期）
              <span class="detail-hint">基于语句指纹的轻审计：可知语句与次数，无法还原执行账号（完整审计需 audit 插件）</span>
            </div>
            <el-table :data="auditEvents" size="small" max-height="240" empty-text="最近周期未检测到敏感语句">
              <el-table-column label="类型" width="100">
                <template #default="{ row }">
                  <el-tag :type="row.type === 'priv' ? 'warning' : 'danger'" size="small">
                    {{ row.type === 'priv' ? '权限变更' : '危险操作' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="text" label="语句（指纹形式）" min-width="300" show-overflow-tooltip />
              <el-table-column prop="schema" label="库" width="110" show-overflow-tooltip />
              <el-table-column prop="count" label="次数" width="70" align="right" />
              <el-table-column prop="lastSeen" label="最近执行" width="160" />
            </el-table>
          </div>
        </template>
      </div>

      <!-- 表级锁 -->
      <div class="chart-section">
        <div class="section-title">表级锁监控</div>
        <div class="chart-grid">
          <TrendChart title="被占用表数量" :data="charts.tableInUse" color="#9B59B6"
            tip="当前正被会话使用/锁定的表数量（SHOW OPEN TABLES In_use > 0）：覆盖 MyISAM 表锁、LOCK TABLES、DDL 等行锁监控看不到的表级锁定" />
          <TrendChart title="表锁等待速率" unit="/s" :data="charts.tableLocksWaited" color="#E5484D"
            tip="每秒发生表锁等待的次数，持续大于 0 说明存在表级锁竞争（常见于 MyISAM 表或显式 LOCK TABLES）" />
        </div>
        <div class="detail-card" v-if="openTables.length">
          <div class="detail-title">当前被占用的表</div>
          <el-table :data="openTables" size="small" max-height="200">
            <el-table-column prop="db" label="数据库" min-width="120" show-overflow-tooltip />
            <el-table-column prop="table" label="表名" min-width="160" show-overflow-tooltip />
            <el-table-column prop="inUse" label="占用会话数" width="110" align="right" />
            <el-table-column label="名字锁定" width="90" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.nameLocked > 0" type="danger" size="small">是</el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import TrendChart from '@/components/TrendChart.vue'
import { getMetricTrend, getMetricLatest, getMetricTextLatest } from '@/api/metric'
import { M } from '@/constants/metrics'
import { useAutoRefresh } from '@/composables/useAutoRefresh'
import { useInstanceStore } from '@/stores/instance'
import type { TrendPoint } from '@/types/monitor'

const props = defineProps<{ instanceId: number }>()

const instanceStore = useInstanceStore()
/** 5.6 不支持语句审计（无 P_S 语句摘要） */
const auditSupported = computed(() => !instanceStore.current?.dbVersion?.startsWith('5.6'))

const loading = ref(false)
const charts = reactive<Record<string, TrendPoint[]>>({
  authFail: [], privChange: [], dangerOp: [], tableInUse: [], tableLocksWaited: []
})

const bruteForce = ref<number | null>(null)
const unknownCount = ref<number | null>(null)

interface SslInfo {
  enabled: boolean | null
  tlsVersion: string
  certDaysLeft: number | null
}
const ssl = reactive<SslInfo>({ enabled: null, tlsVersion: '', certDaysLeft: null })

/** 完整审计（数据库侧审计插件）状态 */
const auditPlugin = reactive<{
  checked: boolean; active: boolean; plugin: string; status: string; output: string; policy: string
}>({ checked: false, active: false, plugin: '', status: '', output: '', policy: '' })

const authFailSources = ref<{ ip: string; delta: number; total: number }[]>([])
const unknownSources = ref<{ host: string; user: string; db: string; total: number }[]>([])
const auditEvents = ref<{ type: string; text: string; schema: string; count: number; lastSeen: string }[]>([])
const openTables = ref<{ db: string; table: string; inUse: number; nameLocked: number }[]>([])

/** 近 1 小时权限变更 / 危险操作合计（趋势点求和） */
const privChangeSum = computed(() => sum(charts.privChange))
const dangerOpSum = computed(() => sum(charts.dangerOp))
function sum(points: TrendPoint[]): number {
  return Math.round(points.reduce((acc, p) => acc + (p.value ?? 0), 0))
}

const TREND_MAP: Record<string, string> = {
  authFail:         M.AUTH_FAIL_DELTA,
  privChange:       M.PRIV_CHANGE_DELTA,
  dangerOp:         M.DANGEROUS_OP_DELTA,
  tableInUse:       M.TABLE_IN_USE_COUNT,
  tableLocksWaited: M.RATE_TABLE_LOCKS_WAITED
}

function parseJson<T>(raw: string | null | undefined): T[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

async function loadLatest() {
  try {
    const res = await getMetricLatest(props.instanceId, [
      M.BRUTE_FORCE_SUSPECT, M.UNKNOWN_SOURCE_COUNT, M.SSL_ENABLED, M.SSL_CERT_DAYS_LEFT
    ])
    const v = res.values ?? {}
    bruteForce.value = v[M.BRUTE_FORCE_SUSPECT] ?? null
    unknownCount.value = v[M.UNKNOWN_SOURCE_COUNT] ?? null
    const sslRaw = v[M.SSL_ENABLED]
    ssl.enabled = sslRaw == null ? null : sslRaw >= 1
    ssl.certDaysLeft = v[M.SSL_CERT_DAYS_LEFT] ?? null
  } catch { /* 静默 */ }
}

async function loadTexts() {
  try {
    const res = await getMetricTextLatest(props.instanceId, [
      M.AUTH_FAIL_SOURCES, M.UNKNOWN_SOURCES, M.AUDIT_EVENTS, M.OPEN_TABLES_DETAIL
    ])
    const v = res.values ?? {}
    authFailSources.value = parseJson(v[M.AUTH_FAIL_SOURCES])
    unknownSources.value = parseJson(v[M.UNKNOWN_SOURCES])
    auditEvents.value = parseJson(v[M.AUDIT_EVENTS])
    openTables.value = parseJson(v[M.OPEN_TABLES_DETAIL])
  } catch { /* 静默 */ }
  try {
    const res = await getMetricTextLatest(props.instanceId, [M.SSL_INFO, M.AUDIT_PLUGIN_INFO], '1d')
    const raw = res.values?.[M.SSL_INFO]
    if (raw) {
      const info = JSON.parse(raw)
      ssl.tlsVersion = info.tlsVersion ?? ''
      if (ssl.certDaysLeft == null && info.certDaysLeft != null) {
        ssl.certDaysLeft = info.certDaysLeft
      }
    }
    const auditRaw = res.values?.[M.AUDIT_PLUGIN_INFO]
    if (auditRaw) {
      const info = JSON.parse(auditRaw)
      auditPlugin.checked = true
      auditPlugin.plugin = info.plugin ?? ''
      auditPlugin.status = info.status ?? ''
      auditPlugin.active = !!info.plugin && String(info.status).toUpperCase() === 'ACTIVE'
      const vars = info.vars ?? {}
      auditPlugin.output = vars.audit_log_file ?? vars.server_audit_file_path
        ?? vars.server_audit_output_type ?? ''
      auditPlugin.policy = vars.audit_log_policy ?? vars.server_audit_events ?? ''
    }
  } catch { /* 静默 */ }
}

async function loadAll(silent = false) {
  if (!props.instanceId) return
  if (!silent) loading.value = true
  try {
    await Promise.allSettled([
      ...Object.entries(TREND_MAP).map(async ([key, code]) => {
        const res = await getMetricTrend(props.instanceId, code)
        charts[key] = res.points ?? []
      }),
      loadLatest(),
      loadTexts()
    ])
  } finally {
    if (!silent) loading.value = false
  }
}

watch(() => props.instanceId, () => {
  auditPlugin.checked = false
  auditPlugin.active = false
  loadAll()
}, { immediate: true })
useAutoRefresh(() => loadAll(true))
</script>

<style scoped>
.security-tab {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 4px 0;
  min-height: 200px;
}
.status-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
@media (max-width: 1200px) {
  .status-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
.status-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 12px 16px;
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.status-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.status-value {
  display: flex;
  align-items: center;
  gap: 8px;
}
.stat-num {
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.status-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.text-danger {
  color: var(--el-color-danger);
  font-weight: 600;
}
.chart-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  padding-left: 8px;
  border-left: 3px solid var(--el-color-primary);
}
.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
@media (max-width: 1200px) {
  .chart-grid {
    grid-template-columns: 1fr;
  }
}
.detail-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 12px 16px;
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.detail-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.detail-hint {
  font-size: 12px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}
</style>
