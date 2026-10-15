import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import { initDb, query, schemaReady, applySchema, databaseMode } from './db.js'
import { errorMiddleware } from './http.js'
import { mountRoutes } from './routes.js'
import { refreshSyntheticClocks, seedDatabase } from './seedData.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const port = Number(process.env.PORT || 4000)

await initDb()
if (!(await schemaReady())) await applySchema()
const users = await query(`SELECT COUNT(*)::int AS n FROM users`)
if (Number(users[0].n) === 0) {
  const seeded = await seedDatabase({ reset: false })
  console.log('Seeded CiviCare database.', seeded)
} else {
  await refreshSyntheticClocks()
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '100kb' }))
app.get('/api/health/live', (_req, res) => {
  res.json({ ok: true, service: 'civicare', database: databaseMode() })
})
mountRoutes(app)

const clientDist = path.resolve(__dirname, '../../client/dist')
const clientIndex = path.join(clientDist, 'index.html')
if (fs.existsSync(clientIndex)) {
  app.use(express.static(clientDist))
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next()
    res.sendFile(clientIndex)
  })
}

app.use(errorMiddleware)

app.listen(port, () => {
  console.log(`CiviCare API on http://localhost:${port} (${databaseMode()})`)
})
