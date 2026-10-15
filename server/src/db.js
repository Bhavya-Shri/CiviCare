import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const schemaPath = path.resolve(__dirname, '../../database/schema.sql')
const dataDir = path.resolve(__dirname, '../.pglite')

let mode = 'pglite'
let pool = null
let pglite = null
let chain = Promise.resolve()

function enqueue(task) {
  const run = chain.then(task, task)
  chain = run.then(() => undefined, () => undefined)
  return run
}

export function databaseMode() {
  return mode
}

export async function initDb() {
  if (process.env.DATABASE_URL) {
    mode = 'postgres'
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    await pool.query('SELECT 1')
    return
  }

  const { PGlite } = await import('@electric-sql/pglite')
  const { postgis } = await import('@electric-sql/pglite-postgis')
  fs.mkdirSync(dataDir, { recursive: true })
  const created = new PGlite({ dataDir, extensions: { postgis } })
  pglite = typeof created?.then === 'function' ? await created : created
  await pglite.waitReady
  mode = 'pglite'
}

function rowsOf(result) {
  return result?.rows ?? []
}

async function rawQuery(text, params = [], client = null) {
  if (mode === 'postgres') {
    const result = await (client ?? pool).query(text, params)
    return rowsOf(result)
  }
  const result = await pglite.query(text, params)
  return rowsOf(result)
}

export function query(text, params = []) {
  return enqueue(() => rawQuery(text, params))
}

export async function withTransaction(fn, { rollback = false } = {}) {
  return enqueue(async () => {
    if (mode === 'postgres') {
      const client = await pool.connect()
      const tx = {
        query: (text, params = []) => rawQuery(text, params, client),
      }
      try {
        await client.query('BEGIN')
        const value = await fn(tx)
        await client.query(rollback ? 'ROLLBACK' : 'COMMIT')
        return value
      } catch (error) {
        try {
          await client.query('ROLLBACK')
        } catch {
          // Keep the original error.
        }
        throw error
      } finally {
        client.release()
      }
    }

    await rawQuery('BEGIN')
    try {
      const tx = {
        query: (text, params = []) => rawQuery(text, params),
      }
      const value = await fn(tx)
      await rawQuery(rollback ? 'ROLLBACK' : 'COMMIT')
      return value
    } catch (error) {
      try {
        await rawQuery('ROLLBACK')
      } catch {
        // Keep the original error.
      }
      throw error
    }
  })
}

export async function execSql(sql) {
  return enqueue(async () => {
    if (mode === 'postgres') {
      await pool.query(sql)
      return
    }
    await pglite.exec(sql)
  })
}

export async function schemaReady() {
  const rows = await query(`SELECT to_regclass('public.users') AS users_table`)
  return Boolean(rows[0]?.users_table)
}

export async function applySchema() {
  const sql = fs.readFileSync(schemaPath, 'utf8')
  await execSql(sql)
}

export async function resetDatabase() {
  await execSql('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;')
  await applySchema()
}

export async function closeDb() {
  if (pool) await pool.end()
  if (pglite) await pglite.close()
  pool = null
  pglite = null
}
