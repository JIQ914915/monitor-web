<template>
  <!-- ── Drawer 模式 ────────────────────────────────────────────── -->
  <el-drawer
    v-if="type === 'drawer'"
    :model-value="visible"
    :title="drawerTitle"
    :size="size"
    direction="rtl"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :append-to-body="appendToBody"
    @update:model-value="handleClose"
    @closed="onClosed"
  >
    <div ref="bodyRef" class="crud-body">
      <slot :mode="mode" :row="row" :readonly="mode === 'view'" />
    </div>

    <template #footer>
      <div class="crud-footer">
        <el-button v-if="showReset && mode !== 'view'" :icon="RefreshLeft" @click="handleReset">重置</el-button>
        <div class="crud-footer-right">
          <el-button @click="handleClose(false)">{{ mode === 'view' ? '关闭' : '取消' }}</el-button>
          <el-button
            v-if="mode !== 'view'"
            type="primary"
            :loading="saving"
            @click="handleSave"
          >保存</el-button>
        </div>
      </div>
    </template>
  </el-drawer>

  <!-- ── Dialog 模式 ────────────────────────────────────────────── -->
  <el-dialog
    v-else
    :model-value="visible"
    :title="drawerTitle"
    :width="dialogWidth"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :append-to-body="appendToBody"
    :draggable="draggable"
    @update:model-value="handleClose"
    @closed="onClosed"
  >
    <div ref="bodyRef" class="crud-body crud-body--dialog">
      <slot :mode="mode" :row="row" :readonly="mode === 'view'" />
    </div>

    <template #footer>
      <div class="crud-footer">
        <el-button v-if="showReset && mode !== 'view'" :icon="RefreshLeft" @click="handleReset">重置</el-button>
        <div class="crud-footer-right">
          <el-button @click="handleClose(false)">{{ mode === 'view' ? '关闭' : '取消' }}</el-button>
          <el-button
            v-if="mode !== 'view'"
            type="primary"
            :loading="saving"
            @click="handleSave"
          >保存</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { RefreshLeft } from '@element-plus/icons-vue'
import type { DrawerMode } from './types'

// ── Props ────────────────────────────────────────────────────────────────────
const props = withDefaults(defineProps<{
  /** visible 双向绑定 */
  visible: boolean
  /**
   * 展示方式：
   *  - drawer：从右侧滑出的抽屉（默认）
   *  - dialog：居中弹窗（表单字段少时更紧凑）
   */
  type?: 'drawer' | 'dialog'
  /**
   * 操作模式：
   *  - create：新增（表单可编辑）
   *  - edit：编辑（表单可编辑）
   *  - view：查看（只读，无保存按钮）
   */
  mode?: DrawerMode
  /** 业务实体名称，拼接标题：「新增用户」「编辑用户」「查看用户」 */
  title?: string
  /** 当前行数据（edit/view 时传入） */
  row?: any
  /** Drawer 宽度（type=drawer 时生效） */
  size?: string | number
  /** Dialog 宽度（type=dialog 时生效） */
  dialogWidth?: string
  /** Dialog 是否可拖拽 */
  draggable?: boolean
  /** 是否插入到 body（推荐 true，避免层叠上下文问题） */
  appendToBody?: boolean
  /** 是否显示重置按钮 */
  showReset?: boolean
  /** 重置前是否弹出确认 */
  confirmOnReset?: boolean
  /** 保存前是否弹出二次确认 */
  confirmOnSave?: boolean
  /** 保存确认提示文字 */
  saveConfirmMsg?: string
  /**
   * el-form 实例引用。
   * 传入后，保存时将先调用 validate()；关闭时将调用 clearValidate()。
   */
  formRef?: FormInstance | null
  /**
   * 关闭前是否检测脏数据（需传 isDirty 函数）。
   * 当表单有未保存修改时，弹出确认提示。
   */
  isDirty?: () => boolean
}>(), {
  type: 'drawer',
  mode: 'create',
  title: '',
  row: null,
  size: '560px',
  dialogWidth: '600px',
  draggable: true,
  appendToBody: true,
  showReset: false,
  confirmOnReset: false,
  confirmOnSave: true,
  saveConfirmMsg: '确认保存当前填写的信息？',
  formRef: null,
  isDirty: undefined,
})

// ── Emits ────────────────────────────────────────────────────────────────────
const emit = defineEmits<{
  'update:visible': [v: boolean]
  /** 保存确认后触发；父组件完成接口调用后需调用 drawerRef.stopSaving() */
  save: [mode: DrawerMode, row: any]
  /** 用户点击重置按钮后触发；父组件负责重置表单字段值 */
  reset: []
  /** 抽屉/弹窗完全关闭后触发（动画结束），适合此时重置表单 */
  closed: []
}>()

// ── 标题 ─────────────────────────────────────────────────────────────────────
const PREFIX: Record<DrawerMode, string> = { create: '新增', edit: '编辑', view: '查看' }

const drawerTitle = computed(() => {
  const prefix = PREFIX[props.mode] ?? ''
  return props.title ? `${prefix}${props.title}` : prefix
})

// ── 内部保存 loading ──────────────────────────────────────────────────────────
const saving = ref(false)
const bodyRef = ref<HTMLElement>()

/** 结束保存 loading；close=true 时同时关闭抽屉（默认） */
function stopSaving(close = true) {
  saving.value = false
  if (close) emit('update:visible', false)
}

// ── 关闭 ─────────────────────────────────────────────────────────────────────
async function handleClose(_v: boolean) {
  if (saving.value) return

  // 脏数据检测
  if (props.isDirty?.()) {
    try {
      await ElMessageBox.confirm(
        '当前表单有未保存的修改，确认放弃并关闭？',
        '放弃修改',
        { confirmButtonText: '放弃', cancelButtonText: '继续编辑', type: 'warning' }
      )
    } catch { return }
  }

  props.formRef?.clearValidate()
  emit('update:visible', false)
}

function onClosed() {
  emit('closed')
}

// ── 重置 ─────────────────────────────────────────────────────────────────────
async function handleReset() {
  if (props.confirmOnReset) {
    try {
      await ElMessageBox.confirm('确认重置表单？已填写的内容将被清空。', '重置确认', {
        confirmButtonText: '确认重置',
        cancelButtonText: '取消',
        type: 'warning',
      })
    } catch { return }
  }
  emit('reset')
}

// ── 保存 ─────────────────────────────────────────────────────────────────────
async function handleSave() {
  // 第 1 步：表单校验
  if (props.formRef) {
    try {
      await props.formRef.validate()
    } catch {
      ElMessage.warning('请检查并完善表单中的必填项')
      // 滚动到第一个错误字段
      nextTick(() => {
        const firstError = bodyRef.value?.querySelector<HTMLElement>('.el-form-item.is-error')
        firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
      return
    }
  }

  // 第 2 步：二次确认
  if (props.confirmOnSave) {
    const confirmTitle = props.mode === 'create' ? '确认新增' : '确认保存'
    try {
      await ElMessageBox.confirm(props.saveConfirmMsg, confirmTitle, {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'info',
      })
    } catch { return }
  }

  // 第 3 步：触发保存
  saving.value = true
  emit('save', props.mode, props.row)
}

// ── 暴露 ─────────────────────────────────────────────────────────────────────
defineExpose({ stopSaving })
</script>

<style scoped>
/* 表单容器 */
.crud-body {
  padding: 4px;
}

.crud-body--dialog {
  padding: 0;
  max-height: 70vh;
  overflow-y: auto;
}

/* Footer 布局：左侧重置，右侧取消+保存 */
.crud-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0 0;
  width: 100%;
}

.crud-footer-right {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
</style>
