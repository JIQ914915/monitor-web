<template>
  <div class="rich-editor">
    <Toolbar
      class="rich-editor__toolbar"
      :editor="editorRef"
      :default-config="toolbarConfig"
      mode="default"
    />
    <Editor
      class="rich-editor__body"
      v-model="valueHtml"
      :default-config="editorConfig"
      mode="default"
      :style="{ height: height }"
      @on-created="handleCreated"
    />
  </div>
</template>

<script setup lang="ts">
import '@wangeditor/editor/dist/css/style.css'
import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import type { IDomEditor, IToolbarConfig, IEditorConfig } from '@wangeditor/editor'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    height?: string
    placeholder?: string
  }>(),
  { modelValue: '', height: '360px', placeholder: '请输入正文…' }
)
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

// editor 实例必须用 shallowRef（避免深度响应式代理导致异常）
const editorRef = shallowRef<IDomEditor>()
const valueHtml = ref(props.modelValue)

watch(
  () => props.modelValue,
  (v) => {
    if ((v || '') !== valueHtml.value) valueHtml.value = v || ''
  }
)
watch(valueHtml, (v) => emit('update:modelValue', v))

// 精简工具栏：关闭需服务端支持的上传/视频，并去掉不常用的宽菜单组，
// 让工具栏整体变短、右侧留出空间，避免最右侧下拉面板展开时超出抽屉被裁剪。
const toolbarConfig: Partial<IToolbarConfig> = {
  excludeKeys: [
    'group-video',
    'uploadImage',
    'insertVideo',
    'fullScreen',
    'group-image',
    'insertImage',
    'lineHeight'
  ]
}
const editorConfig: Partial<IEditorConfig> = {
  placeholder: props.placeholder,
  MENU_CONF: {}
}

const handleCreated = (editor: IDomEditor) => {
  editorRef.value = editor
}

onBeforeUnmount(() => {
  editorRef.value?.destroy()
})
</script>

<style scoped>
.rich-editor {
  border: 1px solid var(--el-border-color, #dcdfe6);
  border-radius: var(--radius-sm);
  /* 不能用 overflow:hidden，否则工具栏下拉面板（对齐/行高等）会被裁掉 */
  width: 100%;
}
.rich-editor__toolbar {
  border-bottom: 1px solid var(--el-border-color, #dcdfe6);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}
.rich-editor__body {
  overflow-y: auto;
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
}
</style>
