export type ParsedPlan = {
  add: Array<{ name: string; quantity?: number; note?: string }>;
  remove: Array<{ name: string }>;
  adjust: Array<{ name: string; delta: number }>;
  raw: string;
};

const UNITS = [
  "can","cans","lb","pound","pounds","lbs","oz","ounces","bag","bags","dozen","pack","packs"
];
const NUMBER_WORDS: Record<string, number> = {
  one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10
};

function parseQuantity(token?: string): number | undefined {
  if (!token) return undefined;
  const n = Number(token);
  if (!Number.isNaN(n)) return n;
  return NUMBER_WORDS[token as keyof typeof NUMBER_WORDS];
}

function splitItems(phrase: string): string[] {
  return phrase
    .split(/\s*(?:,| and | plus )\s+/i)
    .map(s => s.trim())
    .filter(Boolean);
}

export function parseVoiceToPlan(textRaw: string): ParsedPlan {
  const text = textRaw?.trim();
  if (!text) return { add: [], remove: [], adjust: [], raw: textRaw };
  const lower = text.toLowerCase();

  const plan: ParsedPlan = { add: [], remove: [], adjust: [], raw: textRaw };

  // Undo intent is handled in UI level; not included in plan

  // Remove patterns
  if (/^(remove|delete|drop|take off)\b/.test(lower)) {
    const itemsText = lower.replace(/^(remove|delete|drop|take off)\s+/, "");
    const names = splitItems(itemsText);
    for (const name of names) {
      plan.remove.push({ name: name.replace(/\b(of|some)\b\s*/g, "").trim() });
    }
    return plan;
  }

  // Adjust patterns
  const inc = lower.match(/^(increase|add|plus)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(.*)$/);
  const dec = lower.match(/^(decrease|subtract|minus)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(.*)$/);
  if (inc || dec) {
    const [, , qtyToken, rest] = (inc || dec)!;
    const delta = parseQuantity(qtyToken) ?? 1;
    const sign = inc ? +1 : -1;
    const names = splitItems(rest);
    for (const name of names) {
      plan.adjust.push({ name: name.trim(), delta: sign * delta });
    }
    return plan;
  }

  // Add patterns (default)
  const itemsText = lower.replace(/^(add|put|insert|i need|i want|get|please add|can you add)\s+/, "");
  const phrases = splitItems(itemsText);
  for (const p of phrases) {
    const tokens = p.split(/\s+/).filter(Boolean);
    // Scan for repeating segments of [qty] [name tokens until next qty]
    let i = 0;
    let currentQty: number | undefined = undefined;
    let nameBuffer: string[] = [];

    const flush = () => {
      const rawName = nameBuffer.join(" ").replace(/\b(of|some)\b\s*/g, "").trim();
      if (!rawName) return;
      // Handle note in parentheses
      const noteMatch = rawName.match(/^(.*)\((.*)\)\s*$/);
      let name = rawName;
      let note: string | undefined;
      if (noteMatch) {
        name = noteMatch[1].trim();
        note = noteMatch[2].trim();
      }
      plan.add.push({ name, quantity: currentQty, note });
      nameBuffer = [];
      currentQty = undefined;
    };

    while (i < tokens.length) {
      const t = tokens[i];
      const qty = parseQuantity(t);
      if (qty) {
        // If we already accumulated a name, flush before starting next group
        if (nameBuffer.length) flush();
        currentQty = qty;
        // Optional unit after qty
        if (tokens[i + 1] && UNITS.includes(tokens[i + 1])) {
          i += 2;
          continue;
        }
        i += 1;
        continue;
      }
      // Ignore filler words
      if (/^(and|also|please|hey|can|you|to|the)$/.test(t)) { i += 1; continue; }
      nameBuffer.push(t);
      i += 1;
    }
    if (nameBuffer.length) flush();
  }

  return plan;
}


