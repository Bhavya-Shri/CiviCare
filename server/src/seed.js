import { closeDb, initDb } from './db.js'
import { seedDatabase } from './seedData.js'

await initDb()
const result = await seedDatabase({ reset: true })
console.log('CiviCare seed complete.', result)
await closeDb()
