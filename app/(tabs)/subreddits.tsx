import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { getSubreddit, searchSubreddits } from '../../utils/api';
import { RedditPost } from '../../utils/types';
import { PostCard } from '../../components/PostCard';
import { FeedSkeleton } from '../../components/SkeletonLoader';
import { Colors, Spacing, Typography, Radius } from '../../constants/theme';

const DEFAULT_SUBS = ['programming', 'technology', 'science', 'worldnews', 'gaming'];

export default function SubredditsScreen() {
  const [selectedSub, setSelectedSub] = useState(DEFAULT_SUBS[0]);
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [after, setAfter] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchPosts = useCallback(
    async (sub: string, reset = false, cursor?: string) => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        setError(null);
        const data = await getSubreddit(sub, reset ? undefined : cursor, controller.signal);
        const newPosts = data.data.children.map((c) => c.data);
        setPosts((prev) => (reset ? newPosts : [...prev, ...newPosts]));
        setAfter(data.data.after);
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          setError(err?.message ?? 'Failed to load posts');
        }
      }
    },
    []
  );

  useEffect(() => {
    setLoading(true);
    setAfter(null);
    fetchPosts(selectedSub, true).finally(() => setLoading(false));
    return () => abortRef.current?.abort();
  }, [selectedSub]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setAfter(null);
    await fetchPosts(selectedSub, true);
    setRefreshing(false);
  }, [selectedSub]);

  const onEndReached = useCallback(async () => {
    if (loadingMore || !after) return;
    setLoadingMore(true);
    await fetchPosts(selectedSub, false, after);
    setLoadingMore(false);
  }, [loadingMore, after, selectedSub, fetchPosts]);

  return (
    <View style={styles.container}>
      {/* Subreddit chips */}
      <FlatList
        horizontal
        data={DEFAULT_SUBS}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setSelectedSub(item)}
            style={[styles.chip, selectedSub === item && styles.chipActive]}
          >
            <Text
              style={[
                styles.chipText,
                selectedSub === item && styles.chipTextActive,
              ]}
            >
              r/{item}
            </Text>
          </Pressable>
        )}
        style={styles.chipRow}
      />

      {/* Post feed */}
      {loading ? (
        <View style={styles.feedContainer}>
          <FeedSkeleton />
        </View>
      ) : error && posts.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Could not load r/{selectedSub}</Text>
          <Text style={styles.errorMessage}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PostCard post={item} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
              progressBackgroundColor={Colors.surface}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={Colors.primary} style={styles.loadingMore} />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  chipRow: {
    maxHeight: 52,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  chips: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#fff',
  },
  feedContainer: {
    flex: 1,
  },
  listContent: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  errorIcon: {
    fontSize: 36,
    marginBottom: Spacing.md,
  },
  errorTitle: {
    color: Colors.text,
    fontSize: Typography.lg,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  errorMessage: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    textAlign: 'center',
  },
  loadingMore: {
    paddingVertical: Spacing.xl,
  },
});
