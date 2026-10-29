import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export const CATEGORY_ICONS: IconName[] = [
  'fast-food-outline',
  'cafe-outline',
  'cart-outline',
  'bus-outline',
  'car-outline',
  'airplane-outline',
  'receipt-outline',
  'home-outline',
  'bag-handle-outline',
  'shirt-outline',
  'film-outline',
  'game-controller-outline',
  'musical-notes-outline',
  'medkit-outline',
  'fitness-outline',
  'school-outline',
  'book-outline',
  'gift-outline',
  'phone-portrait-outline',
  'wifi-outline',
  'paw-outline',
  'briefcase-outline',
  'cash-outline',
  'ellipsis-horizontal-circle-outline',
];

export const CATEGORY_COLORS = [
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#84CC16',
  '#22C55E',
  '#14B8A6',
  '#06B6D4',
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#8E8E93',
];
