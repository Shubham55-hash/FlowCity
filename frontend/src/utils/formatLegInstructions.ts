export function shortenPlaceLabel(raw: string, maxLen = 72): string {
  const s = raw.trim();
  if (!s) return '';
  if (s.length <= maxLen) return s;

  const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
  const head = parts[0] || s;
  const pin = parts.find((p) => /^\d{5,7}$/.test(p));

  if (parts.length >= 2) {
    const tail = pin || parts[Math.min(2, parts.length - 1)];
    let compact = tail !== head ? `${head}, ${tail}` : head;
    if (compact.length > maxLen) {
      const h = head.length > 48 ? `${head.slice(0, 44)}...` : head;
      compact = tail && tail !== head ? `${h}, ${tail}` : h;
    }
    return compact.length <= maxLen + 8 ? compact : `${head.slice(0, maxLen - 1)}...`;
  }

  return head.length > maxLen ? `${head.slice(0, maxLen - 1)}...` : head;
}

export function formatLegInstructions(fromRaw: string, toRaw: string): string {
  const from = fromRaw.trim();
  const to = toRaw.trim();
  if (!from && !to) return 'Route leg';
  if (!to || from === to) return shortenPlaceLabel(from || to);
  return `${shortenPlaceLabel(from)} \u2192 ${shortenPlaceLabel(to)}`;
}

export function splitLegInstruction(line: string): { from: string; to: string | null } {
  const parts = line.split(/\s*\u2192\s*|\s*->\s*/);
  if (parts.length < 2) return { from: line.trim(), to: null };
  const to = parts.slice(1).join(' \u2192 ').trim();
  return { from: parts[0].trim(), to: to || null };
}

export const formatRouteHeadline = formatLegInstructions;