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
test('database-specific SQL validation never defaults to MySQL', async () => {
  const safety = await source('src/utils/sqlSafety.ts')
  const customRule = await source('src/views/monitor/shared/alert/components/CustomRuleDialog.vue')
  const builtinRule = await source('src/views/system/builtin-rule/index.vue')

  assert.match(safety, /normalized === 'MYSQL'[\s\S]*normalized === 'POSTGRESQL'/)
  assert.match(safety, /'Postgresql'/)
  assert.doesNotMatch(safety, /astify\([^\n]+database:\s*'MySQL'/)
  assert.match(customRule, /validateQueryOnlySql\(String\(value \?\? ''\), props\.dbType\)/)
  assert.match(customRule, /validateQueryOnlySql\(form\.customSql, props\.dbType\)/)
  assert.match(builtinRule, /validateQueryOnlySql\(form\.customSql, dbType\)/)
})

test('slow SQL copy has an explicit unknown database type branch', async () => {
  const slowSql = await source('src/views/monitor/shared/slowsql/index.vue')

  assert.match(slowSql, /'mysql' \| 'postgresql' \| 'unknown'/)
  assert.match(slowSql, /系统不会按 MySQL 规则进行降级处理/)
  assert.doesNotMatch(slowSql, /const isPg[\s\S]{0,300}\?[^:]+:\s*'基于 performance_schema/)
})

test('absolute drilldown routes cannot cross database type groups', async () => {
  const drilldown = await source('src/config/alertDrilldown.ts')

  assert.match(drilldown, /startsWith\('\/monitor\/mysql\/'\)/)
  assert.match(drilldown, /startsWith\('\/monitor\/pg\/'\)/)
  assert.match(drilldown, /dbType\?\.toLowerCase\(\) === routeType \? link : undefined/)
})

test('instance edit keeps database type and version immutable', async () => {
  const instancePage = await source('src/views/system/instance/index.vue')

  assert.match(instancePage, /v-model="form\.dbTypeId"[^>]*:disabled="!!form\.id"/)
  assert.match(instancePage, /v-model="form\.dbVersionId"[^>]*:disabled="!!form\.id"/)
})
