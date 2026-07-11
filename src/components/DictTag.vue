<template>
  <el-tag :type="tagType" :effect="effect" :size="size">{{ label }}</el-tag>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDict, type DictTagType } from '@/composables/useDict'

/**
 * 字典标签：根据字典类型 + 字典值渲染 el-tag，颜色与文案统一由字典维护。
 * 无匹配项时显示原值、fallbackType 兜底颜色。
 */
const props = withDefaults(defineProps<{
  /** 字典类型编码，如 alert_level、event_status */
  dict: string
  /** 字典值 */
  value?: string | null
  effect?: 'dark' | 'light' | 'plain'
  size?: 'large' | 'default' | 'small'
  /** 字典无匹配时的兜底 tag type */
  fallbackType?: DictTagType
  /** 无值时展示的占位文本 */
  emptyText?: string
}>(), {
  effect: 'light',
  size: 'small',
  fallbackType: 'info',
  emptyText: '-',
})

const { getDictLabel, getDictTagType } = useDict(props.dict)

const label = computed(() => {
  if (!props.value) return props.emptyText
  return getDictLabel(props.dict, props.value) || props.value
})

const tagType = computed<Exclude<DictTagType, ''>>(() => {
  const t = getDictTagType(props.dict, props.value)
  return t || props.fallbackType || 'info'
})
</script>
