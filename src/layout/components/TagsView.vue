<template>
  <div class="tags-view">
    <el-scrollbar>
      <div class="tags-row">
        <div
          v-for="tag in tagsStore.visited"
          :key="tag.path"
          class="tag-chip"
          :class="{ active: isActive(tag), affix: tag.affix }"
          @click="goTo(tag)"
          @click.middle="!tag.affix && close(tag)"
          @contextmenu.prevent="openMenu(tag, $event)"
        >
          <span class="dot" />
          <span class="label">{{ tag.title }}</span>
          <el-icon v-if="!tag.affix" class="close" @click.stop="close(tag)">
            <Close />
          </el-icon>
        </div>
      </div>
    </el-scrollbar>

    <ul v-show="menu.visible" class="tags-contextmenu" :style="{ left: menu.x + 'px', top: menu.y + 'px' }">
      <li :class="{ disabled: menu.tag?.affix }" @click="onClose">关闭</li>
      <li @click="onCloseOthers">关闭其他</li>
      <li @click="onCloseLeft">关闭左侧</li>
      <li @click="onCloseRight">关闭右侧</li>
      <li @click="onCloseAll">关闭全部</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Close } from '@element-plus/icons-vue'
import { useTagsViewStore, type TagView } from '@/stores/tagsView'

const route = useRoute()
const router = useRouter()
const tagsStore = useTagsViewStore()

watch(
  () => route.path,
  () => tagsStore.addView(route),
  { immediate: true }
)

const isActive = (tag: TagView) => tag.path === route.path

function goTo(tag: TagView) {
  router.push(tag.fullPath)
}

function close(tag: TagView) {
  const next = tagsStore.removeView(tag.path)
  if (isActive(tag) && next) router.push(next.fullPath)
}

// ===== 右键上下文菜单 =====
const menu = reactive<{ visible: boolean; x: number; y: number; tag: TagView | null }>({
  visible: false,
  x: 0,
  y: 0,
  tag: null
})

function openMenu(tag: TagView, e: MouseEvent) {
  menu.tag = tag
  menu.x = e.clientX
  menu.y = e.clientY
  menu.visible = true
}

function closeMenu() {
  menu.visible = false
}

/** 关闭批量操作后，若当前路由已被移除则跳到剩余的最后一个标签。 */
function ensureActive() {
  if (!tagsStore.visited.some((v) => v.path === route.path)) {
    const last = tagsStore.visited[tagsStore.visited.length - 1]
    if (last) router.push(last.fullPath)
  }
}

function onClose() {
  if (menu.tag && !menu.tag.affix) close(menu.tag)
  closeMenu()
}

function onCloseOthers() {
  if (menu.tag) {
    tagsStore.closeOthers(menu.tag.path)
    if (route.path !== menu.tag.path) router.push(menu.tag.fullPath)
  }
  closeMenu()
}

function onCloseLeft() {
  if (menu.tag) {
    tagsStore.closeLeft(menu.tag.path)
    ensureActive()
  }
  closeMenu()
}

function onCloseRight() {
  if (menu.tag) {
    tagsStore.closeRight(menu.tag.path)
    ensureActive()
  }
  closeMenu()
}

function onCloseAll() {
  tagsStore.closeAll()
  ensureActive()
  closeMenu()
}

watch(() => menu.visible, (v) => {
  if (v) document.addEventListener('click', closeMenu)
  else document.removeEventListener('click', closeMenu)
})

onBeforeUnmount(() => document.removeEventListener('click', closeMenu))
</script>

<style scoped>
.tags-view {
  height: 42px;
  background: var(--surface);
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: center;
  padding: 0 12px;
}
/* 让滚动容器撑满高度并使标签垂直居中（消除底部滚动条预留导致的贴顶） */
.tags-view :deep(.el-scrollbar) {
  width: 100%;
  height: 100%;
}
.tags-view :deep(.el-scrollbar__wrap),
.tags-view :deep(.el-scrollbar__view) {
  display: flex;
  align-items: center;
  height: 100%;
}
.tags-row {
  display: flex;
  gap: 6px;
  align-items: center;
  white-space: nowrap;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  font-size: 13px;
  line-height: 1;
  color: var(--muted);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-base);
  cursor: pointer;
  user-select: none;
  transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;
}
.tag-chip:hover {
  color: var(--ink);
  background: var(--track);
  border-color: var(--muted);
}
.tag-chip.active {
  color: var(--signal);
  background: var(--signal-soft);
  border-color: var(--signal);
  font-weight: 500;
}

/* 前导状态点：仅激活态显示 */
.dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--signal);
  flex-shrink: 0;
  opacity: 0;
  transform: scale(0.6);
  transition: opacity 0.15s ease, transform 0.15s ease;
  /* 不占位：通过负 margin 收掉宽度，激活时再展开 */
  margin-right: -12px;
}
.tag-chip.active .dot {
  opacity: 1;
  transform: scale(1);
  margin-right: 0;
}

.close {
  font-size: 12px;
  color: var(--faint);
  border-radius: var(--radius-pill);
  padding: 1px;
  transition: color 0.15s ease, background 0.15s ease;
}
.close:hover {
  color: #fff;
  background: var(--muted);
}
.tag-chip.active .close {
  color: var(--signal);
}
.tag-chip.active .close:hover {
  color: #fff;
  background: var(--signal);
}

/* 右键上下文菜单 */
.tags-contextmenu {
  position: fixed;
  z-index: 3000;
  min-width: 120px;
  margin: 0;
  padding: 4px;
  list-style: none;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-base);
  box-shadow: var(--shadow-md, 0 6px 18px rgba(0, 0, 0, 0.12));
}
.tags-contextmenu li {
  padding: 7px 14px;
  font-size: 13px;
  color: var(--ink);
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  user-select: none;
}
.tags-contextmenu li:hover {
  background: var(--track);
  color: var(--signal);
}
.tags-contextmenu li.disabled {
  color: var(--faint);
  pointer-events: none;
}
</style>
