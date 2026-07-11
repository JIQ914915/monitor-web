import type { App } from 'vue'

interface ErrorPayload {
  type: 'vue' | 'runtime' | 'promise'
  message: string
  stack?: string
  info?: string
  url?: string
  timestamp: string
}

const REPORT_ENDPOINT = '/api/frontend-errors'
const MAX_QUEUE = 20
const errorQueue: ErrorPayload[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function buildPayload(
  type: ErrorPayload['type'],
  error: unknown,
  extra?: { info?: string; url?: string },
): ErrorPayload {
  const err = error instanceof Error ? error : new Error(String(error))
  return {
    type,
    message: err.message ?? String(error),
    stack: err.stack,
    info: extra?.info,
    url: extra?.url ?? window.location.href,
    timestamp: new Date().toISOString(),
  }
}

function enqueue(payload: ErrorPayload) {
  if (import.meta.env.DEV) {
    // 开发环境只打印，不上报
    console.error(`[ErrorMonitor][${payload.type}]`, payload.message, payload.stack)
    return
  }
  errorQueue.push(payload)
  if (errorQueue.length >= MAX_QUEUE) {
    flush()
  } else if (!flushTimer) {
    // 攒批上报，最多等 5s
    flushTimer = setTimeout(flush, 5000)
  }
}

function flush() {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (!errorQueue.length) return
  const batch = errorQueue.splice(0, errorQueue.length)
  // 使用 navigator.sendBeacon 保证页面卸载时也能上报
  const blob = new Blob([JSON.stringify(batch)], { type: 'application/json' })
  if (!navigator.sendBeacon(REPORT_ENDPOINT, blob)) {
    // sendBeacon 失败时回退到 fetch（fire-and-forget）
    fetch(REPORT_ENDPOINT, { method: 'POST', body: blob, keepalive: true }).catch(() => undefined)
  }
}

/**
 * 全局错误监控初始化。在 main.ts 中调用一次。
 *
 * 覆盖：
 * - Vue 组件内部错误（app.config.errorHandler）
 * - 未捕获的同步运行时错误（window.onerror）
 * - 未捕获的 Promise rejection（window.unhandledrejection）
 * - 页面卸载前将队列中剩余错误一次性上报
 */
export function setupErrorMonitor(app: App): void {
  // Vue 组件树内部错误
  app.config.errorHandler = (err, _instance, info) => {
    console.error('[Vue Error]', err)
    enqueue(buildPayload('vue', err, { info }))
  }

  // 未被 try/catch 捕获的同步错误
  window.addEventListener('error', (event) => {
    enqueue(buildPayload('runtime', event.error ?? event.message, {
      url: event.filename,
      info: `line ${event.lineno}:${event.colno}`,
    }))
  })

  // 未被处理的 Promise rejection
  window.addEventListener('unhandledrejection', (event) => {
    enqueue(buildPayload('promise', event.reason))
    // 阻止浏览器默认打印 "Uncaught (in promise)" 警告（生产环境）
    if (import.meta.env.PROD) event.preventDefault()
  })

  // 页面卸载前强制上报队列中剩余错误
  window.addEventListener('pagehide', flush)
}

/**
 * 手动上报一个可预期的业务错误（如轮询失败超阈值）。
 */
export function reportError(error: unknown, info?: string): void {
  enqueue(buildPayload('runtime', error, { info }))
}
