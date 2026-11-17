/**
 * What this deployment's console shows (PLN-261117-IVY-Hide-Go2Joy).
 *
 * The branch `deploy/talk-ivyusa` serves IVY USA only and is never merged into
 * `main`, so the switch lives in the code of the branch: no server setting to
 * forget, and the deployments of other customers are untouched.
 *
 * Hidden, not removed: the Go2Joy code stays as it is and is simply not drawn.
 * This is not access control — the API endpoints still exist.
 */

/** Go2Joy (hotel booking partner): its platform connection and the business-customer (hotel) list. */
export const GO2JOY_ENABLED = false;
