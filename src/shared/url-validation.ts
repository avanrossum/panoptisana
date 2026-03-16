// ══════════════════════════════════════════════════════════════════════════════
// URL VALIDATION
// Security utilities for validating URLs before making outbound requests.
// Prevents SSRF by blocking requests to private/internal network addresses.
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a hostname resolves to a private/internal IP range.
 * Blocks: localhost, 127.x, 10.x, 172.16-31.x, 192.168.x, 169.254.x (link-local/AWS metadata),
 * [::1], [fe80::], [fc00::], [fd00::], 0.0.0.0, and numeric IP forms.
 */
export function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();

  // Localhost
  if (h === 'localhost' || h === 'localhost.localdomain') return true;

  // IPv6 loopback and private ranges (may appear with brackets in URLs)
  const cleanIpv6 = h.replace(/^\[|\]$/g, '');
  if (cleanIpv6 === '::1') return true;
  if (cleanIpv6.startsWith('fe80:')) return true;  // Link-local
  if (cleanIpv6.startsWith('fc00:') || cleanIpv6.startsWith('fd00:')) return true;  // Unique local
  if (cleanIpv6 === '::') return true;  // Unspecified

  // IPv4 checks
  const ipv4Match = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    // 0.0.0.0/8 — "this" network
    if (a === 0) return true;
    // 10.0.0.0/8 — private
    if (a === 10) return true;
    // 127.0.0.0/8 — loopback
    if (a === 127) return true;
    // 169.254.0.0/16 — link-local (AWS metadata at 169.254.169.254)
    if (a === 169 && b === 254) return true;
    // 172.16.0.0/12 — private
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16 — private
    if (a === 192 && b === 168) return true;
  }

  // .local, .internal, .localhost TLDs
  if (h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost')) return true;

  return false;
}

/**
 * Validate that a URL is safe for outbound fetch (not targeting private/internal networks).
 * Returns true if the URL is safe to fetch, false if it should be blocked.
 */
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Only allow http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;

    // Block private/internal hostnames
    if (isPrivateHostname(parsed.hostname)) return false;

    return true;
  } catch {
    return false;
  }
}
