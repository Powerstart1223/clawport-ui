/**
 * Safely retrieve a required environment variable at runtime.
 * Call inside functions (not at module top level) so imports don't crash during build/test.
 */
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `See .env.example for configuration.`
    )
  }
  return value
}
