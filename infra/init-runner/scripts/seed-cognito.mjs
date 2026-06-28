/**
 * Seed Cognito — Create initial admin user in Cognito User Pool
 *
 * Idempotent: if the user already exists, updates the role attribute and skips creation.
 *
 * Cognito generates a random temporary password and emails it to SEED_ADMIN_EMAIL.
 * The admin must change the password on first sign-in (NEW_PASSWORD_REQUIRED challenge).
 *
 * Required env vars (set in github-secrets.* via SENSITIVE_VARS → Secrets Manager):
 *   COGNITO_USER_POOL_ID — Cognito User Pool ID (resolved automatically by Terraform)
 *   SEED_ADMIN_EMAIL     — Email address for the initial admin user
 *
 * Optional env vars:
 *   SEED_ADMIN_USER_ID   — Domain user ID for custom:userId (UUID format recommended).
 *                          If omitted, a random UUID is generated and logged.
 *                          Set an explicit value for a stable, repeatable ID.
 *   SEED_ADMIN_ROLE      — Cognito custom:userRole attribute. Defaults to 'ADMIN'.
 *
 * AWS_REGION is injected automatically by ECS Fargate.
 */

import { randomUUID } from 'crypto';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminUpdateUserAttributesCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
if (!USER_POOL_ID) {
  throw new Error('COGNITO_USER_POOL_ID env var is required');
}

const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL;
if (!SEED_ADMIN_EMAIL) {
  throw new Error(
    'SEED_ADMIN_EMAIL env var is required — set it in github-secrets.* via SENSITIVE_VARS',
  );
}

const SEED_ADMIN_USER_ID = process.env.SEED_ADMIN_USER_ID || randomUUID();
if (!process.env.SEED_ADMIN_USER_ID) {
  console.warn(`[seed-cognito] SEED_ADMIN_USER_ID not set — using generated ID: ${SEED_ADMIN_USER_ID}`);
  console.warn('[seed-cognito] Tip: add SEED_ADMIN_USER_ID to SENSITIVE_VARS for a stable, repeatable domain ID.');
}

const SEED_ADMIN_ROLE = process.env.SEED_ADMIN_ROLE || 'ADMIN';

const client = new CognitoIdentityProviderClient({});

const SEED_ADMIN = {
  email: SEED_ADMIN_EMAIL,
  userId: SEED_ADMIN_USER_ID,
  userRole: SEED_ADMIN_ROLE,
};

async function seedUser(user) {
  console.log(
    `[seed-cognito] Creating Cognito user "${user.email}" in pool "${USER_POOL_ID}"...`,
  );

  try {
    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: user.email,
        UserAttributes: [
          { Name: 'email', Value: user.email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'custom:userId', Value: user.userId },
          { Name: 'custom:userRole', Value: user.userRole },
        ],
        // No MessageAction — Cognito generates a random temporary password and
        // emails it to the user. No TemporaryPassword field — let Cognito own it.
        // The admin must complete the NEW_PASSWORD_REQUIRED challenge on first sign-in.
      }),
    );

    console.log(
      `[seed-cognito]   ✓ User "${user.email}" created. Cognito has emailed a temporary password to that address.`,
    );
  } catch (error) {
    if (error.name === 'UsernameExistsException') {
      console.log(`[seed-cognito]   ⓘ User "${user.email}" already exists — skipping creation`);

      // Update the role attribute only.
      // custom:userId must not be overwritten — it is the user's stable domain ID.
      await client.send(
        new AdminUpdateUserAttributesCommand({
          UserPoolId: USER_POOL_ID,
          Username: user.email,
          UserAttributes: [{ Name: 'custom:userRole', Value: user.userRole }],
        }),
      );
      console.log(`[seed-cognito]   ✓ Role attribute updated for "${user.email}"`);
    } else {
      throw error;
    }
  }
}

console.log('[seed-cognito] Starting Cognito user seed...');
await seedUser(SEED_ADMIN);
console.log('[seed-cognito] ✓ Cognito seed complete');
