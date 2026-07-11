import { onMounted, onUnmounted, watch, type Ref } from 'vue'
import * as echarts from 'echarts/core'
import type { EChartsCoreOption } from 'echarts/core'
import { useThemeStore } from '@/stores/theme'

/**
 * 统一管理 ECharts 实例的生命周期：
 * - onMounted 自动初始化
 * - onUnmounted 自动销毁，防止内存泄漏
 * - ResizeObserver 监听容器尺寸变化
 * - 监听 theme store 模式切换，自动重建实例以切换亮/暗主题
 *
 * @param elRef   图表容器的 template ref
 * @param getOption  返回当前 ECharts option 的函数（响应式数据变更后调用 update()）
 * @param theme   ECharts 主题名称，默认不指定（由调用方按需传入 'dark'）
 *
 * @example
 * ```vue
 * <template>
 *   <div ref="chartEl" style="height:200px" />
 * </template>
 * <script setup lang="ts">
 * import { ref, watch } from 'vue'
 * import { useECharts } from '@/composables/useECharts'
 *
 * const chartEl = ref<HTMLDivElement>()
 * const data = ref<number[]>([])
 *
 * const { update } = useECharts(chartEl, () => ({
 *   series: [{ type: 'line', data: data.value }]
 * }))
 *
 * // 数据变化时刷新图表
 * watch(data, update)
 * </script>
 * ```
 */
export function useECharts(
  elRef: Ref<HTMLDivElement | undefined>,
  getOption: () => EChartsCoreOption,
  theme?: string,
) {
  let chart: echarts.ECharts | null = null
  let resizeObserver: ResizeObserver | null = null
  const themeStore = useThemeStore()

  function resolveTheme(): string | undefined {
    if (theme) return theme
    // 跟随系统/用户主题：暗色模式使用 'dark'
    const mode = themeStore.mode
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = mode === 'dark' || (mode === 'auto' && prefersDark)
    return isDark ? 'dark' : undefined
  }

  function init() {
    if (!elRef.value) return
    chart = echarts.init(elRef.value, resolveTheme())
    chart.setOption(getOption())
    resizeObserver = new ResizeObserver(() => chart?.resize())
    resizeObserver.observe(elRef.value)
  }

  function dispose() {
    resizeObserver?.disconnect()
    resizeObserver = null
    chart?.dispose()
    chart = null
  }

  /** 使用最新 getOption() 结果刷新图表（数据变更时调用） */
  function update() {
    chart?.setOption(getOption())
  }

  /** 传入自定义 option 进行局部更新 */
  function setOption(option: EChartsCoreOption, replace = false) {
    chart?.setOption(option, replace)
  }

  /** 销毁后重建，用于主题切换等需要完整重建的场景 */
  function reinit() {
    dispose()
    init()
  }

  // 主题模式切换时重建实例
  watch(() => themeStore.mode, () => {
    if (chart) reinit()
  })

  // 容器元素延迟出现（如 el-dialog 首开才渲染内容）或被替换（destroy-on-close 重建）时，
  // onMounted 的 init 会因 elRef 为空而跳过，这里监听 elRef 补初始化/重绑定
  watch(elRef, (el, oldEl) => {
    if (el && el !== oldEl) {
      if (chart) dispose()
      init()
    }
  })

  onMounted(init)
  onUnmounted(dispose)

  return { update, setOption, reinit, getInstance: () => chart }
}
