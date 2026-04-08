import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getFavorites, removeFavorite } from '../utils/storage';
import { Colors, Spacing, Typography, Radius } from '../constants/theme';

const BRAND = '#7ba0b3';

function navigate(subreddit: string) {
  const sub = subreddit.trim().replace(/^r\//i, '');
  if (!sub) return;
  router.dismiss();
  // Give the UI thread 100ms to settle the menu state before replacing the native screen
  setTimeout(() => {
    router.push({ pathname: '/feed', params: { subreddit: sub } });
  }, 100);
}

export default function MenuScreen() {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getFavorites().then((favs) => { if (active) setFavorites(favs); });
      return () => { active = false; };
    }, [])
  );

  async function handleDelete(subreddit: string) {
    Alert.alert(
      'Remove Favourite',
      `Remove r/${subreddit} from your favourites?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeFavorite(subreddit);
            setFavorites((prev) => prev.filter((s) => s !== subreddit));
          },
        },
      ]
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Drag handle */}
      <View style={styles.handle} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Subreddits</Text>
        <Pressable
          style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
          onPress={() => router.dismiss()}
          hitSlop={8}
          accessibilityLabel="Close menu"
          accessibilityRole="button"
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
      </View>

      {/* Search row */}
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

      {/* Favourites */}
      <Text style={styles.sectionLabel}>
        {favorites.length === 0 ? 'NO FAVOURITES YET' : 'FAVOURITES'}
      </Text>

      {favorites.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStar}>{'\u2606'}</Text>
          <Text style={styles.emptyTitle}>No saved subreddits</Text>
          <Text style={styles.emptyHint}>
            Browse any subreddit and tap the {'\u2605'} star in the header to save it here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Pressable
                style={({ pressed }) => [styles.rowMain, pressed && styles.rowMainPressed]}
                onPress={() => navigate(item)}
              >
                <Text style={styles.rowName}>r/{item}</Text>
                <Text style={styles.chevron}>{'\u203a'}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}
                onPress={() => handleDelete(item)}
                hitSlop={8}
              >
                <Text style={styles.deleteIcon}>{'\u{1F5D1}'}</Text>
              </Pressable>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.lg,
    fontWeight: '700',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPressed: { opacity: 0.6 },
  closeBtnText: {
    color: Colors.textMuted,
    fontSize: Typography.md,
    lineHeight: 18,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
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
    backgroundColor: BRAND,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  goBtnPressed: { opacity: 0.8 },
  goBtnText: { color: '#fff', fontWeight: '700', fontSize: Typography.md },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
    fontWeight: '700',
    letterSpacing: 1,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingBottom: 60,
  },
  emptyStar: {
    fontSize: 52,
    color: Colors.textDisabled,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: Typography.lg,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  emptyHint: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    textAlign: 'center',
    lineHeight: 20,
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
    backgroundColor: Colors.surface,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  rowMainPressed: { backgroundColor: Colors.surfaceElevated },
  rowName: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.md,
    fontWeight: '600',
  },
  chevron: {
    color: Colors.textDisabled,
    fontSize: Typography.xl,
    fontWeight: '300',
    marginRight: Spacing.sm,
  },
  deleteBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  deleteBtnPressed: { opacity: 0.4 },
  deleteIcon: { fontSize: 18 },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: Spacing.lg,
  },
});