<template>
  <template v-if="!item.meta?.hidden">
    <!-- 单叶子折叠：目录下仅一个子页面时直接渲染为菜单项 —— 标题/图标取目录的，点击直达子页面 -->
    <el-menu-item v-if="soloChild" :index="soloChildPath">
      <el-icon v-if="item.meta?.icon"><component :is="resolveIcon(item.meta.icon)" /></el-icon>
      <template #title>{{ item.meta?.title }}</template>
    </el-menu-item>

    <!-- 有多个子菜单：渲染 submenu -->
    <el-sub-menu v-else-if="hasChildren" :index="resolvePath">
      <template #title>
        <el-icon v-if="item.meta?.icon"><component :is="resolveIcon(item.meta.icon)" /></el-icon>
        <span>{{ item.meta?.title }}</span>
      </template>
      <MenuItem
        v-for="child in visibleChildren"
        :key="child.path"
        :item="child"
        :base-path="resolvePath"
      />
    </el-sub-menu>

    <!-- 叶子：渲染 menu-item -->
    <el-menu-item v-else :index="resolvePath">
      <el-icon v-if="item.meta?.icon"><component :is="resolveIcon(item.meta.icon)" /></el-icon>
      <template #title>{{ item.meta?.title }}</template>
    </el-menu-item>
  </template>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import * as Icons from '@element-plus/icons-vue'
import type { MenuNode } from '@/types'

const props = defineProps<{
  item: MenuNode
  basePath?: string
}>()

const visibleChildren = computed(() => (props.item.children || []).filter((c) => !c.meta?.hidden))
const hasChildren = computed(() => visibleChildren.value.length > 0)

const resolvePath = computed(() => {
  const base = props.basePath || ''
  if (props.item.path.startsWith('/')) return props.item.path
  return `${base.replace(/\/$/, '')}/${props.item.path}`
})

/**
 * 单叶子折叠判定：可见子节点恰好 1 个、且该子节点自身是叶子页面。
 * 唯一子节点仍是目录（多层嵌套）时不折叠，保持展开行为。
 */
const soloChild = computed<MenuNode | null>(() => {
  if (visibleChildren.value.length !== 1) return null
  const only = visibleChildren.value[0]
  const grandChildren = (only.children || []).filter((c) => !c.meta?.hidden)
  return grandChildren.length === 0 ? only : null
})

/** 折叠后菜单项指向子页面的完整路由路径 */
const soloChildPath = computed(() => {
  const child = soloChild.value
  if (!child) return resolvePath.value
  if (child.path.startsWith('/')) return child.path
  return `${resolvePath.value.replace(/\/$/, '')}/${child.path}`
})

function resolveIcon(name?: string): Component | undefined {
  if (!name) return undefined
  return (Icons as Record<string, Component>)[name]
}
</script>
