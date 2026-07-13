import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

async function source(relativePath) {
  return readFile(path.join(projectRoot, relativePath), 'utf8')
}

test('unknown database types never fall back to MySQL instance routes', async () => {
  const routes = await source('src/utils/instanceMenu.ts')

  assert.match(routes, /getTypePathPrefix[\s\S]*?\?\? null/)
  assert.doesNotMatch(routes, /dbType === 'PostgreSQL'\s*\?[^:]+:\s*'\/monitor\/mysql/)
  assert.doesNotMatch(routes, /TYPE_PATH_PREFIX\[dbType\][^\n]*:\s*'\/monitor\/mysql/)
})

test('shared PG pages do not hardcode MySQL navigation', async () => {
  const scenario = await source('src/views/monitor/shared/scenario/index.vue')
  const router = await source('src/router/index.ts')

  assert.doesNotMatch(scenario, /path:\s*'\/monitor\/mysql\/alert'/)
  assert.match(scenario, /getAlertPath\(inst\.value\?\.dbType\)/)
  assert.match(router, /resolvePathAfterSwitch\(to\.path/)
})

test('generic drilldown step links are resolved by profile database type', async () => {
  const drilldown = await source('src/config/alertDrilldown.ts')

  assert.match(drilldown, /postgresql:\s*\{[\s\S]*?realtime:\s*'\/monitor\/pg\/realtime'/)
  assert.match(drilldown, /mysql:\s*\{[\s\S]*?realtime:\s*'\/monitor\/mysql\/realtime'/)
  assert.match(drilldown, /resolveStepLink\(s\.link, vo\.dbType\)/)
})