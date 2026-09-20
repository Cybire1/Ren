import { createDatabase } from '@kova/db'
import { config } from './config.js'

export const db = createDatabase(config.DATABASE_URL)
export { schema } from '@kova/db'
