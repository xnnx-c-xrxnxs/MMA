/**
 * JwtConfig — provider-agnostic JWT verification configuration.
 *
 * Reads generic env vars that work with any OIDC-compliant provider:
 *   JWT_JWKS_URI        — JWKS endpoint URL (required in non-local environments)
 *   JWT_ISSUER          — expected token issuer (required in non-local environments)
 *   JWT_USER_ID_CLAIM   — token claim carrying the app user ID (default: 'custom:userId')
 *   JWT_USER_ROLE_CLAIM — token claim carrying the user role  (default: 'custom:userRole')
 *
 * ── Provider examples ────────────────────────────────────────────────────────
 *
 * AWS Cognito (default — Terraform computes these from User Pool outputs):
 *   JWT_JWKS_URI        = https://cognito-idp.{region}.amazonaws.com/{poolId}/.well-known/jwks.json
 *   JWT_ISSUER          = https://cognito-idp.{region}.amazonaws.com/{poolId}
 *   JWT_USER_ID_CLAIM   = custom:userId      ← Cognito custom attribute
 *   JWT_USER_ROLE_CLAIM = custom:userRole    ← Cognito custom attribute
 *
 * Auth0:
 *   JWT_JWKS_URI        = https://your-tenant.auth0.com/.well-known/jwks.json
 *   JWT_ISSUER          = https://your-tenant.auth0.com/
 *   JWT_USER_ID_CLAIM   = sub
 *   JWT_USER_ROLE_CLAIM = https://your-namespace/role
 *
 * Keycloak:
 *   JWT_JWKS_URI        = https://host/realms/{realm}/protocol/openid-connect/certs
 *   JWT_ISSUER          = https://host/realms/{realm}
 *   JWT_USER_ID_CLAIM   = sub
 *   JWT_USER_ROLE_CLAIM = preferred_username   (or a custom mapper claim)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class JwtConfig {
  /** JWKS endpoint URL — required in non-local environments. */
  static readonly jwksUri = process.env.JWT_JWKS_URI ?? '';

  /** Expected token issuer — required in non-local environments. */
  static readonly issuer = process.env.JWT_ISSUER ?? '';

  /**
   * JWT claim name for the application user ID.
   * Defaults to 'custom:userId' (AWS Cognito custom attribute).
   * Set JWT_USER_ID_CLAIM='sub' for providers that use the standard subject claim.
   */
  static readonly userIdClaim = process.env.JWT_USER_ID_CLAIM ?? 'custom:userId';

  /**
   * JWT claim name for the user role.
   * Defaults to 'custom:userRole' (AWS Cognito custom attribute).
   * Override JWT_USER_ROLE_CLAIM to match your provider's role/group claim.
   */
  static readonly userRoleClaim = process.env.JWT_USER_ROLE_CLAIM ?? 'custom:userRole';

  /** Validates required env vars are set. Called by the guard constructor in non-local mode. */
  static validate(): void {
    if (!this.jwksUri) {
      throw new Error('JWT_JWKS_URI must be set in non-local environments');
    }
    if (!this.issuer) {
      throw new Error('JWT_ISSUER must be set in non-local environments');
    }
  }
}
