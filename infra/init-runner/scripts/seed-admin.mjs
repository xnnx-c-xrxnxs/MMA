/**
 * Seed Admin — Idempotent Cognito admin user seed
 *
 * Creates the initial admin user in Cognito. This template ships without a
 * user-domain DynamoDB table, so this script only seeds Cognito. When you
 * add a user-domain, extend this script to also write the corresponding
 * DynamoDB record (see examples/infra/init-runner/scripts/seed-admin.mjs for
 * the full Cognito + DynamoDB reference implementation).
 *
 * UUID strategy:
 *   - If SEED_ADMIN_USER_ID is set → use it.
 *   - If not set and user does not exist in Cognito → generate a UUID and
 *     stamp it onto the Cognito custom:userId attribute. Log it so the
 *     developer can persist it via SENSITIVE_VARS.
 *   - If not set and user already exists in Cognito → reuse the existing
 *     custom:userId attribute (never rotated).
 *
 * Idempotency:
 *   Cognito — catches UsernameExistsException; updates userRole attribute only.
 *
 * Required env vars (set in github-secrets.* via SENSITIVE_VARS → Secrets Manager):
 *   COGNITO_USER_POOL_ID — injected automatically by Terraform
 *   SEED_ADMIN_EMAIL     — email address for the initial admin user
 *
 * Optional env vars:
 *   SEED_ADMIN_USER_ID — UUID for custom:userId. Auto-generated and logged
 *                        if not provided.
 *   SEED_ADMIN_ROLE    — Cognito role attribute. Defaults to 'ADMIN'.
 *
 * AWS_REGION is injected automatically by the Lambda runtime.
 */

import { randomUUID } from 'crypto';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
} from '@aws-sdk/client-cognito-identity-provider';

// ── Validate required env vars ────────────────────────────────────────────────

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

const SEED_ADMIN_ROLE = process.env.SEED_ADMIN_ROLE || 'ADMIN';

// ── Client ────────────────────────────────────────────────────────────────────

const cognitoClient = new CognitoIdentityProviderClient({});

// ── Resolve admin userId and create / update Cognito user ─────────────────────

let resolvedUserId = process.env.SEED_ADMIN_USER_ID || null;

console.log(`[seed-admin] Creating Cognito user "${SEED_ADMIN_EMAIL}" in pool "${USER_POOL_ID}"...`);

try {
  // Generate userId now if not provided — used for this Cognito create attempt.
  if (!resolvedUserId) {
    resolvedUserId = randomUUID();
    console.log(`[seed-admin] SEED_ADMIN_USER_ID not set — using generated ID: ${resolvedUserId}`);
    console.log('[seed-admin] Tip: add SEED_ADMIN_USER_ID to SENSITIVE_VARS for a stable, repeatable ID.');
  }

  await cognitoClient.send(
    new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: SEED_ADMIN_EMAIL,
      UserAttributes: [
        { Name: 'email', Value: SEED_ADMIN_EMAIL },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'custom:userId', Value: resolvedUserId },
        { Name: 'custom:userRole', Value: SEED_ADMIN_ROLE },
      ],
      // No MessageAction — Cognito generates a random temporary password and
      // emails it to the admin. No TemporaryPassword field — let Cognito own it.
      // The admin must complete the NEW_PASSWORD_REQUIRED challenge on first sign-in.
    }),
  );

  console.log(
    `[seed-admin] ✓ Cognito user "${SEED_ADMIN_EMAIL}" created with userId "${resolvedUserId}".`,
  );
  console.log('[seed-admin]   Cognito has emailed a temporary password to that address.');
} catch (error) {
  if (error.name === 'UsernameExistsException') {
    console.log(`[seed-admin] ⓘ Cognito user "${SEED_ADMIN_EMAIL}" already exists.`);

    // Fetch the existing custom:userId — never rotate it once set.
    const existingUser = await cognitoClient.send(
      new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: SEED_ADMIN_EMAIL,
      }),
    );

    const userIdAttr = existingUser.UserAttributes?.find(
      (a) => a.Name === 'custom:userId',
    );

    if (userIdAttr?.Value) {
      resolvedUserId = userIdAttr.Value;
      console.log(`[seed-admin]   Existing custom:userId: ${resolvedUserId}`);
    } else if (!resolvedUserId) {
      resolvedUserId = randomUUID();
      console.log(`[seed-admin]   No custom:userId found on existing user — generated: ${resolvedUserId}`);
    }

    // Update userRole in case it changed.
    await cognitoClient.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: USER_POOL_ID,
        Username: SEED_ADMIN_EMAIL,
        UserAttributes: [{ Name: 'custom:userRole', Value: SEED_ADMIN_ROLE }],
      }),
    );
    console.log(`[seed-admin]   ✓ Role attribute updated to "${SEED_ADMIN_ROLE}".`);
  } else {
    throw error;
  }
}

console.log('[seed-admin] ✓ Admin seed complete.');
