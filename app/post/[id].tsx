import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  Image,
  Pressable,
  Linking,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import Markdown from 'react-native-markdown-display';
import { getComments, formatRelativeTime, formatScore } from '../../utils/api';
import { RedditComment } from '../../utils/types';
import { CommentThread } from '../../components/CommentThread';
import { SkeletonBox } from '../../components/SkeletonLoader';
import { buildMarkdownStyles, suppressImageRule } from '../../utils/markdownStyles';
import { Colors, Spacing, Typography, Radius } from '../../constants/theme';

// --- Shared link handler — opens URLs in the device browser ------------------

function openLink(url: string): boolean {
  Linking.openURL(url).catch(() => {});
  return true; // prevent default in-app navigation
}

// --- Markdown style memos -----------------------------------------------------

const postMdStyles = buildMarkdownStyles({ fontSize: Typography.sm, lineHeight: 21 });

// --- Comment skeleton ---------------------------------------------------------

function CommentSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={[styles.skeletonBlock, { marginLeft: (i % 3) * Spacing.lg }]}>
          <SkeletonBox width={100 + (i % 2) * 40} height={11} />
          <SkeletonBox width="90%" height={14} style={{ marginTop: Spacing.xs }} />
          <SkeletonBox width="70%" height={14} style={{ marginTop: 4 }} />
        </View>
      ))}
    </View>
  );
}

// --- Post header -------------------------------------------------------------

interface PostHeaderProps {
  subreddit_name_prefixed: string;
  title: string;
  author: string;
  score: number;
  num_comments: number;
  upvote_ratio: number;
  created_utc: number;
  permalink: string;
  selftext: string;
  image_url: string;
  flair_text: string;
  over_18: boolean;
  commentCount: number;
  commentsLoading: boolean;
}

function PostHeader({
  subreddit_name_prefixed,
  title,
  author,
  score,
  num_comments,
  upvote_ratio,
  created_utc,
  permalink,
  selftext,
  image_url,
  flair_text,
  over_18,
  commentCount,
  commentsLoading,
}: PostHeaderProps) {
  return (
    <View style={styles.headerWrap}>
      {/* Meta row */}
      <View style={styles.metaRow}>
        <Text style={styles.subreddit}>{subreddit_name_prefixed}</Text>
        <Text style={styles.dot}> · </Text>
        <Text style={styles.meta}>{formatRelativeTime(created_utc)}</Text>
      </View>

      {/* Flair */}
      {flair_text ? (
        <View style={styles.flairBadge}>
          <Text style={styles.flairText} numberOfLines={1}>{flair_text}</Text>
        </View>
      ) : null}

      {/* Title */}
      <Text style={styles.postTitle}>
        {over_18 ? '?? ' : ''}{title}
      </Text>
      <Text style={styles.postAuthor}>u/{author}</Text>

      {/* Hero image */}
      {image_url ? (
        <Image source={{ uri: image_url }} style={styles.postImage} resizeMode="cover" />
      ) : null}

      {/* Self-text rendered as Markdown */}
      {selftext ? (
        <View style={styles.selftextBox}>
          <Markdown
            style={postMdStyles}
            onLinkPress={openLink}
            rules={suppressImageRule}
          >
            {selftext}
          </Markdown>
        </View>
      ) : null}

      {/* Read-only stats chips */}
      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Text style={styles.statChipText}>{formatScore(score)} pts</Text>
        </View>
        <View style={[styles.statChip, styles.statChipSecondary]}>
          <Text style={styles.statChipSecondaryText}>
            {formatScore(num_comments)} comments
          </Text>
        </View>
        <View style={[styles.statChip, styles.statChipSecondary]}>
          <Text style={styles.statChipSecondaryText}>
            {Math.round(upvote_ratio * 100)}% upvoted
          </Text>
        </View>
        <Pressable
          onPress={() => Linking.openURL('https://reddit.com' + permalink)}
          style={({ pressed }) => [
            styles.statChip,
            styles.linkChip,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text style={styles.linkText}>Open in Reddit ?</Text>
        </Pressable>
      </View>

      {/* Divider + comments heading */}
      <View style={styles.divider} />
      <Text style={styles.commentsHeader}>
        {commentsLoading
          ? 'Loading comments…'
          : `${commentCount} Comment${commentCount !== 1 ? 's' : ''}`}
      </Text>
    </View>
  );
}

// --- Main screen --------------------------------------------------------------

export default function PostDetailScreen() {
  const params = useLocalSearchParams<{
    id: string;
    subreddit: string;
    subreddit_name_prefixed: string;
    title: string;
    author: string;
    score: string;
    num_comments: string;
    upvote_ratio: string;
    permalink: string;
    selftext: string;
    created_utc: string;
    image_url: string;
    flair_text: string;
    over_18: string;
  }>();

  const {
    id,
    subreddit,
    subreddit_name_prefixed,
    title,
    author,
    permalink,
    selftext,
    image_url,
    flair_text,
  } = params;

  const score        = Number(params.score ?? 0);
  const num_comments = Number(params.num_comments ?? 0);
  const upvote_ratio = Number(params.upvote_ratio ?? 0);
  const created_utc  = Number(params.created_utc ?? 0);
  const over_18      = params.over_18 === '1';

  const [comments, setComments]           = useState<RedditComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!id || !subreddit) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const data = await getComments(subreddit, id, controller.signal);
        setComments(data.comments);
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          setCommentsError(err?.message ?? 'Failed to load comments');
        }
      } finally {
        setCommentsLoading(false);
      }
    })();

    return () => abortRef.current?.abort();
  }, [id, subreddit]);

  const topLevelComments = comments.filter(
    (c) => c.depth === 0 || c.depth === undefined
  );

  function renderComment({ item }: { item: RedditComment }) {
    return (
      <View style={styles.commentWrap}>
        <CommentThread comment={item} depth={0} />
        <View style={styles.commentDivider} />
      </View>
    );
  }

  function renderListFooter() {
    if (commentsLoading) return <CommentSkeleton />;
    if (commentsError) {
      return (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>?? {commentsError}</Text>
        </View>
      );
    }
    if (topLevelComments.length === 0) {
      return (
        <View style={styles.noComments}>
          <Text style={styles.noCommentsText}>No comments yet.</Text>
        </View>
      );
    }
    return <View style={{ height: Spacing.xxl }} />;
  }

  return (
    <>
      <Stack.Screen options={{ title: subreddit_name_prefixed ?? `r/${subreddit}` }} />

      <FlatList
        style={styles.list}
        data={topLevelComments}
        keyExtractor={(item) => item.id}
        renderItem={renderComment}
        ListHeaderComponent={
          <PostHeader
            subreddit_name_prefixed={subreddit_name_prefixed ?? `r/${subreddit}`}
            title={title ?? ''}
            author={author ?? ''}
            score={score}
            num_comments={num_comments}
            upvote_ratio={upvote_ratio}
            created_utc={created_utc}
            permalink={permalink ?? ''}
            selftext={selftext ?? ''}
            image_url={image_url ?? ''}
            flair_text={flair_text ?? ''}
            over_18={over_18}
            commentCount={topLevelComments.length}
            commentsLoading={commentsLoading}
          />
        }
        ListFooterComponent={renderListFooter}
        removeClippedSubviews
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={7}
      />
    </>
  );
}

// --- Styles -------------------------------------------------------------------

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: Colors.background },

  headerWrap: { padding: Spacing.lg, paddingBottom: 0 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
  subreddit: { color: Colors.primary, fontSize: Typography.sm, fontWeight: '700' },
  dot: { color: Colors.textDisabled, fontSize: Typography.sm },
  meta: { color: Colors.textMuted, fontSize: Typography.sm },
  flairBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryMuted,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    marginBottom: Spacing.xs,
  },
  flairText: { color: Colors.primary, fontSize: Typography.xs, fontWeight: '600' },
  postTitle: {
    color: Colors.text,
    fontSize: Typography.xl,
    fontWeight: '700',
    lineHeight: 28,
    marginBottom: Spacing.xs,
  },
  postAuthor: { color: Colors.textMuted, fontSize: Typography.xs, marginBottom: Spacing.md },
  postImage: {
    width: '100%',
    height: 240,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.border,
  },
  selftextBox: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  statChip: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  statChipText: { color: Colors.primary, fontSize: Typography.sm, fontWeight: '700' },
  statChipSecondary: { backgroundColor: Colors.surfaceElevated },
  statChipSecondaryText: { color: Colors.textMuted, fontSize: Typography.sm, fontWeight: '600' },
  linkChip: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  linkText: { color: Colors.primary, fontSize: Typography.sm, fontWeight: '600' },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  commentsHeader: {
    color: Colors.text,
    fontSize: Typography.md,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  commentWrap: { paddingHorizontal: Spacing.lg },
  commentDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  skeletonWrap: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  skeletonBlock: { marginBottom: Spacing.lg },
  errorBox: {
    margin: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  errorText: { color: Colors.textMuted, fontSize: Typography.sm },
  noComments: { alignItems: 'center', padding: Spacing.xxl },
  noCommentsText: { color: Colors.textMuted, fontSize: Typography.sm },
});
