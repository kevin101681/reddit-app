import React, { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
  Pressable,
  Linking,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { getPostDetail, formatRelativeTime, formatScore } from '../../utils/api';
import { RedditPost, RedditComment } from '../../utils/types';
import { SkeletonBox } from '../../components/SkeletonLoader';
import { Colors, Spacing, Typography, Radius } from '../../constants/theme';

function CommentItem({ comment, depth = 0 }: { comment: RedditComment; depth?: number }) {
  if (!comment.body || comment.body === '[deleted]') return null;
  return (
    <View
      style={[
        styles.comment,
        depth > 0 && {
          marginLeft: depth * Spacing.lg,
          borderLeftWidth: 2,
          borderLeftColor: depth % 2 === 0 ? Colors.primary : Colors.border,
          paddingLeft: Spacing.sm,
        },
      ]}
    >
      <View style={styles.commentMeta}>
        <Text style={styles.commentAuthor}>u/{comment.author}</Text>
        <Text style={styles.commentDot}> · </Text>
        <Text style={styles.commentScore}>{formatScore(comment.score)} pts</Text>
        <Text style={styles.commentDot}> · </Text>
        <Text style={styles.commentTime}>{formatRelativeTime(comment.created_utc)}</Text>
      </View>
      <Text style={styles.commentBody}>{comment.body}</Text>
      {comment.replies?.map((reply) => (
        <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
      ))}
    </View>
  );
}

function PostDetailSkeleton() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SkeletonBox width="80%" height={20} />
      <SkeletonBox width="50%" height={14} style={{ marginTop: Spacing.sm }} />
      <SkeletonBox width="100%" height={220} borderRadius={Radius.md} style={{ marginTop: Spacing.md }} />
      <SkeletonBox width="100%" height={1} style={{ marginVertical: Spacing.lg }} />
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={i} style={{ marginBottom: Spacing.lg }}>
          <SkeletonBox width={120} height={12} />
          <SkeletonBox width="90%" height={14} style={{ marginTop: Spacing.xs }} />
          <SkeletonBox width="70%" height={14} style={{ marginTop: 4 }} />
        </View>
      ))}
    </ScrollView>
  );
}

export default function PostDetailScreen() {
  const { id, subreddit } = useLocalSearchParams<{
    id: string;
    subreddit: string;
    title: string;
  }>();

  const [post, setPost] = useState<RedditPost | null>(null);
  const [comments, setComments] = useState<RedditComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!id || !subreddit) return;
    abortRef.current = new AbortController();
    (async () => {
      try {
        const [postListing, commentListing] = await getPostDetail(
          subreddit,
          id,
          abortRef.current!.signal
        );
        setPost(postListing.data.children[0]?.data ?? null);
        setComments(commentListing.data.children.map((c) => c.data));
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          setError(err?.message ?? 'Failed to load post');
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => abortRef.current?.abort();
  }, [id, subreddit]);

  if (loading) return <PostDetailSkeleton />;

  if (error || !post) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>??</Text>
        <Text style={styles.errorTitle}>Could not load post</Text>
        <Text style={styles.errorMessage}>{error ?? 'Post not found'}</Text>
      </View>
    );
  }

  const imageUrl =
    post.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&') ?? null;

  return (
    <>
      <Stack.Screen options={{ title: post.subreddit_name_prefixed }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.postHeader}>
          <View style={styles.metaRow}>
            <Text style={styles.subreddit}>{post.subreddit_name_prefixed}</Text>
            <Text style={styles.dot}> · </Text>
            <Text style={styles.meta}>{formatRelativeTime(post.created_utc)}</Text>
          </View>
          <Text style={styles.postTitle}>{post.title}</Text>
          <Text style={styles.postAuthor}>u/{post.author}</Text>
        </View>

        {/* Image */}
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.postImage} resizeMode="cover" />
        ) : null}

        {/* Self text */}
        {post.selftext ? (
          <View style={styles.selftextBox}>
            <Text style={styles.selftext} numberOfLines={20}>{post.selftext}</Text>
          </View>
        ) : null}

        {/* Read-only stats — no vote or reply controls */}
        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Text style={styles.statChipText}>{formatScore(post.score)} pts</Text>
          </View>
          <View style={[styles.statChip, styles.statChipSecondary]}>
            <Text style={styles.statChipSecondaryText}>
              {formatScore(post.num_comments)} comments
            </Text>
          </View>
          <View style={[styles.statChip, styles.statChipSecondary]}>
            <Text style={styles.statChipSecondaryText}>
              {Math.round(post.upvote_ratio * 100)}% upvoted
            </Text>
          </View>
          <Pressable
            onPress={() => Linking.openURL('https://reddit.com' + post.permalink)}
            style={({ pressed }) => [styles.statChip, styles.linkChip, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.linkText}>Open in Reddit ?</Text>
          </Pressable>
        </View>

        <View style={styles.divider} />

        {/* Comments — read-only, no reply inputs */}
        <Text style={styles.commentsHeader}>{comments.length} Comments</Text>
        {comments.length === 0 ? (
          <View style={styles.noComments}>
            <Text style={styles.noCommentsText}>No comments yet.</Text>
          </View>
        ) : (
          comments.map((c) => <CommentItem key={c.id} comment={c} depth={0} />)
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  center: {
    flex: 1, backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center', padding: Spacing.xl,
  },
  errorIcon: { fontSize: 36, marginBottom: Spacing.md },
  errorTitle: { color: Colors.text, fontSize: Typography.lg, fontWeight: '700', marginBottom: Spacing.sm },
  errorMessage: { color: Colors.textMuted, fontSize: Typography.sm, textAlign: 'center' },
  postHeader: { marginBottom: Spacing.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
  subreddit: { color: Colors.primary, fontSize: Typography.sm, fontWeight: '700' },
  dot: { color: Colors.textDisabled, fontSize: Typography.sm },
  meta: { color: Colors.textMuted, fontSize: Typography.sm },
  postTitle: {
    color: Colors.text, fontSize: Typography.xl, fontWeight: '700',
    lineHeight: 28, marginBottom: Spacing.xs,
  },
  postAuthor: { color: Colors.textMuted, fontSize: Typography.xs },
  postImage: {
    width: '100%', height: 240, borderRadius: Radius.md,
    marginBottom: Spacing.md, backgroundColor: Colors.border,
  },
  selftextBox: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  selftext: { color: Colors.text, fontSize: Typography.sm, lineHeight: 20 },
  statsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md,
  },
  statChip: {
    backgroundColor: Colors.primaryMuted, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  statChipText: { color: Colors.primary, fontSize: Typography.sm, fontWeight: '700' },
  statChipSecondary: { backgroundColor: Colors.surfaceElevated },
  statChipSecondaryText: { color: Colors.textMuted, fontSize: Typography.sm, fontWeight: '600' },
  linkChip: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  linkText: { color: Colors.primary, fontSize: Typography.sm, fontWeight: '600' },
  divider: {
    height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginVertical: Spacing.lg,
  },
  commentsHeader: { color: Colors.text, fontSize: Typography.md, fontWeight: '700', marginBottom: Spacing.md },
  comment: {
    marginBottom: Spacing.md, paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  commentMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  commentAuthor: { color: Colors.primary, fontSize: Typography.xs, fontWeight: '700' },
  commentDot: { color: Colors.textDisabled, fontSize: Typography.xs },
  commentScore: { color: Colors.textMuted, fontSize: Typography.xs },
  commentTime: { color: Colors.textMuted, fontSize: Typography.xs },
  commentBody: { color: Colors.text, fontSize: Typography.sm, lineHeight: 20 },
  noComments: { alignItems: 'center', padding: Spacing.xl },
  noCommentsText: { color: Colors.textMuted, fontSize: Typography.sm },
});
