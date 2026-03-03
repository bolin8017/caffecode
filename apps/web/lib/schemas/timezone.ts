import { z } from 'zod'

const VALID_TIMEZONES = new Set(Intl.supportedValuesOf('timeZone'))

export const timezoneSchema = z.string().refine(
  (tz) => VALID_TIMEZONES.has(tz),
  'Invalid IANA timezone'
)
