const HALF_TO_FULL_WIDTH: Record<string, string> = {
  ',': '，',
  '.': '。',
  '?': '？',
  '!': '！',
  ':': '：',
  ';': '；',
}

export function normalizeForMatch(s: string): string {
  const trimmed = s.trim()
  return trimmed.replace(/[,.?!:;]/g, (char) => HALF_TO_FULL_WIDTH[char])
}

export function isExactMatch(input: string, target: string): boolean {
  return normalizeForMatch(input) === normalizeForMatch(target)
}
