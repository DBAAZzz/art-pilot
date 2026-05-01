export type DesktopEnv = {
  NODE_ENV: 'development' | 'production'
  DEBUG_VERBOSE: boolean
}

export function getDesktopEnv(): DesktopEnv {
  return {
    NODE_ENV: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    DEBUG_VERBOSE: process.env.DEBUG_VERBOSE === 'true' || process.env.DEBUG_VERBOSE === '1',
  }
}
