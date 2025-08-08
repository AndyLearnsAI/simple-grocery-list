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
  const itemsText = lower.replace(/^(add|put|insert|i need|i want|get)\s+/, "");
  const phrases = splitItems(itemsText);
  for (const p of phrases) {
    const tokens = p.split(/\s+/);
    let quantity: number | undefined;
    let note: string | undefined;

    // Quantity early
    const maybeQty = parseQuantity(tokens[0]);
    if (maybeQty) {
      quantity = maybeQty;
      // Optional unit after quantity, drop it if present
      if (tokens[1] && UNITS.includes(tokens[1])) {
        tokens.splice(0, 2);
      } else {
        tokens.splice(0, 1);
      }
    }

    const joined = tokens.join(" ");
    // Note in parentheses e.g., apples (ripe)
    const noteMatch = joined.match(/^(.*)\((.*)\)\s*$/);
    let name: string;
    if (noteMatch) {
      name = noteMatch[1].trim();
      const n = noteMatch[2].trim();
      if (n) note = n;
    } else {
      name = joined;
    }
    name = name.replace(/\b(of|some)\b\s*/g, "").trim();
    if (name) plan.add.push({ name, quantity, note });
  }

  return plan;
}


