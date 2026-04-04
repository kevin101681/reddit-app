import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { getPosts } from '../utils/api';
import { RedditPost } from '../utils/types';
import { PostCard } from '../components/PostCard';
import { FeedSkeleton } from '../components/SkeletonLoader';
import { getFavorites, addFavorite, removeFavorite } from '../utils/storage';
import { Colors, Spacing, Typography } from '../constants/theme';

const SORT = 'hot';

export default function FeedScreen() {
  const { subreddit } = useLocalSearchParams<{ subreddit: string }>();
  const sub = (Array.isArray(subreddit) ? subreddit[0] : subreddit) ?? 'popular';

  // Feed state
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [after, setAfter] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Favourite state
  const [isFavorited, setIsFavorited] = useState(false);

  // Check persisted favourite status whenever the subreddit changes
  useEffect(() => {
    let cancelled = false;
    getFavorites().then((favs) => {
      if (!cancelled) setIsFavorited(favs.includes(sub.toLowerCase()));
    });
    return () => { cancelled = true; };
  }, [sub]);

  async function toggleFavorite() {
    if (isFavorited) {
      await removeFavorite(sub);
      setIsFavorited(false);
    } else {
      await addFavorite(sub);
      setIsFavorited(true);
    }
  }

  // Feed fetching
  const fetchPosts = useCallback(
    async (reset: boolean, cursor?: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setError(null);
        const data = await getPosts(sub, SORT, cursor, controller.signal);
        setPosts((prev) => (reset ? data.posts : [...prev, ...data.posts]));
        const nextCursor =
          data.after ?? (data.posts.length ? data.posts[data.posts.length - 1].name : undefined);
        setAfter(nextCursor ?? undefined);
        setHasMore(!!nextCursor && data.posts.length > 0);
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          setError(err?.message ?? 'Failed to load posts');
        }
      }
    },
    [sub]
  );

  useEffect(() => {
    setLoading(true);
    setPosts([]);
    setAfter(undefined);
    setHasMore(true);
    fetchPosts(true).finally(() => setLoading(false));
    return () => abortRef.current?.abort();
  }, [sub]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setAfter(undefined);
    setHasMore(true);
    await fetchPosts(true);
    setRefreshing(false);
  }, [fetchPosts]);

  const onEndReached = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await fetchPosts(false, after);
    setLoadingMore(false);
  }, [loadingMore, hasMore, after, fetchPosts]);

  return (
    <>
      <Stack.Screen
        options={{
          title: `r/${sub}`,
          headerRight: () => (
            <Pressable
              onPress={toggleFavorite}
              style={({ pressed }) => [styles.starBtn, pressed && styles.starBtnPressed]}
              hitSlop={8}
            >
              <Text style={[styles.starIcon, isFavorited && styles.starIconFilled]}>
                {isFavorited ? '\u2605' : '\u2606'}
              </Text>
            </Pressable>
          ),
        }}
      />

      {loading ? (
        <View style={styles.container}>
          <FeedSkeleton />
        </View>
      ) : error && posts.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.errorIcon}>??</Text>
          <Text style={styles.errorTitle}>Could not load r/{sub}</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <Text style={styles.retryHint}>Pull down to retry</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PostCard post={item} />}
          style={styles.container}
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
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>?? {error}</Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={Colors.primary} style={styles.loadingMore} />
            ) : null
          }
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  listContent: { paddingTop: Spacing.sm, paddingBottom: Spacing.xl },
  center: {
    flex: 1, backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center', padding: Spacing.xl,
  },
  errorIcon: { fontSize: 40, marginBottom: Spacing.md },
  errorTitle: {
    color: Colors.text, fontSize: Typography.lg,
    fontWeight: '700', marginBottom: Spacing.sm,
  },
  errorMessage: {
    color: Colors.textMuted, fontSize: Typography.sm,
    textAlign: 'center', marginBottom: Spacing.md,
  },
  retryHint: { color: Colors.textDisabled, fontSize: Typography.sm },
  errorBanner: {
    backgroundColor: Colors.surface, marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm, padding: Spacing.md, borderRadius: 8,
  },
  errorBannerText: { color: Colors.textMuted, fontSize: Typography.sm },
  loadingMore: { paddingVertical: Spacing.xl },
  starBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  starBtnPressed: { opacity: 0.5 },
  starIcon: {
    fontSize: 24,
    color: Colors.textMuted,
  },
  starIconFilled: {
    color: Colors.gold,
  },
});
