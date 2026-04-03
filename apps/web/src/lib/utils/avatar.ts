/**
 * Resolves a relative avatar path to a full URL.
 * Returns null if no avatar URL is provided.
 */
export function getAvatarUrl(
  avatarUrl: string | null | undefined,
): string | null {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith("http")) return avatarUrl;
  return `/api${avatarUrl}`;
}
