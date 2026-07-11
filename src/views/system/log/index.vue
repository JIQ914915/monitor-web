<template>
  <ProTable
    :data="list"
    :columns="columns"
    :loading="loading"
    :total="total"
    v-model:page-num="query.pageNum"
    v-model:page-size="query.pageSize"
    :page-sizes="[20, 50, 100, 200]"
    :show-add="false"
    :show-operation="false"
    :show-export="true"
    @search="search"
    @reset="reset"
    @export="doExport"
    @page-change="load"
  >
    <template #search>
      <el-form-item label="模块">
        <el-select v-model="query.module" placeholder="模块" clearable style="width: 130px">
          <el-option v-for="m in modules" :key="m" :label="m" :value="m" />
        </el-select>
      </el-form-item>
      <el-form-item label="操作">
        <el-select v-model="query.action" placeholder="操作" clearable style="width: 120px">
          <el-option v-for="a in actions" :key="a" :label="a" :value="a" />
        </el-select>
      </el-form-item>
      <el-form-item label="操作人">
        <el-input v-model="query.username" placeholder="操作人" clearable style="width: 130px" />
      </el-form-item>
      <el-form-item label="时间范围">
        <el-date-picker
          v-model="dateRange"
          type="datetimerange"
          value-format="YYYY-MM-DD HH:mm:ss"
          range-separator="~"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          style="width: 360px"
          @change="onDateChange"
        />
      </el-form-item>
    </template>

    <template #col-action="{ row }">
      <el-tag size="small" :type="actionTag(row.action)">{{ row.action }}</el-tag>
    </template>

    <template #col-success="{ row }">
      <el-icon v-if="row.success" color="var(--sev-ok, #15A36A)"><CircleCheck /></el-icon>
      <el-icon v-else color="var(--sev-crit, #E5484D)"><CircleClose /></el-icon>
    </template>
  </ProTable>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { CircleCheck, CircleClose } from '@element-plus/icons-vue'
import ProTable from '@/components/ProTable/index.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { usePagination } from '@/composables/usePagination'
import { pageOperLogs, exportOperLogs, type OperLogQuery } from '@/api/operlog'
import type { SysOperLog } from '@/types'

const modules = ['用户管理', '角色管理', '分组管理', '菜单管理', '数据保留', '实例管理']
const actions = ['新增', '修改', '删除', '启停', '重置密码', '保存配置']

const columns: TableColumn[] = [
  { prop: 'operTime', label: '时间', width: 180, showOverflowTooltip: false },
  { prop: 'username', label: '操作人', width: 120, showOverflowTooltip: false },
  { prop: 'module', label: '模块', width: 120, showOverflowTooltip: false },
  { label: '操作', width: 100, slot: 'col-action', showOverflowTooltip: false },
  { prop: 'target', label: '操作对象', minWidth: 160 },
  { prop: 'ip', label: 'IP地址', width: 140, showOverflowTooltip: false },
  { label: '结果', width: 80, align: 'center', slot: 'col-success', showOverflowTooltip: false },
  { prop: 'detail', label: '详情', minWidth: 180 },
]

const { query, list, total, loading, load, search } = usePagination<SysOperLog, OperLogQuery>(
  (q) => pageOperLogs(q),
  { pageSize: 20 }
)

const dateRange = ref<[string, string] | null>(null)
function onDateChange(val: [string, string] | null) {
  query.startTime = val?.[0]
  query.endTime = val?.[1]
  search()
}

function reset() {
  query.module = undefined
  query.action = undefined
  query.username = undefined
  query.startTime = undefined
  query.endTime = undefined
  dateRange.value = null
  search()
}

type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger'
function actionTag(action: string): TagType {
  return ({ 新增: 'success', 修改: 'warning', 删除: 'danger', 启停: 'info', 重置密码: 'warning', 保存配置: 'primary' } as Record<string, TagType>)[action] || 'info'
}

async function doExport() {
  const rows = await exportOperLogs({ ...query, pageNum: 1, pageSize: 10000 })
  const header = ['时间', '操作人', '模块', '操作', '操作对象', 'IP地址', '结果', '详情']
  const body = rows.map((r) =>
    [r.operTime, r.username, r.module, r.action, r.target || '', r.ip || '', r.success ? '成功' : '失败', (r.detail || '').replace(/[\r\n,]/g, ' ')].join(',')
  )
  const csv = '\ufeff' + [header.join(','), ...body].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `oper_log_${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success(`已导出 ${rows.length} 条`)
}

onMounted(load)
</script>
