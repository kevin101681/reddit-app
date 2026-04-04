import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Colors, Spacing, Typography, Radius } from '../../constants/theme';

const FAVORITES = [
  { name: 'reactnative',   icon: '??' },
  { name: 'programming',   icon: '??' },
  { name: 'technology',    icon: '??' },
  { name: 'worldnews',     icon: '??' },
  { name: 'science',       icon: '??' },
  { name: 'gaming',        icon: '??' },
  { name: 'movies',        icon: '??' },
  { name: 'books',         icon: '??' },
];

function navigate(subreddit: string) {
  const sub = subreddit.trim().replace(/^r\//i, '');
  if (!sub) return;
  router.push({ pathname: '/feed', params: { subreddit: sub } });
}

export default function SubredditsScreen() {
  const [input, setInput] = useState('');

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Search / custom input */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="r/subreddit name…"
          placeholderTextColor={Colors.textDisabled}
          value={input}
          onChangeText={setInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={() => { navigate(input); setInput(''); }}
        />
        <Pressable
          style={({ pressed }) => [styles.goBtn, pressed && styles.goBtnPressed]}
          onPress={() => { navigate(input); setInput(''); }}
        >
          <Text style={styles.goBtnText}>Go</Text>
        </Pressable>
      </View>

      {/* Favorites */}
      <Text style={styles.sectionLabel}>FAVORITES</Text>
      <FlatList
        data={FAVORITES}
        keyExtractor={(item) => item.name}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => navigate(item.name)}
          >
            <Text style={styles.rowIcon}>{item.icon}</Text>
            <View style={styles.rowText}>
              <Text style={styles.rowName}>r/{item.name}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.md,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontSize: Typography.md,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  goBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  goBtnPressed: {
    opacity: 0.8,
  },
  goBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: Typography.md,
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
    fontWeight: '700',
    letterSpacing: 1,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  list: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  rowPressed: {
    backgroundColor: Colors.surfaceElevated,
  },
  rowIcon: {
    fontSize: 22,
    marginRight: Spacing.md,
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    color: Colors.text,
    fontSize: Typography.md,
    fontWeight: '600',
  },
  chevron: {
    color: Colors.textDisabled,
    fontSize: Typography.xl,
    fontWeight: '300',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: Spacing.lg + 22 + Spacing.md,
  },
});
