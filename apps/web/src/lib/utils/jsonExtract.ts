const FENCE_OPEN = /^\s*```(?:json|javascript|js)?\s*\n?/i;
const FENCE_CLOSE = /\n?\s*```\s*$/;

export function extractJsonText(raw: string): string {
  if (!raw) return "";
  let text = raw.trim();

  const candidates = [text.indexOf("{"), text.indexOf("[")].filter((i) => i >= 0);
  if (candidates.length > 0) {
    const first = Math.min(...candidates);
    if (first > 0) text = text.slice(first);
  }

  text = text.replace(FENCE_OPEN, "").replace(FENCE_CLOSE, "");
  return text.trim();
}

export function parseJsonLenient<T = unknown>(raw: string, fallback: T): T {
  try {
    return JSON.parse(extractJsonText(raw)) as T;
  } catch {
    return fallback;
  }
}
