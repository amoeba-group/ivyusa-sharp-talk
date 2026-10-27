/**
 * How a staff user is named on console screens (PLN-261027 D1).
 *
 * Most accounts are invited by email and never get a `name` (staging, 10/27:
 * 11 of 12 go2joy users), so screens that read `name` alone showed every
 * agent as the generic "상담원". The address's local part is short enough for
 * a chat bubble and still tells two agents apart. Staff addresses are not
 * customer PII, and this is only ever shown inside the tenant's console —
 * the widget keeps its own tenant-set agent label.
 */
export function staffDisplayName(user: { name?: string | null; email?: string | null } | null | undefined): string | null {
  if (!user) return null;
  const name = user.name?.trim();
  if (name) return name;
  const email = user.email?.trim();
  if (!email) return null;
  const at = email.indexOf('@');
  return at > 0 ? email.slice(0, at) : email;
}
