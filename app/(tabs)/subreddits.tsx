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
import { getFavorites, removeFavorite } from '../../utils/storage';
import { Colors, Spacing, Typography, Radius } from '../../constants/theme';

function navigate(subreddit: string) {
  const sub = subreddit.trim().replace(/^r\//i, '');
  if (!sub) return;
  router.push({ pathname: '/feed', params: { subreddit: sub } });
}

export default function SubredditsScreen() {
  const [input, setInput] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);

  // Reload from storage every time this tab comes into focus so changes
  // made on the feed screen (star toggle) are reflected immediately.
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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Custom subreddit search */}
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

      {/* Persisted favourites */}
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
              {/* Navigate on tap */}
              <Pressable
                style={({ pressed }) => [styles.rowMain, pressed && styles.rowMainPressed]}
                onPress={() => navigate(item)}
              >
                <Text style={styles.rowName}>r/{item}</Text>
                <Text style={styles.chevron}>{'\u203a'}</Text>
              </Pressable>

              {/* Delete button */}
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
  goBtnPressed: { opacity: 0.8 },
  goBtnText: { color: '#fff', fontWeight: '700', fontSize: Typography.md },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
    fontWeight: '700',
    letterSpacing: 1,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
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
  rowMainPressed: {
    backgroundColor: Colors.surfaceElevated,
  },
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
  deleteIcon: {
    fontSize: 18,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: Spacing.lg,
  },
});
