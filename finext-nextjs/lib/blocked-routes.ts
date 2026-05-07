/**
 * Centralized list of routes that should return 403 Forbidden.
 *
 * Use cases:
 * - Pages whose UI links have been disconnected (per compliance pivot)
 *   but whose code we keep. middleware.ts intercepts direct URL access.
 *
 * Each entry is matched as exact path OR prefix (with trailing slash).
 *
 * To add: append a string to BLOCKED_ROUTES, no other change needed.
 * To remove: delete the entry.
 */
export const BLOCKED_ROUTES: readonly string[] = [
  // Disconnected pages (compliance pivot 2026-05-07)
  '/open-account',
  '/profile/subscriptions',
  '/auth/google/callback',
] as const;

/**
 * Returns true if the given pathname matches any blocked route exactly
 * or as a prefix path segment.
 */
export function isBlockedRoute(pathname: string): boolean {
  return BLOCKED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/'),
  );
}
