import { Parser } from 'node-sql-parser'

const parser = new Parser()

const dangerousQueryFeatures =
  /\binto\s+(outfile|dumpfile)\b|\b(load_file|sleep|benchmark)\s*\(|\bfor\s+update\b|\block\s+in\s+share\s+mode\b/i

export function validateQueryOnlySql(sql: string) {
  const normalized = stripTrailingSemicolon(sql.trim())
  if (!normalized) {
    throw new Error('请输入 SQL 查询语句')
  }
  if (dangerousQueryFeatures.test(normalized)) {
    throw new Error('SQL 包含高风险查询特性')
  }
  let ast: any
  try {
    ast = parser.astify(normalized, { database: 'MySQL' })
  } catch {
    throw new Error('SQL 解析失败，请检查语法')
  }
  if (Array.isArray(ast)) {
    if (ast.length !== 1) throw new Error('仅允许单条查询语句')
    ast = ast[0]
  }
  if (!ast || ast.type !== 'select') {
    throw new Error('仅允许查询类 SQL')
  }
  const first = firstToken(normalized)
  if (first !== 'select' && first !== 'with') {
    throw new Error('仅允许 SELECT/WITH 查询')
  }
}

function stripTrailingSemicolon(sql: string) {
  let result = sql
  while (result.endsWith(';')) {
    result = result.slice(0, -1).trim()
  }
  if (result.includes(';')) {
    throw new Error('SQL 不允许包含多语句分隔符')
  }
  return result
}

function firstToken(sql: string) {
  let s = sql.trimStart()
  if (s.startsWith('/*')) {
    const end = s.indexOf('*/')
    if (end >= 0) s = s.slice(end + 2).trimStart()
  }
  if (s.startsWith('--')) {
    const end = s.indexOf('\n')
    if (end >= 0) s = s.slice(end + 1).trimStart()
  }
  const match = s.match(/^[a-zA-Z]+/)
  return match ? match[0].toLowerCase() : ''
}
