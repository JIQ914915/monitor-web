import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const pgViewsRoot = path.join(projectRoot, 'src/views/monitor/pg')

async function findVueFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return findVueFiles(entryPath)
    return entry.isFile() && entry.name.endsWith('.vue') ? [entryPath] : []
  }))
  return nested.flat()
}

test('PG views do not import MySQL view implementations directly', async () => {
  const vueFiles = await findVueFiles(pgViewsRoot)
  const violations = []

  for (const file of vueFiles) {
    const source = await readFile(file, 'utf8')
    if (source.includes("@/views/monitor/mysql/")) {
      violations.push(path.relative(projectRoot, file))
    }
  }

  assert.deepEqual(violations, [])
})
