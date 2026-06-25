export type ParsedPlan = {
  add: Array<{ name: string; quantity?: number; note?: string }>;
  remove: Array<{ name: string }>;
  adjust: Array<{ name: string; delta: number }>;
  raw: string;
};

const UNITS = [
  "can",
  "cans",
  "lb",
  "pound",
  "pounds",
  "lbs",
  "oz",
  "ounces",
  "bag",
  "bags",
  "dozen",
  "pack",
  "packs",
];

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const FILLER_TOKENS = new Set([
  "and",
  "also",
  "please",
  "hey",
  "can",
  "you",
  "to",
  "the",
  "a",
  "an",
]);

function parseQuantity(token?: string): number | undefined {
  if (!token) return undefined;
  const numeric = Number(token);
  if (!Number.isNaN(numeric)) return numeric;
  return NUMBER_WORDS[token as keyof typeof NUMBER_WORDS];
}

function normalizeToken(token: string): string {
  return token.replace(/[.,;:!?]+$/g, "");
}

function cleanName(value: string): string {
  return value.replace(/[.,;:!?]+$/g, "").replace(/\s+/g, " ").trim();
}

function splitItems(phrase: string): string[] {
  return phrase
    .replace(/,\s*and\s+/gi, ", ")
    .replace(/,\s*plus\s+/gi, ", ")
    .split(/(?:\s*,\s*|\s*\band\b\s*|\s*\bplus\b\s*)/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parseVoiceToPlan(textRaw: string): ParsedPlan {
  const trimmed = textRaw?.trim();
  if (!trimmed) {
    return { add: [], remove: [], adjust: [], raw: textRaw };
  }

  const lower = trimmed.toLowerCase();
  const plan: ParsedPlan = { add: [], remove: [], adjust: [], raw: textRaw };

  if (/^(remove|delete|drop|take off)\b/.test(lower)) {
    const itemsText = lower.replace(/^(remove|delete|drop|take off)\s+/, "");
    for (const name of splitItems(itemsText)) {
      const cleaned = cleanName(name.replace(/\b(of|some)\b\s*/g, ""));
      if (cleaned) plan.remove.push({ name: cleaned });
    }
    return plan;
  }

  const inc = lower.match(/^(increase|add|plus)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(.*)$/);
  const dec = lower.match(/^(decrease|subtract|minus)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(.*)$/);
  if (inc || dec) {
    const [, , qtyToken, rest] = (inc || dec)!;
    const quantity = parseQuantity(qtyToken) ?? 1;
    const delta = inc ? quantity : -quantity;
    for (const target of splitItems(rest)) {
      const cleaned = cleanName(target);
      if (cleaned) plan.adjust.push({ name: cleaned, delta });
    }
    return plan;
  }

  const itemsText = lower.replace(/^(add|put|insert|i need|i want|get|please add|can you add)\s+/, "");
  const phrases = splitItems(itemsText);

  for (const phrase of phrases) {
    const tokens = phrase.split(/\s+/).filter(Boolean);
    let index = 0;
    let currentQty: number | undefined;
    let buffer: string[] = [];

    const pushItem = () => {
      const rawName = buffer.join(" ").replace(/\b(of|some)\b\s*/g, "").trim();
      buffer = [];
      const quantityValue = typeof currentQty === "number" && Number.isFinite(currentQty) ? currentQty : undefined;
      currentQty = undefined;
      if (!rawName) return;

      const noteMatch = rawName.match(/^(.*)\((.*)\)\s*$/);
      let name = noteMatch ? noteMatch[1].trim() : rawName;
      let note = noteMatch ? noteMatch[2].trim() : undefined;

      name = cleanName(name);
      if (!name) return;

      if (note) {
        note = cleanName(note);
        if (!note) note = undefined;
      }

      const existing = plan.add.find((item) => item.name === name);
      if (existing) {
        const baseQuantity = existing.quantity ?? 1;
        const incoming = quantityValue ?? 1;
        existing.quantity = baseQuantity + incoming;
        if (note) {
          existing.note = existing.note ? `${existing.note}, ${note}` : note;
        }
        return;
      }

      plan.add.push({ name, quantity: quantityValue, note });
    };

    while (index < tokens.length) {
      const normalized = normalizeToken(tokens[index]);
      if (!normalized) {
        index += 1;
        continue;
      }

      const quantityValue = parseQuantity(normalized);
      if (quantityValue !== undefined) {
        if (buffer.length) pushItem();
        currentQty = quantityValue;
        if (tokens[index + 1]) {
          const maybeUnit = normalizeToken(tokens[index + 1]);
          if (maybeUnit && UNITS.includes(maybeUnit)) {
            index += 2;
            continue;
          }
        }
        index += 1;
        continue;
      }

      if (FILLER_TOKENS.has(normalized)) {
        index += 1;
        continue;
      }

      buffer.push(normalized);
      index += 1;
    }

    if (buffer.length) pushItem();
  }

  return plan;
}
