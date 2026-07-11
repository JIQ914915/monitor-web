import type { App, Directive, DirectiveBinding } from 'vue'
import { useUserStore } from '@/stores/user'

/** 按钮级权限指令：v-permission="'instance:add'"（menu:action，§11.11.6）
 *  无权限时移除元素。 */
const permission: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding<string | string[]>) {
    const userStore = useUserStore()
    const value = binding.value
    const codes = Array.isArray(value) ? value : [value]
    const ok = codes.some((c) => userStore.hasPermission(c))
    if (!ok) el.parentNode?.removeChild(el)
  }
}

export function setupDirectives(app: App) {
  app.directive('permission', permission)
}
