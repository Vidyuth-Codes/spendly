import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import type { IconName } from './options';

export function CategoryIcon({
  icon,
  color,
  size = 40,
}: {
  icon: string;
  color: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${color}26`, // ~15% tint of the category color
      }}>
      <Ionicons name={icon as IconName} size={size * 0.52} color={color} />
    </View>
  );
}
