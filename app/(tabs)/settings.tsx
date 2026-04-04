import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Linking,
  Pressable,
} from 'react-native';
import Constants from 'expo-constants';
import { Colors, Spacing, Typography, Radius } from '../../constants/theme';

function SettingRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && onPress && styles.rowPressed]}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
    </Pressable>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

export default function SettingsScreen() {
  const proxyUrl = process.env.EXPO_PUBLIC_NETLIFY_PROXY_URL;
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const expoSdkVersion = Constants.expoConfig?.sdkVersion ?? 'Unknown';

  const proxyStatus = proxyUrl
    ? `✅  Configured`
    : `⚠️  Not configured`;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <SectionHeader title="Proxy" />
      <View style={styles.card}>
        <SettingRow label="Netlify Proxy URL" value={proxyStatus} />
        {proxyUrl ? (
          <SettingRow
            label="URL"
            value={proxyUrl}
            onPress={() => Linking.openURL(proxyUrl)}
          />
        ) : null}
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          All Reddit API requests are routed through your Netlify proxy. No
          Reddit API credentials are stored in this app.
        </Text>
      </View>

      <SectionHeader title="About" />
      <View style={styles.card}>
        <SettingRow label="App Version" value={appVersion} />
        <SettingRow label="Expo SDK" value={expoSdkVersion} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: Spacing.xxl,
  },
  sectionHeader: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: Spacing.xl,
    marginBottom: Spacing.xs,
    marginHorizontal: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  rowPressed: {
    backgroundColor: Colors.surfaceElevated,
  },
  rowLabel: {
    color: Colors.text,
    fontSize: Typography.sm,
    flex: 1,
  },
  rowValue: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    maxWidth: '55%',
    textAlign: 'right',
  },
  infoBox: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    backgroundColor: Colors.primaryMuted,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  infoText: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
    lineHeight: 18,
  },
});
