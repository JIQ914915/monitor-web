import { onMounted, onUnmounted } from 'vue'

/**
 * 页面数据自动刷新定时器。
 *
 * <p>约定：
 * - 组件挂载时启动、卸载时自动清理；
 * - 浏览器标签页不可见时跳过刷新（避免后台标签页空转请求）；
 * - 回调应使用"静默刷新"（不置 loading），避免图表定时闪烁。
 */
export function useAutoRefresh(callback: () => void, intervalMs = 60_000) {
  let timer: number | null = null

  function start() {
    stop()
    timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        callback()
      }
    }, intervalMs)
  }

  function stop() {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  onMounted(start)
  onUnmounted(stop)

  return { start, stop }
}
