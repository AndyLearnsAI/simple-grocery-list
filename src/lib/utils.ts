import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parses smart syntax from user input to extract item name, quantity, and notes
 * Examples:
 * - "Chicken x3" → { itemName: "Chicken", quantity: 3 }
 * - "Chicken (when cheap)" → { itemName: "Chicken", quantity: 1, notes: "when cheap" }
 * - "Chicken x3 (when cheap)" → { itemName: "Chicken", quantity: 3, notes: "when cheap" }
 */
export function parseSmartSyntax(input: string): {
  itemName: string;
  quantity: number;
  notes?: string;
} {
  let itemName = input.trim();
  let quantity = 1;
  let notes: string | undefined;

  // Parse quantity (look for "x" followed by numbers)
  const quantityMatch = itemName.match(/\bx(\d+)\b/i);
  if (quantityMatch) {
    const parsedQuantity = parseInt(quantityMatch[1], 10);
    if (parsedQuantity > 0) {
      quantity = Math.min(99, parsedQuantity); // Cap at 99
    }
    // Remove quantity part from item name
    itemName = itemName.replace(/\bx\d+\b/i, '').trim();
  }

  // Parse notes (look for parentheses with content)
  const noteMatch = itemName.match(/\(([^)]+)\)/);
  if (noteMatch) {
    notes = noteMatch[1].trim();
    // Remove note part from item name
    itemName = itemName.replace(/\([^)]+\)/, '').trim();
  }

  // Clean up item name (remove extra spaces, ensure it's not empty)
  itemName = itemName.replace(/\s+/g, ' ').trim();
  
  // If item name is empty after parsing, use original input
  if (!itemName) {
    itemName = input.trim();
    quantity = 1;
    notes = undefined;
  }

  return {
    itemName,
    quantity,
    notes
  };
}
