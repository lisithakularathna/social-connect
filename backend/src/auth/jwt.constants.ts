import 'dotenv/config';

/**
 * Single source of truth for the JWT signing secret.
 *
 * Set JWT_SECRET in backend/.env for any real deployment. The fallback keeps
 * existing local tokens valid so development setups don't break.
 */
export const JWT_SECRET =
  process.env['JWT_SECRET'] || 'social-connect-secret-key';

export const JWT_EXPIRES_IN = process.env['JWT_EXPIRES_IN'] || '7d';

if (!process.env['JWT_SECRET'] && process.env['NODE_ENV'] === 'production') {
  console.warn(
    '[auth] JWT_SECRET is not set — using the insecure development fallback.',
  );
}
