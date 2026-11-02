const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#96;",
};

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"'`/]/g, (ch) => HTML_ENTITIES[ch] ?? ch);
}

/**
 * Normalizes input text: trims, collapses whitespace,
 * and strips HTML tags + dangerous unicode control chars.
 * React escapes on render, but this protects raw data.
 */
export function sanitizeText(input: unknown, maxLength = 1000): string {
  if (typeof input !== "string") return "";
  const stripped = input
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?[^>]+(>|$)/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return Array.from(stripped).slice(0, maxLength).join("");
}
