/* ===================================================================
   Nexus AI OS — Mobile Settings Screen
   Profile, server config, notifications, voice, theme, about, logout
   =================================================================== */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';

import Header from '../components/Header';
import Card from '../components/Card';
import { colors, typography, spacing, borderRadius } from '../lib/theme';
import { useStore } from '../lib/store';
import { setApiBaseUrl } from '../lib/api';

/* ------------------------------------------------------------------ */
/*  SettingsRow helper                                                 */
/* ------------------------------------------------------------------ */
interface SettingsRowProps {
  icon: string;
  iconColor?: string;
  label: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
}

const SettingsRow: React.FC<SettingsRowProps> = ({
  icon, iconColor = colors.primary, label, value, onPress, right,
}) => (
  <TouchableOpacity
    style={styles.settingsRow}
    onPress={onPress}
    disabled={!onPress && !right}
    activeOpacity={onPress ? 0.7 : 1}
  >
    <View style={[styles.settingsIcon, { backgroundColor: iconColor + '20' }]}>
      <Icon name={icon} size={18} color={iconColor} />
    </View>
    <View style={styles.settingsContent}>
      <Text style={styles.settingsLabel}>{label}</Text>
      {value && <Text style={styles.settingsValue}>{value}</Text>}
    </View>
    {right ?? (onPress && <Icon name="chevron-forward" size={18} color={colors.muted} />)}
  </TouchableOpacity>
);

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
const SettingsScreen: React.FC = () => {
  const {
    theme, setTheme,
    serverUrl, setServerUrl,
    notificationsEnabled, setNotificationsEnabled,
    voiceEnabled, setVoiceEnabled,
  } = useStore();

  const [editingServer, setEditingServer] = useState(false);
  const [serverInput, setServerInput] = useState(serverUrl);

  /* ---- Save server URL ---- */
  const saveServerUrl = async () => {
    const url = serverInput.trim().replace(/\/$/, '');
    if (!url) return;
    setServerUrl(url);
    await setApiBaseUrl(url + '/api');
    setEditingServer(false);
    Alert.alert('Server Updated', `Now connecting to ${url}`);
  };

  /* ---- Logout ---- */
  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to disconnect?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => Alert.alert('Logged Out', 'Session cleared'),
      },
    ]);
  };

  const isDark = theme === 'dark';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Settings" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile */}
        <LinearGradient
          colors={colors.gradientPrimary as unknown as string[]}
          style={styles.profileCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.avatar}>
            <Icon name="person" size={32} color="#fff" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Nexus User</Text>
            <Text style={styles.profileEmail}>user@nexus-ai.local</Text>
          </View>
          <TouchableOpacity>
            <Icon name="create-outline" size={20} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </LinearGradient>

        {/* Server Connection */}
        <Text style={styles.section}>Connection</Text>
        <Card style={styles.sectionCard}>
          {editingServer ? (
            <View style={styles.serverEdit}>
              <TextInput
                style={styles.serverInput}
                value={serverInput}
                onChangeText={setServerInput}
                placeholder="http://192.168.1.100:8000"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <View style={styles.serverActions}>
                <TouchableOpacity
                  style={[styles.serverBtn, { backgroundColor: colors.border }]}
                  onPress={() => setEditingServer(false)}
                >
                  <Text style={styles.serverBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.serverBtn, { backgroundColor: colors.primary }]}
                  onPress={saveServerUrl}
                >
                  <Text style={[styles.serverBtnText, { color: '#fff' }]}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <SettingsRow
              icon="server"
              label="Server URL"
              value={serverUrl}
              onPress={() => setEditingServer(true)}
            />
          )}
          <View style={styles.divider} />
          <SettingsRow
            icon="wifi"
            iconColor={colors.success}
            label="Connection Status"
            value="Connected"
          />
        </Card>

        {/* Notifications */}
        <Text style={styles.section}>Notifications</Text>
        <Card style={styles.sectionCard}>
          <SettingsRow
            icon="notifications"
            iconColor={colors.warning}
            label="Push Notifications"
            right={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: colors.border, true: colors.primary + '60' }}
                thumbColor={notificationsEnabled ? colors.primary : colors.muted}
              />
            }
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="alert-circle"
            iconColor={colors.error}
            label="Alert Sounds"
            right={
              <Switch
                value={true}
                onValueChange={() => {}}
                trackColor={{ false: colors.border, true: colors.primary + '60' }}
                thumbColor={colors.primary}
              />
            }
          />
        </Card>

        {/* Voice */}
        <Text style={styles.section}>Voice</Text>
        <Card style={styles.sectionCard}>
          <SettingsRow
            icon="mic"
            iconColor={colors.secondary}
            label="Voice Assistant"
            right={
              <Switch
                value={voiceEnabled}
                onValueChange={setVoiceEnabled}
                trackColor={{ false: colors.border, true: colors.secondary + '60' }}
                thumbColor={voiceEnabled ? colors.secondary : colors.muted}
              />
            }
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="volume-high"
            iconColor={colors.accent}
            label="Voice Model"
            value="Neural-v2"
            onPress={() => Alert.alert('Voice Model', 'Neural-v2 (default)')}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="ear"
            iconColor={colors.primary}
            label="Wake Word"
            value="Hey Nexus"
          />
        </Card>

        {/* Appearance */}
        <Text style={styles.section}>Appearance</Text>
        <Card style={styles.sectionCard}>
          <SettingsRow
            icon={isDark ? 'moon' : 'sunny'}
            iconColor={isDark ? colors.secondary : colors.warning}
            label="Dark Mode"
            right={
              <Switch
                value={isDark}
                onValueChange={(v) => setTheme(v ? 'dark' : 'light')}
                trackColor={{ false: colors.border, true: colors.secondary + '60' }}
                thumbColor={isDark ? colors.secondary : colors.warning}
              />
            }
          />
        </Card>

        {/* About */}
        <Text style={styles.section}>About</Text>
        <Card style={styles.sectionCard}>
          <SettingsRow icon="information-circle" label="Version" value="1.0.0" />
          <View style={styles.divider} />
          <SettingsRow
            icon="logo-github"
            iconColor="#fff"
            label="Source Code"
            onPress={() => Linking.openURL('https://github.com/nexus-ai')}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="document-text"
            iconColor={colors.accent}
            label="Documentation"
            onPress={() => Linking.openURL('https://docs.nexus-ai.local')}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="shield-checkmark"
            iconColor={colors.success}
            label="Privacy Policy"
            onPress={() => {}}
          />
        </Card>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Icon name="log-out" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Disconnect & Logout</Text>
        </TouchableOpacity>

        <View style={{ height: spacing.xxxl * 2 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg },

  profileCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: { flex: 1, marginLeft: spacing.lg },
  profileName: { ...typography.h3, color: '#fff' },
  profileEmail: { ...typography.bodySmall, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  section: {
    ...typography.label,
    color: colors.muted,
    textTransform: 'uppercase',
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },

  sectionCard: { padding: 0, overflow: 'hidden' },

  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  settingsIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsContent: { flex: 1, marginLeft: spacing.md },
  settingsLabel: { ...typography.body, color: colors.text },
  settingsValue: { ...typography.bodySmall, color: colors.muted, marginTop: 1 },

  divider: { height: 1, backgroundColor: colors.border, marginLeft: 60 },

  /* Server edit */
  serverEdit: { padding: spacing.lg },
  serverInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  serverActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
  serverBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  serverBtnText: { ...typography.button, color: colors.text },

  /* Logout */
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xxl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.error + '15',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.error + '30',
  },
  logoutText: { ...typography.button, color: colors.error },
});

export default SettingsScreen;
