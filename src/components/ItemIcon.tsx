import React from 'react';
import * as Icons from 'lucide-react';

interface ItemIconProps {
  itemName: string;
  iconName?: string | null;
  size?: number;
  className?: string;
}

export function ItemIcon({ itemName, iconName, size = 24, className = "text-gray-600" }: ItemIconProps) {
  if (!iconName) return null;
  
  // Map icon names to actual Lucide React components
  const iconMap: Record<string, React.ComponentType<any>> = {
    'apple': Icons.Apple,
    'banana': Icons.Banana,
    'orange': Icons.CircleDot, // Orange icon doesn't exist, use CircleDot
    'grape': Icons.Grape,
    'cherry': Icons.Cherry,
    'carrot': Icons.Carrot,
    'egg': Icons.Egg,
    'milk': Icons.Milk,
    'beef': Icons.Beef,
    'fish': Icons.Fish,
    'wheat': Icons.Wheat,
    'coffee': Icons.Coffee,
    'droplets': Icons.Droplets,
    'circle': Icons.Circle,
    'leaf': Icons.Leaf,
    'trees': Icons.Trees,
    'flame': Icons.Flame,
    'citrus': Icons.CircleDot, // Citrus icon doesn't exist, use CircleDot
    'beer': Icons.Beer,
    'wine': Icons.Wine,
    'cup-soda': Icons.CupSoda,
    'candy': Icons.Candy,
    'cookie': Icons.Cookie,
    'cake-slice': Icons.CakeSlice,
    'ice-cream': Icons.IceCream2,
    'popcorn': Icons.Popcorn,
    'nut': Icons.Nut,
    'waves': Icons.Waves,
    'brush': Icons.Brush,
    'scroll-text': Icons.ScrollText,
    'shirt': Icons.Shirt,
    'spray-can': Icons.SprayCan,
    'pill': Icons.Pill,
    'salt': Icons.CircleDot, // Salt icon doesn't exist, use CircleDot
    'shopping-basket': Icons.ShoppingBasket,
    'croissant': Icons.Croissant,
    'donut': Icons.Donut,
    'ice-cream-cone': Icons.IceCreamCone,
    'cake': Icons.Cake,
    'pizza': Icons.Pizza,
    'sandwich': Icons.Sandwich,
    'soup': Icons.Soup,
    'salad': Icons.Salad,
    'ham': Icons.Ham
  };
  
  const IconComponent = iconMap[iconName];
  
  if (!IconComponent) {
    // Fallback to generic shopping cart icon
    return <Icons.ShoppingCart size={size} className={className} />;
  }
  
  return <IconComponent size={size} className={className} />;
}