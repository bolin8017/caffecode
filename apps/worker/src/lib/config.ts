import { envSchema } from './config.schema.js'

export const config = envSchema.parse(process.env)
