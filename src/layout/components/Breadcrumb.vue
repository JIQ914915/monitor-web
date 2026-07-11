<template>
  <el-breadcrumb separator="/" class="breadcrumb">
    <el-breadcrumb-item v-for="item in items" :key="item.path">
      {{ item.title }}
    </el-breadcrumb-item>
  </el-breadcrumb>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { usePermissionStore } from '@/stores/permission'
import type { MenuNode } from '@/types'

const route = useRoute()
const permission = usePermissionStore()

/** 在菜单树中按解析后的完整 path 查标题（供 activeMenu 归属补全） */
function findTitle(nodes: MenuNode[], target: string, base = '/'): string | undefined {
  for (const n of nodes) {
    const path = n.path.startsWith('/') ? n.path : `${base.replace(/\/$/, '')}/${n.path}`
    if (path === target) return n.meta?.title
    if (n.children?.length) {
      const t = findTitle(n.children, target, path)
      if (t) return t
    }
  }
  return undefined
}

/** 在菜单树中按完整 path 查节点（供单叶子目录折叠判定） */
function findNode(nodes: MenuNode[], target: string, base = '/'): MenuNode | undefined {
  for (const n of nodes) {
    const path = n.path.startsWith('/') ? n.path : `${base.replace(/\/$/, '')}/${n.path}`
    if (path === target) return n
    if (n.children?.length) {
      const found = findNode(n.children, target, path)
      if (found) return found
    }
  }
  return undefined
}

/** 目录下仅一个可见子页面时，面包屑只保留目录一级（与侧边栏单叶子折叠一致） */
function collapseSoloDirs(list: { path: string; title: string }[]): { path: string; title: string }[] {
  const result: { path: string; title: string }[] = []
  for (let i = 0; i < list.length; i++) {
    result.push(list[i])
    const node = findNode(permission.menus, list[i].path)
    const visibleChildren = (node?.children || []).filter((c) => !c.meta?.hidden)
    const isSoloDir = visibleChildren.length === 1
      && !(visibleChildren[0].children || []).some((c) => !c.meta?.hidden)
    // 下一级正是唯一子页面时跳过它
    if (isSoloDir && i + 1 < list.length && list[i + 1].path.startsWith(list[i].path)) {
      i++
    }
  }
  return result
}

const items = computed(() => {
  const matched = route.matched
    .filter((m) => m.meta && m.meta.title)
    .map((m) => ({ path: m.path, title: m.meta.title as string }))

  // 详情类路由：依据 activeMenu 补出所属菜单作为父级
  const active = route.meta.activeMenu as string | undefined
  if (active && !matched.some((m) => m.path === active)) {
    const title = active === '/dashboard' ? '总览' : findTitle(permission.menus, active)
    if (title) matched.unshift({ path: active, title })
  }
  return collapseSoloDirs(matched)
})
</script>

<style scoped>
.breadcrumb {
  font-size: 13px;
}
</style>
