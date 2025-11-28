type SanitizeOptions = {
  maxLength?: number
}

/**
 * Removes HTML/script content and control characters from incoming strings.
 * This gives us a deterministic, idempotent value safe for rendering.
 */
export function sanitizeText(value: unknown, options?: SanitizeOptions): string {
  if (typeof value !== 'string') {
    if (value === null || value === undefined) return ''
    return sanitizeText(String(value), options)
  }

  const maxLength = options?.maxLength ?? 500

  const stripped = value
    // Remove script/style blocks entirely.
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove any remaining HTML tags.
    .replace(/<\/?[^>]+(>|$)/g, '')
    // Remove inline event handlers or suspicious attributes.
    .replace(/\son\w+="[^"]*"/gi, '')
    // Collapse control characters.
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .trim()

  return stripped.slice(0, maxLength)
}


