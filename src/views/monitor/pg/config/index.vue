<template>
  <div class="pg-config-page">
    <InstanceEmpty v-if="!inst" />

    <template v-else>
      <!-- 参数体检（规则化：配置值 + 运行指标联合判断，只出建议不出手） -->
      <el-card shadow="never" class="block-card">
        <div class="advice-head">
          <span class="advice-title">参数体检</span>
          <el-button size="small" :loading="adviceLoading" @click="loadAdvice">
            {{ adviceLoaded ? '重新体检' : '一键体检' }}
          </el-button>
        </div>
        <template v-if="adviceLoaded">
          <el-alert
            v-if="!advices.length"
            type="success"
            show-icon
            :closable="false"
            title="参数体检未发现明显问题：关键参数配置与当前运行指标匹配良好"
          />
          <template v-else>
            <el-alert
              type="warning"
              show-icon
              :closable="false"
              title="以下建议基于已采集的配置参数与运行指标自动生成，仅供参考；任何参数调整须人工评估并通过变更流程执行，系统不会自动修改参数。"
              class="advice-alert"
            />
            <div v-for="(a, i) in advices" :key="i" class="advice-card">
              <div class="advice-card-head">
                <el-tag :type="a.level === 'warning' ? 'warning' : 'info'" size="small">
                  {{ a.level === 'warning' ? '建议评估' : '提示' }}
                </el-tag>
                <span class="advice-param mono">{{ a.paramName }}</span>
                <span class="advice-display">{{ a.displayName }}</span>
                <span class="advice-current">当前值：{{ a.currentValue }}</span>
              </div>
              <div class="advice-observation">观察：{{ a.observation }}</div>
              <div class="advice-suggestion">建议：{{ a.advice }}</div>
            </div>
          </template>
        </template>
        <el-empty v-else description="点击「一键体检」，基于已采集的参数快照与运行指标做规则化检查" :image-size="60" />
      </el-card>

      <!-- 关键参数快照（天级采集） -->
      <el-card shadow="never" class="block-card">
        <div class="advice-head">
          <span class="advice-title">关键参数快照</span>
          <span class="snapshot-tip">每日采集一次，新接入实例需等待天级采集后展示</span>
        </div>
        <ProTable
          :data="paramRows"
          :columns="columns"
          :loading="loading"
          :show-toolbar="false"
          :show-add="false"
          :show-operation="false"
          :show-pagination="false"
          embedded
        >
          <template #col-value="{ row }">
            <el-tag v-if="row.hasValue" type="primary" size="small" class="mono">{{ row.display }}</el-tag>
            <span v-else class="no-data">暂无数据</span>
          </template>
        </ProTable>
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useInstanceStore } from '@/stores/instance'
import InstanceEmpty from '@/components/InstanceEmpty.vue'
import ProTable from '@/components/ProTable/index.vue'
import { getParamAdvice, getParamsCurrent } from '@/api/metric'
import type { ParamAdviceVo, ParamCurrentVo } from '@/types/monitor'
import type { TableColumn } from '@/components/ProTable/types'

const instanceStore = useInstanceStore()
const inst = computed(() => instanceStore.current)

// ── 参数展示元数据（与后端 PG_NUMERIC/TEXT_PARAM_CODES 对应） ──────────────
interface ParamMeta { label: string, format?: 'bytes' | 'seconds' | 'ms' | 'timeout-ms', desc: string }

const PARAM_META: Record<string, ParamMeta> = {
  server_version:             { label: '服务器版本', desc: 'PostgreSQL 版本号' },
  max_connections:            { label: '最大连接数', desc: '连接数上限，打满后新连接被拒绝（修改需重启）' },
  shared_buffers_bytes:       { label: '共享缓冲区大小', format: 'bytes', desc: '数据页缓存，经验起点为主机内存 25%（修改需重启）' },
  effective_cache_size_bytes: { label: '有效缓存大小估计', format: 'bytes', desc: '给优化器的可用缓存总量估计（含系统页缓存），不实际分配内存' },
  work_mem_bytes:             { label: '排序/哈希工作内存', format: 'bytes', desc: '单个排序/哈希节点可用内存，超出后落盘产生临时文件' },
  maintenance_work_mem_bytes: { label: '维护操作内存', format: 'bytes', desc: 'VACUUM / CREATE INDEX 等维护操作可用内存' },
  max_wal_size_bytes:         { label: 'WAL 检查点上限', format: 'bytes', desc: 'WAL 写入超过该量将被迫触发检查点，偏小会造成检查点风暴' },
  checkpoint_timeout_seconds: { label: '检查点周期', format: 'seconds', desc: '定时检查点的触发间隔' },
  autovacuum_max_workers:     { label: 'autovacuum 工作进程数', desc: '并行执行 autovacuum 的进程上限' },
  max_worker_processes:       { label: '后台工作进程上限', desc: '并行查询、逻辑复制等共用的后台进程池上限' },
  idle_in_trx_timeout_ms:     { label: '事务中空闲超时', format: 'timeout-ms', desc: '开事务后闲置超过该时长自动断开，0 为不限制（易引发表膨胀）' },
  statement_timeout_ms:       { label: '语句执行超时', format: 'timeout-ms', desc: '单条语句超过该时长自动取消，0 为不限制' },
  wal_level:                  { label: 'WAL 记录级别', desc: 'replica 支持物理复制，logical 额外支持逻辑复制' },
  archive_mode:               { label: 'WAL 归档', desc: 'on 时按 archive_command 归档 WAL（PITR 恢复的前提）' },
  hot_standby:                { label: '热备只读查询', desc: '从库恢复模式下是否允许只读查询' },
  autovacuum:                 { label: '自动回收', desc: '务必保持 on；关闭会导致表膨胀与 XID 回卷风险' },
  ssl:                        { label: '连接加密', desc: 'off 时客户端流量明文传输' },
  shared_preload_libraries:   { label: '预加载扩展', desc: 'pg_stat_statements 等需预加载的扩展（修改需重启）' },
  log_min_duration_statement: { label: '慢语句记录阈值', format: 'timeout-ms', desc: '执行超过该时长的语句写入日志，-1 为不记录（本平台慢SQL采样也参考该阈值）' }
}

// ── 参数快照 ──────────────────────────────────────────────────────────────
const loading = ref(false)
const current = ref<ParamCurrentVo | null>(null)

const columns: TableColumn[] = [
  { prop: 'paramName', label: '参数名称', minWidth: 220, showOverflowTooltip: true },
  { prop: 'label',     label: '说明',     minWidth: 150 },
  { prop: 'display',   label: '当前值',   minWidth: 140, slot: 'col-value' },
  { prop: 'desc',      label: '含义',     minWidth: 320, showOverflowTooltip: true }
]

const paramRows = computed(() => {
  const items = current.value?.params ?? []
  return items.map(p => {
    const meta = PARAM_META[p.paramName]
    return {
      paramName: p.paramName,
      label: meta?.label ?? p.paramName,
      desc: meta?.desc ?? '',
      hasValue: p.hasValue,
      display: p.hasValue ? formatValue(p.value ?? '', meta?.format) : ''
    }
  })
})

function formatValue(raw: string, format?: ParamMeta['format']): string {
  const n = Number(raw)
  if (!Number.isFinite(n)) return raw
  switch (format) {
    case 'bytes': return fmtBytes(n)
    case 'seconds': return n >= 3600 ? `${(n / 3600).toFixed(1)} 小时` : n >= 60 ? `${Math.round(n / 60)} 分钟` : `${n} 秒`
    case 'timeout-ms':
      if (n <= 0) return n === -1 ? '-1（不记录）' : '0（不限制）'
      return n >= 60000 ? `${Math.round(n / 60000)} 分钟` : n >= 1000 ? `${n / 1000} 秒` : `${n} 毫秒`
    case 'ms': return `${n} 毫秒`
    default: return raw
  }
}

function fmtBytes(b: number): string {
  if (b >= 1073741824) return `${trimZero(b / 1073741824)} GB`
  if (b >= 1048576) return `${trimZero(b / 1048576)} MB`
  if (b >= 1024) return `${trimZero(b / 1024)} KB`
  return `${b} B`
}
function trimZero(v: number): string {
  const s = v.toFixed(1)
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

async function loadParams() {
  if (!inst.value) return
  loading.value = true
  try {
    current.value = await getParamsCurrent(inst.value.id)
  } finally {
    loading.value = false
  }
}

// ── 参数体检 ──────────────────────────────────────────────────────────────
const adviceLoading = ref(false)
const adviceLoaded = ref(false)
const advices = ref<ParamAdviceVo[]>([])

async function loadAdvice() {
  if (!inst.value) return
  adviceLoading.value = true
  try {
    advices.value = await getParamAdvice(inst.value.id) ?? []
    adviceLoaded.value = true
  } finally {
    adviceLoading.value = false
  }
}

watch(() => inst.value?.id, () => {
  adviceLoaded.value = false
  advices.value = []
  current.value = null
  if (inst.value) loadParams()
}, { immediate: true })
</script>

<style scoped lang="scss">
.pg-config-page {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.block-card {
  border-radius: 8px;
}

.advice-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;

  .advice-title {
    font-size: 15px;
    font-weight: 600;
  }

  .snapshot-tip {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}

.advice-alert {
  margin-bottom: 12px;
}

.advice-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 10px 14px;
  margin-bottom: 10px;

  .advice-card-head {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 6px;

    .advice-param {
      font-weight: 600;
    }

    .advice-display {
      color: var(--el-text-color-secondary);
    }

    .advice-current {
      margin-left: auto;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .advice-observation,
  .advice-suggestion {
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-regular);
  }
}

.mono {
  font-family: 'JetBrains Mono', Consolas, monospace;
}

.no-data {
  color: var(--el-text-color-placeholder);
}
</style>
