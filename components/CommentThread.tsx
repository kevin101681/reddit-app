import React, { memo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { RedditComment } from '../utils/types';
import { formatRelativeTime, formatScore } from '../utils/api';
import { Colors, Spacing, Typography } from '../constants/theme';

/**
 * A rotating palette of left-border colours that cycle by depth,
 * giving each thread level its own visual identity.
 */
const DEPTH_COLORS = [
  Colors.primary,   // depth 0  — orange
  '#7193ff',        // depth 1  — periwinkle
  '#46d160',        // depth 2  — green
  '#ffd635',        // depth 3  — gold
  '#ff585b',        // depth 4  — coral
  '#00b4d8',        // depth 5+ — teal  (cycles back to orange after)
];

function depthColor(depth: number): string {
  return DEPTH_COLORS[depth % DEPTH_COLORS.length];
}

interface CommentThreadProps {
  comment: RedditComment;
  depth?: number;
}

/**
 * Recursive comment thread component.
 *
 * Renders a single comment with:
 *  - A coloured left border scaled to depth
 *  - Author / score / time meta row
 *  - Body text (tapping the header collapses/expands body + replies)
 *  - Its own replies rendered as nested <CommentThread> instances
 *
 * Wrapped in React.memo so sibling re-renders don't cascade into
 * already-stable subtrees.
 */
export const CommentThread = memo(function CommentThread({
  comment,
  depth = 0,
}: CommentThreadProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Skip deleted / removed comments silently
  if (
    !comment.body ||
    comment.body === '[deleted]' ||
    comment.body === '[removed]'
  ) {
    return null;
  }

  const color = depthColor(depth);
  const replyCount = comment.replies?.length ?? 0;

  return (
    <View
      style={[
        styles.container,
        depth > 0 && {
          marginLeft: Math.min(depth * Spacing.md, Spacing.md * 5),
          borderLeftWidth: 2,
          borderLeftColor: color,
          paddingLeft: Spacing.sm,
        },
      ]}
    >
      {/* -- Tappable header: collapses / expands body + replies -- */}
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
            {collapsed ? ' ?' : ' ?'}
          </Text>
        </View>
      </Pressable>

      {/* -- Body + replies (hidden when collapsed) -- */}
      {!collapsed ? (
        <>
          <Text style={styles.body} selectable>
            {comment.body}
          </Text>

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
  headerPressed: {
    opacity: 0.6,
  },
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
  body: {
    color: Colors.text,
    fontSize: Typography.sm,
    lineHeight: 20,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  replies: {
    marginTop: Spacing.xs,
  },
});
