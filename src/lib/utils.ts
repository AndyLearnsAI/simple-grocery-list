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
  'strawberry': 'cherry', 'strawberries': 'cherry',
  'cherry': 'cherry', 'cherries': 'cherry',
  'peach': 'cherry', 'peaches': 'cherry',
  'pineapple': 'cherry',
  'mango': 'cherry', 'mangoes': 'cherry',
  'avocado': 'cherry', 'avocados': 'cherry',
  'coconut': 'cherry',
  'kiwi': 'cherry',
  'lemon': 'citrus', 'lemons': 'citrus',
  'melon': 'cherry', 'watermelon': 'cherry',
  
  // Vegetables
  'carrot': 'carrot', 'carrots': 'carrot',
  'potato': 'cherry', 'potatoes': 'cherry',
  'tomato': 'cherry', 'tomatoes': 'cherry',
  'corn': 'wheat',
  'eggplant': 'cherry',
  'pepper': 'flame', 'peppers': 'flame',
  'broccoli': 'trees',
  'lettuce': 'leaf',
  'cucumber': 'cherry', 'cucumbers': 'cherry',
  'onion': 'cherry', 'onions': 'cherry',
  'garlic': 'cherry',
  'mushroom': 'cherry', 'mushrooms': 'cherry',
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
  'croissant': 'wheat',
  'pretzel': 'wheat',
  'rice': 'wheat',
  'pasta': 'wheat',
  'noodle': 'wheat', 'noodles': 'wheat',
  
  // Snacks & Sweets
  'cookie': 'cookie', 'cookies': 'cookie',
  'cake': 'cake-slice',
  'donut': 'circle', 'donuts': 'circle',
  'chocolate': 'candy',
  'candy': 'candy',
  'ice cream': 'ice-cream',
  'popcorn': 'popcorn',
  'chip': 'circle', 'chips': 'circle',
  'nut': 'nut', 'nuts': 'nut',
  'peanut': 'nut', 'peanuts': 'nut',
  
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
 * Gets icon name for a given item name
 */
export function getIconForItem(itemName: string): string | null {
  const normalized = itemName.toLowerCase().trim();
  return ICON_MAPPINGS[normalized] || ICON_MAPPINGS[normalizePlural(normalized)] || null;
}

/**
 * Renders an SVG icon string for the given item name
 */
export function getIconSvgForItem(itemName: string): string | null {
  const iconName = getIconForItem(itemName);
  if (!iconName) return null;
  
  // Map icon names to their SVG paths
  const iconSvgMap: Record<string, string> = {
    'apple': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"/><path d="M10 2c1 .5 2 2 2 5"/></svg>',
    'banana': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13c3.5-2 8-2 10 2a5.5 5.5 0 0 1 8 5"/><path d="M5.15 17.89c5.52-1.52 8.65-6.89 7-12C11.55 4 11.5 2 13 2c3.22 0 5 5.5 5 8 0 6.5-4.2 12-10.49 12C5.11 22 2 22 2 20c0-1.5 1.14-1.55 3.15-2.11Z"/></svg>',
    'orange': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.54 15H17a2 2 0 0 0-2 2v4.54"/><path d="M7 3.34V5a3 3 0 0 0 3 3v0a2 2 0 0 1 2 2v0c0 1.1.9 2 2 2v0a2 2 0 0 0 2-2v0c0-1.1.9-2 2-2h3.17"/><path d="M11 21.95V18a2 2 0 0 0-2-2v0a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05"/><circle cx="12" cy="12" r="10"/></svg>',
    'cherry': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="18" r="4"/><path d="m8 14-1-3s-.5-2.5.5-4C9 5 11 4 11 4"/><circle cx="16" cy="18" r="4"/><path d="m16 14 1-3s.5-2.5-.5-4C15 5 13 4 13 4"/></svg>',
    'grape': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 5V2l-5.89 5.89"/><circle cx="16.6" cy="15.89" r="3"/><circle cx="8.11" cy="7.4" r="3"/><circle cx="12.35" cy="11.65" r="3"/><circle cx="13.91" cy="5.85" r="3"/><circle cx="18.15" cy="10.09" r="3"/><circle cx="6.56" cy="13.2" r="3"/><circle cx="10.8" cy="17.44" r="3"/><circle cx="5" cy="19" r="3"/></svg>',
    'carrot': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.27 21.7s9.87-3.5 12.73-6.36a4.5 4.5 0 0 0-6.36-6.37C5.77 11.84 2.27 21.7 2.27 21.7zM8.64 14l-2.05-2.04M15.34 15l-2.46-2.46"/><path d="M22 9s-1.33-2-3.5-2C16.86 7 15 9 15 9s1.33 2 3.5 2S22 9 22 9z"/><path d="M15 2s-2 1.33-2 3.5S15 9 15 9s2-1.84 2-3.5S15 2 15 2z"/></svg>',
    'egg': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c6.23-.05 7.87-5.57 7.5-10-.36-4.34-3.95-9.96-7.5-10-3.55.04-7.14 5.66-7.5 10-.37 4.43 1.27 9.95 7.5 10z"/></svg>',
    'milk': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2h8l1.5 1.5V9h.5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h.5V3.5L8 2Z"/><path d="M16 8h-8"/></svg>',
    'beef': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.2 6c-.3-1.2-1.5-2-2.8-2H6.6C5.3 4 4.1 4.8 3.8 6L2 18h20l-1.8-12Z"/><path d="M6 12h12"/></svg>',
    'fish': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z"/><path d="M18 12v.5"/><path d="M16 17.93a9.77 9.77 0 0 1 0-11.86"/><path d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1.42-.23-2.73.87-2.73 2.22v8.56c0 1.35 1.31 2.45 2.73 2.22C5.58 18.03 7 16 7 13.33Z"/><path d="M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4"/><path d="m16.01 17.93-.23 1.4A2 2 0 0 1 13.8 21H8c1.17-1.24 2.2-2.88 2.46-4.26"/></svg>',
    'wheat': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20"/><path d="M2 12c4.4 0 8-1.8 8-4s-3.6-4-8-4"/><path d="M2 12c4.4 0 8 1.8 8 4s-3.6 4-8 4"/><path d="M22 12c-4.4 0-8-1.8-8-4s3.6-4 8-4"/><path d="M22 12c-4.4 0-8 1.8-8 4s3.6 4-8 4"/></svg>',
    'coffee': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v20M14 2v20M4 7h16M6 10v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8"/><path d="M5 7V5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v2"/></svg>',
    'droplets': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2.04 4.6 4.14 5.93A8.86 8.86 0 0 1 20 12.8c0 3.44-2.8 6.2-6.2 6.2-1.22 0-2.35-.36-3.3-1"/></svg>',
    'circle': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>',
    'leaf': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>',
    'trees': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 10v.2A3 3 0 0 1 8.9 16v0H5v0a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/></svg>',
    'flame': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
    'citrus': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.54 15H17a2 2 0 0 0-2 2v4.54"/><path d="M7 3.34V5a3 3 0 0 0 3 3v0a2 2 0 0 1 2 2v0c0 1.1.9 2 2 2v0a2 2 0 0 0 2-2v0c0-1.1.9-2 2-2h3.17"/><path d="M11 21.95V18a2 2 0 0 0-2-2v0a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05"/><circle cx="12" cy="12" r="10"/></svg>',
    'beer': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 11h1a3 3 0 0 1 0 6h-1"/><path d="M9 12v6"/><path d="M13 12v6"/><path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2.5 11 2.5s2 .5 3 .5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z"/><path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/></svg>',
    'wine': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"/><path d="M7 10h10"/><path d="M12 15v7"/><path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z"/></svg>',
    'cup-soda': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 8 1.75 12.28a2 2 0 0 0 2 1.72h4.54a2 2 0 0 0 2-1.72L18 8"/><path d="M5 8h14"/><path d="M7 15a6.47 6.47 0 0 1 5 0 6.47 6.47 0 0 0 5 0"/><path d="m12 8 1-6h2"/></svg>',
    'candy': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.5 7.5-2 2a4.95 4.95 0 1 0 7 7l2-2a4.95 4.95 0 1 0-7-7Z"/><path d="M14 6.5v10"/><path d="M10 7.5v10"/><path d="m16 7 1-5 1.37.68A3 3 0 0 0 19.7 3H21v1.3c0 .46.1.92.32 1.33L22 7l-5 1"/><path d="m8 17-1 5-1.37-.68A3 3 0 0 0 4.3 21H3v-1.3a3 3 0 0 0-.32-1.33L2 17l5-1"/></svg>',
    'cookie': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01"/><path d="M16 15.5v.01"/><path d="M12 12v.01"/><path d="M11 17v.01"/><path d="M7 14v.01"/></svg>',
    'cake-slice': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="2"/><path d="M7.2 7.9 3 11v9c0 .6.4 1 1 1h16c.6 0 1-.4 1-1v-9c0-2-3-6-7-8l-3.6 2.6"/><path d="M16 13H3"/><path d="M16 17H3"/></svg>',
    'ice-cream': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 11 4.08 10.35a1 1 0 0 0 1.84 0L17 11"/><path d="M17 7A5 5 0 0 0 7 7"/><path d="M17 7a2 2 0 0 1 0 4H7a2 2 0 0 1 0-4"/></svg>',
    'popcorn': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a2 2 0 0 0 0-4 2 2 0 0 0-4 0 2 2 0 0 0-4 0 2 2 0 0 0-4 0 2 2 0 0 0 0 4"/><path d="M10 22 9 8"/><path d="m14 22 1-14"/><path d="m18 8-2 14"/><path d="m6 8 2 14"/><path d="M2 22h20"/></svg>',
    'nut': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4V2"/><path d="M5 10v4a7.004 7.004 0 0 0 5.277 6.787c.412.104.802.292 1.102.592L12 22l.621-.621c.3-.3.69-.488 1.102-.592A7.003 7.003 0 0 0 19 14v-4"/><path d="M12 4C8 4 4.5 6 4 8s2.5 4 4 4 4-1.5 4-4"/><path d="M12 4c4 0 7.5 2 8 4s-2.5 4-4 4-4-1.5-4-4"/></svg>',
    'waves': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>',
    'brush': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/></svg>',
    'scroll-text': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v11a2 2 0 0 0 2 2z"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M15 8h-5"/><path d="M15 12h-5"/></svg>',
    'shirt': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg>',
    'spray-can': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h.01"/><path d="M7 5h.01"/><path d="M11 7h.01"/><path d="M3 7h.01"/><path d="M7 9h.01"/><path d="M3 11h.01"/><path d="M15 5l-8 8a4.95 4.95 0 0 0 7 7l8-8"/><path d="m15 5 4 4"/></svg>',
    'pill': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>',
    'salt': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 13v8"/><path d="M12 3v6"/><path d="m9 9 3 3 3-3"/><path d="M9 21h6"/><path d="M7 19h10"/><path d="M6 16h12"/></svg>'
  };
  
  return iconSvgMap[iconName] || null;
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
