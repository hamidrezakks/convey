import { randomBytes } from 'node:crypto';
import { db, queryClient } from '../src/db';
import { apiKeys } from '../src/db/schema';
import { UserRole } from '../src/modules/auth/access-policy';
import { hashString } from '../src/utils/crypto';

const [tenantId, team, name, role = 'DEVELOPER', scope = 'tenant', environment = 'production'] = process.argv.slice(2);
if (
  !tenantId ||
  !team ||
  !name ||
  !Object.values(UserRole).includes(role as UserRole) ||
  !['tenant', 'platform'].includes(scope) ||
  !['sandbox', 'production'].includes(environment)
) {
  console.error(
    'Usage: bun apps/server/scripts/create-api-key.ts TENANT_ID TEAM NAME [ROLE] [tenant|platform] [sandbox|production]',
  );
  process.exit(1);
}
const key = `${environment === 'sandbox' ? 'sk_test_' : 'sk_live_'}${randomBytes(32).toString('hex')}`;
try {
  await db.insert(apiKeys).values({
    id: crypto.randomUUID(),
    tenantId,
    team,
    name,
    role,
    scope,
    sandboxOnly: environment === 'sandbox',
    keyHash: hashString(key),
  });
  console.log(key); // Display exactly once; only the hash is persisted.
} finally {
  await queryClient.close();
}
