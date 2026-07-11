<template>
  <el-menu
    :default-active="active"
    mode="horizontal"
    :ellipsis="false"
    router
    class="top-menu"
  >
    <template v-for="m in visibleMenus" :key="rootPath(m)">
      <!-- mix：一级直达（点击跳到该一级下首个可用叶子） -->
      <el-menu-item v-if="onlyRoot" :index="rootPath(m)" @click="goRoot(m)">
        <el-icon v-if="m.meta?.icon"><component :is="icon(m.meta.icon)" /></el-icon>
        <span>{{ m.meta?.title }}</span>
      </el-menu-item>
      <!-- top：完整菜单树（子级走横向下拉） -->
      <MenuItem v-else :item="m" base-path="/" />
    </template>
  </el-menu>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as Icons from '@element-plus/icons-vue'
import MenuItem from './MenuItem.vue'
import type { MenuNode } from '@/types'

const props = defineProps<{
  menus: MenuNode[]
  /** true：仅渲染一级（mix 顶部）；false：渲染完整树（top） */
  onlyRoot?: boolean
}>()

const route = useRoute()
const router = useRouter()

// 顶级隐藏项（visible=false，如详情/编辑页）不在导航显示；与布局无关
const visibleMenus = computed(() => props.menus.filter((m) => !m.meta?.hidden))

const active = computed(() =>
  props.onlyRoot
    ? '/' + (route.path.split('/')[1] || 'dashboard')
    : (route.meta.activeMenu as string) || route.path
)

function rootPath(m: MenuNode): string {
  return m.path.startsWith('/') ? m.path : '/' + m.path
}

/** 递归求一级下首个叶子的完整路径，供 mix 顶部点击跳转 */
function firstLeaf(node: MenuNode, base: string): string {
  const path = node.path.startsWith('/') ? node.path : `${base.replace(/\/$/, '')}/${node.path}`
  const child = (node.children || []).find((c) => !c.meta?.hidden)
  return child ? firstLeaf(child, path) : path
}

function goRoot(m: MenuNode) {
  router.push(firstLeaf(m, ''))
}

function icon(name?: string): Component | undefined {
  return name ? (Icons as Record<string, Component>)[name] : undefined
}
</script>

<style scoped>
.top-menu {
  flex: 1;
  border-bottom: none;
  background: transparent;
}
</style>
