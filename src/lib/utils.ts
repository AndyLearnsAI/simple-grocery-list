import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import * as Icons from "lucide-react"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Pluralization mapping for common grocery items
 */
const PLURAL_MAPPINGS: Record<string, string> = {
  // Fruits
  'apples': 'apple',
  'bananas': 'banana',
  'oranges': 'orange',
  'grapes': 'grape',
  'berries': 'berry',
  'strawberries': 'strawberry',
  'blueberries': 'blueberry',
  'peaches': 'peach',
  'pears': 'pear',
  'mangoes': 'mango',
  'avocados': 'avocado',
  
  // Vegetables
  'carrots': 'carrot',
  'potatoes': 'potato',
  'tomatoes': 'tomato',
  'onions': 'onion',
  'peppers': 'pepper',
  'cucumbers': 'cucumber',
  'beans': 'bean',
  'peas': 'pea',
  
  // Dairy & Proteins
  'eggs': 'egg',
  'chickens': 'chicken',
  'steaks': 'steak',
  'chops': 'chop',
  
  // Pantry items
  'noodles': 'noodle',
  'crackers': 'cracker',
  'cookies': 'cookie',
  'chips': 'chip',
  'nuts': 'nut',
  'cereals': 'cereal',
  
  // Beverages
  'juices': 'juice',
  'sodas': 'soda',
  'waters': 'water',
  
  // Household
  'towels': 'towel',
  'bags': 'bag',
  'bottles': 'bottle',
  'cans': 'can'
};

/**
 * Icon mapping for common grocery items using Lucide React icon names
 */
const ICON_MAPPINGS: Record<string, string> = {
  // Fruits
  'apple': 'apple', 'apples': 'apple',
  'banana': 'banana', 'bananas': 'banana',
  'orange': 'orange', 'oranges': 'orange',
  'grape': 'grape', 'grapes': 'grape',
  'strawberry': 'shopping-basket', 'strawberries': 'shopping-basket',
  'cherry': 'cherry', 'cherries': 'cherry',
  'peach': 'shopping-basket', 'peaches': 'shopping-basket',
  'pineapple': 'shopping-basket',
  'mango': 'shopping-basket', 'mangoes': 'shopping-basket',
  'avocado': 'shopping-basket', 'avocados': 'shopping-basket',
  'coconut': 'shopping-basket',
  'kiwi': 'shopping-basket',
  'lemon': 'citrus', 'lemons': 'citrus',
  'melon': 'shopping-basket', 'watermelon': 'shopping-basket',
  'pear': 'shopping-basket', 'pears': 'shopping-basket',
  'olive': 'shopping-basket', 'olives': 'shopping-basket',
  
  // Vegetables
  'carrot': 'carrot', 'carrots': 'carrot',
  'potato': 'shopping-basket', 'potatoes': 'shopping-basket',
  'tomato': 'shopping-basket', 'tomatoes': 'shopping-basket',
  'corn': 'wheat',
  'eggplant': 'shopping-basket',
  'pepper': 'flame', 'peppers': 'flame',
  'broccoli': 'trees',
  'lettuce': 'leaf',
  'cucumber': 'shopping-basket', 'cucumbers': 'shopping-basket',
  'onion': 'shopping-basket', 'onions': 'shopping-basket',
  'garlic': 'shopping-basket',
  'mushroom': 'shopping-basket', 'mushrooms': 'shopping-basket',
  'pea': 'circle', 'peas': 'circle',
  
  // Dairy & Proteins
  'milk': 'milk',
  'cheese': 'milk',
  'butter': 'milk',
  'egg': 'egg', 'eggs': 'egg',
  'chicken': 'egg', 'chickens': 'egg',
  'beef': 'beef', 'steak': 'beef',
  'bacon': 'beef',
  'fish': 'fish',
  'shrimp': 'fish',
  'crab': 'fish',
  
  // Bread & Grains
  'bread': 'wheat',
  'bagel': 'wheat', 'bagels': 'wheat',
  'croissant': 'croissant',
  'pretzel': 'wheat',
  'rice': 'wheat',
  'pasta': 'wheat',
  'noodle': 'wheat', 'noodles': 'wheat',
  
  // Snacks & Sweets
  'cookie': 'cookie', 'cookies': 'cookie',
  'cake': 'cake',
  'donut': 'donut', 'donuts': 'donut',
  'chocolate': 'candy',
  'candy': 'candy',
  'ice cream': 'ice-cream-cone',
  'popcorn': 'popcorn',
  'chip': 'circle', 'chips': 'circle',
  'nut': 'nut', 'nuts': 'nut',
  'peanut': 'nut', 'peanuts': 'nut',
  'pizza': 'pizza',
  'sandwich': 'sandwich',
  'burger': 'sandwich',
  'hot dog': 'shopping-basket',
  'soup': 'soup',
  'salad': 'salad',
  'sushi': 'shopping-basket',
  'pancake': 'shopping-basket', 'pancakes': 'shopping-basket',
  'waffle': 'shopping-basket', 'waffles': 'shopping-basket',
  'ham': 'ham',
  
  // Beverages
  'coffee': 'coffee',
  'tea': 'coffee',
  'beer': 'beer',
  'wine': 'wine',
  'juice': 'cup-soda', 'juices': 'cup-soda',
  'water': 'droplets', 'waters': 'droplets',
  'soda': 'cup-soda', 'sodas': 'cup-soda',
  
  // Household & Personal Care
  'soap': 'waves',
  'toothbrush': 'brush',
  'toilet paper': 'scroll-text',
  'towel': 'shirt', 'towels': 'shirt',
  'detergent': 'spray-can',
  'shampoo': 'spray-can',
  'medicine': 'pill',
  
  // Other
  'oil': 'droplets',
  'salt': 'salt',
  'honey': 'droplets',
  'flour': 'wheat',
  'sugar': 'candy'
};

/**
 * Normalizes item names by handling pluralization
 */
export function normalizePlural(name: string): string {
  const normalized = name.toLowerCase().trim();
  return PLURAL_MAPPINGS[normalized] || normalized;
}

/**
 * Gets icon name for a given item name (for auto-icon assignment)
 */
export function getIconForItem(itemName: string): string | null {
  const normalized = itemName.toLowerCase().trim();
  return ICON_MAPPINGS[normalized] || ICON_MAPPINGS[normalizePlural(normalized)] || null;
}

/**
 * Parses smart syntax from user input to extract item name, quantity, and notes
 * Examples:
 * - "Chicken x3" → { itemName: "Chicken", quantity: 3 }
 * - "3x Chicken" → { itemName: "Chicken", quantity: 3 }
 * - "2x oranges" → { itemName: "oranges", quantity: 2 }
 * - "Chicken (when cheap)" → { itemName: "Chicken", quantity: 1, notes: "when cheap" }
 * - "Chicken x3 (when cheap)" → { itemName: "Chicken", quantity: 3, notes: "when cheap" }
 * - "2x apples (if fresh)" → { itemName: "apples", quantity: 2, notes: "if fresh" }
 */
export function parseSmartSyntax(input: string): {
  itemName: string;
  quantity: number;
  notes?: string;
} {
  let itemName = input.trim();
  let quantity = 1;
  let notes: string | undefined;

  // Parse quantity patterns:
  // 1. "item x3" - quantity after item name
  const quantityAfterMatch = itemName.match(/\bx(\d+)\b/i);
  if (quantityAfterMatch) {
    const parsedQuantity = parseInt(quantityAfterMatch[1], 10);
    if (parsedQuantity > 0) {
      quantity = Math.min(99, parsedQuantity); // Cap at 99
    }
    // Remove quantity part from item name
    itemName = itemName.replace(/\bx\d+\b/i, '').trim();
  } else {
    // 2. "3x item" - quantity before item name
    const quantityBeforeMatch = itemName.match(/^(\d+)x\s*(.+)/i);
    if (quantityBeforeMatch) {
      const parsedQuantity = parseInt(quantityBeforeMatch[1], 10);
      if (parsedQuantity > 0) {
        quantity = Math.min(99, parsedQuantity); // Cap at 99
      }
      // Extract item name after quantity
      itemName = quantityBeforeMatch[2].trim();
    }
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
