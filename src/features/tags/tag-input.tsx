import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { addTag, MAX_TAGS, removeTag } from './tags';

/**
 * Tags as removable chips plus a text box. A tag is added when the person types a space or comma,
 * presses done, or leaves the box. Frequently used tags are offered as one-tap suggestions.
 */
export function TagInput({
  tags,
  onChange,
  suggestions = [],
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
}) {
  const theme = useTheme();
  const [text, setText] = useState('');

  const commit = (raw: string) => {
    if (raw.trim()) onChange(addTag(tags, raw));
    setText('');
  };

  const onChangeText = (value: string) => {
    // A separator at the end finishes the tag being typed.
    if (/[\s,]$/.test(value) && value.trim()) return commit(value);
    setText(value.replace(/^[\s,]+/, ''));
  };

  const unused = suggestions.filter((s) => !tags.includes(s)).slice(0, 8);
  const full = tags.length >= MAX_TAGS;

  return (
    <View style={styles.wrap}>
      <View style={[styles.box, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        {tags.map((tag) => (
          <Pressable
            key={tag}
            accessibilityRole="button"
            accessibilityLabel={`Remove tag ${tag}`}
            onPress={() => onChange(removeTag(tags, tag))}
            style={[styles.tag, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="small">#{tag}</ThemedText>
            <Ionicons name="close" size={14} color={theme.textSecondary} />
          </Pressable>
        ))}
        {full ? null : (
          <TextInput
            value={text}
            onChangeText={onChangeText}
            onSubmitEditing={() => commit(text)}
            onBlur={() => commit(text)}
            placeholder={tags.length ? 'Add another' : 'e.g. trip-goa'}
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            blurOnSubmit={false}
            style={[styles.input, { color: theme.text }]}
          />
        )}
      </View>

      {unused.length > 0 && !full ? (
        <View style={styles.suggestions}>
          {unused.map((s) => (
            <Pressable
              key={s}
              accessibilityRole="button"
              onPress={() => onChange(addTag(tags, s))}
              style={[styles.suggestion, { borderColor: theme.border }]}>
              <ThemedText type="small" themeColor="textSecondary">
                #{s}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  box: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderRadius: 14, padding: Spacing.two, minHeight: 50 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  input: { flexGrow: 1, minWidth: 110, paddingVertical: 6, paddingHorizontal: 6, fontSize: 15, fontFamily: Type.body },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  suggestion: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
});
