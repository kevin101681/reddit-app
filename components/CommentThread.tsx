import React, { memo, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { RedditComment } from '../utils/types';
import { formatRelativeTime, formatScore } from '../utils/api';
import { buildMarkdownStyles, suppressImageRule } from '../utils/markdownStyles';
import { Colors, Spacing, Typography } from '../constants/theme';

const DEPTH_COLORS = [
  Colors.primary,   // depth 0  — orange
  '#7193ff',        // depth 1  — periwinkle
  '#46d160',        // depth 2  — green
  '#ffd635',        // depth 3  — gold
  '#ff585b',        // depth 4  — coral
  '#00b4d8',        // depth 5+ — teal
];

function depthColor(depth: number): string {
  return DEPTH_COLORS[depth % DEPTH_COLORS.length];
}

/**
 * Secure link handler: routes all tapped URLs to the device browser.
 * Returns true to prevent react-native-markdown-display's default handling.
 */
function openLink(url: string): boolean {
  Linking.openURL(url).catch(() => {});
  return true;
}

/**
 * Build comment-body markdown styles once per depth level and memoize.
 * Font size shrinks slightly at deeper levels to fit within narrower columns,
 * and flexShrink: 1 on paragraph prevents text overflow in nested Views.
 */
function useCommentMdStyles(depth: number) {
  return useMemo(() => {
    // Slightly smaller at deep nesting — never below xs (11px)
    const fontSize = Math.max(Typography.xs, Typography.sm - Math.floor(depth / 3));
    const lineHeight = fontSize + 7;
    return buildMarkdownStyles({ fontSize, lineHeight });
  }, [depth]);
}

interface CommentThreadProps {
  comment: RedditComment;
  depth?: number;
}

export const CommentThread = memo(function CommentThread({
  comment,
  depth = 0,
}: CommentThreadProps) {
  const [collapsed, setCollapsed] = useState(false);
  const mdStyles = useCommentMdStyles(depth);

  if (
    !comment.body ||
    comment.body === '[deleted]' ||
    comment.body === '[removed]'
  ) {
    return null;
  }

  const color      = depthColor(depth);
  const replyCount = comment.replies?.length ?? 0;

  // Cap left-margin at 5 levels to avoid layout overflow on narrow screens
  const indent = Math.min(depth * Spacing.md, Spacing.md * 5);

  return (
    <View
      style={[
        styles.container,
        depth > 0 && {
          marginLeft: indent,
          borderLeftWidth: 2,
          borderLeftColor: color,
          paddingLeft: Spacing.sm,
        },
      ]}
    >
      {/* -- Tappable header -- */}
      <Pressable
        onPress={() => setCollapsed((c) => !c)}
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
        hitSlop={4}
      >
        <View style={styles.metaRow}>
          <Text style={[styles.author, { color }]}>u/{comment.author}</Text>
          <Text style={styles.dot}> · </Text>
          <Text style={styles.score}>{formatScore(comment.score)} pts</Text>
          <Text style={styles.dot}> · </Text>
          <Text style={styles.time}>{formatRelativeTime(comment.created_utc)}</Text>
          {collapsed && replyCount > 0 ? (
            <Text style={styles.collapsedHint}>
              {' '}[+{replyCount} {replyCount === 1 ? 'reply' : 'replies'}]
            </Text>
          ) : null}
          <Text style={[styles.chevron, { color }]}>
            {collapsed ? ' \u25b6' : ' \u25bc'}
          </Text>
        </View>
      </Pressable>

      {/* -- Body + replies -- */}
      {!collapsed ? (
        <>
          {/*
            The wrapping View needs flex: 1 / flexShrink: 1 so the Markdown
            component doesn't blow past the column width at deep nesting levels.
            The paragraph style inside mdStyles also carries flexShrink: 1.
          */}
          <View style={styles.bodyWrap}>
            <Markdown
              style={mdStyles}
              onLinkPress={openLink}
              rules={suppressImageRule}
            >
              {comment.body}
            </Markdown>
          </View>

          {replyCount > 0 ? (
            <View style={styles.replies}>
              {comment.replies!.map((reply) => (
                <CommentThread
                  key={reply.id}
                  comment={reply}
                  depth={depth + 1}
                />
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  header: {
    paddingVertical: 2,
    borderRadius: 4,
  },
  headerPressed: { opacity: 0.6 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  author: {
    fontSize: Typography.xs,
    fontWeight: '700',
  },
  dot: {
    color: Colors.textDisabled,
    fontSize: Typography.xs,
  },
  score: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
    fontWeight: '600',
  },
  time: {
    color: Colors.textDisabled,
    fontSize: Typography.xs,
  },
  collapsedHint: {
    color: Colors.textDisabled,
    fontSize: Typography.xs,
    fontStyle: 'italic',
  },
  chevron: {
    fontSize: Typography.xs,
    fontWeight: '700',
  },
  // flex: 1 + flexShrink: 1 together prevent horizontal overflow in
  // deeply indented comment columns where available width is narrow.
  bodyWrap: {
    flex: 1,
    flexShrink: 1,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  replies: {
    marginTop: Spacing.xs,
  },
});
