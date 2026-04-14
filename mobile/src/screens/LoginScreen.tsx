import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
  Keyboard,
  ScrollView,
  Image,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { login } from '../api/auth';
import { useSession } from '../context/SessionContext';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const LOGO_URI =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAVfo2nAOmWtdZ0351ddN4tkRU8mVPDCPKPO6haHpgYs92YHVH52ekw2lRo3KPIPhhxL-4XXYAfsp2IY7jUrZg2Q9sE_RgtbXgUZGPFKToS3xUeO-Ci_YuZLkUPUYiB--4qDetmSJNFLPiaU7vSh8ys0cue8c8VzXKTKEDp6x6rc4S3xFT8_uUklKPkjRDmWsMZvHj5sUijgVk0lPvpbTLJl0nxMZCe6zZ5vRmMYz3_wlgiQkgHMIu5-wYApHkVVe_CJa9kBpc4R6Q';

export function LoginScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { setTokens } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  async function onSubmit() {
    setBusy(true);
    try {
      const t = await login({ email: email.trim(), password });
      setTokens(t);
    } catch (e) {
      Alert.alert('Ошибка', String(e));
    } finally {
      setBusy(false);
    }
  }

  const Root = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
  const rootProps =
    Platform.OS === 'ios'
      ? ({ behavior: 'padding' as const } as const)
      : ({} as const);

  return (
    <Root style={styles.rootWrap} {...rootProps}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.orb, styles.orbTop]} />
        <View style={[styles.orb, styles.orbBottom]} />
      </View>
      <Pressable style={styles.dismissArea} onPress={Keyboard.dismiss}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: Math.max(insets.top, 20) + 8, paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandBlock}>
            <View style={styles.logoWrap}>
              {logoFailed ? (
                <View style={styles.logoFallback}>
                  <MaterialIcons name="architecture" size={40} color="#ffffff" />
                </View>
              ) : (
                <Image
                  source={{ uri: LOGO_URI }}
                  style={styles.logoImg}
                  resizeMode="cover"
                  onError={() => setLogoFailed(true)}
                />
              )}
            </View>
            <Text style={styles.brandTitle}>Строй-Смена</Text>
            <Text style={styles.brandSubtitle}>
              Архитектурный пульс вашего строительства
            </Text>
          </View>

          <View style={styles.formBlock}>
            <View style={styles.inputShell}>
              <MaterialIcons
                name="person-outline"
                size={22}
                color={colors.outline}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Логин (email)"
                placeholderTextColor={colors.outline}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>
            <View style={styles.inputShell}>
              <MaterialIcons
                name="lock-outline"
                size={22}
                color={colors.outline}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Пароль"
                placeholderTextColor={colors.outline}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <TouchableOpacity
              style={[styles.ctaPrimary, busy && styles.ctaDisabled]}
              onPress={onSubmit}
              disabled={busy}
              activeOpacity={0.92}
            >
              <Text style={styles.ctaPrimaryText}>Войти</Text>
              <MaterialIcons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>

            <View style={styles.sectionLabelWrap}>
              <Text style={styles.sectionLabel}>Впервые в Строй-Смене?</Text>
            </View>

            <TouchableOpacity
              style={styles.ctaSecondary}
              onPress={() => navigation.navigate('Register')}
              activeOpacity={0.92}
            >
              <MaterialIcons name="business" size={22} color={colors.primary} />
              <Text style={styles.ctaSecondaryText}>Создать компанию</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.ctaGhost}
              onPress={() => navigation.navigate('Register')}
              activeOpacity={0.92}
            >
              <MaterialIcons name="vpn-key" size={22} color={colors.secondary} />
              <Text style={styles.ctaGhostText}>Ввести код приглашения</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.legal}>
              Продолжая, вы соглашаетесь с нашими{' '}
              <Text style={styles.legalAccent}>Условиями использования</Text> и{' '}
              <Text style={styles.legalAccent}>Политикой конфиденциальности</Text>.
            </Text>
            <View style={styles.footerLinks}>
              <View style={styles.footerChip}>
                <MaterialIcons name="language" size={18} color={colors.subtext} />
                <Text style={styles.footerChipText}>Русский</Text>
              </View>
              <View style={styles.footerChip}>
                <MaterialIcons name="help-outline" size={18} color={colors.subtext} />
                <Text style={styles.footerChipText}>Поддержка</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </Pressable>
    </Root>
  );
}

const styles = StyleSheet.create({
  rootWrap: { flex: 1, backgroundColor: colors.bg },
  dismissArea: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  orb: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
  },
  orbTop: {
    top: -100,
    right: -80,
    backgroundColor: 'rgba(0, 97, 147, 0.07)',
  },
  orbBottom: {
    bottom: -120,
    left: -100,
    backgroundColor: 'rgba(139, 76, 0, 0.06)',
  },
  brandBlock: { alignItems: 'center', marginBottom: 36 },
  logoWrap: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: colors.primaryContainer,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  logoImg: { width: '100%', height: '100%' },
  logoFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryContainer,
  },
  brandTitle: {
    fontFamily: fonts.headline,
    fontSize: 32,
    letterSpacing: -0.5,
    color: colors.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  brandSubtitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.subtext,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  formBlock: { gap: 14 },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 4,
    paddingLeft: 14,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 14,
    paddingRight: 16,
  },
  ctaPrimary: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 4,
  },
  ctaDisabled: { opacity: 0.55 },
  ctaPrimaryText: {
    fontFamily: fonts.label,
    fontSize: 16,
    color: '#ffffff',
  },
  sectionLabelWrap: {
    paddingTop: 28,
    paddingBottom: 8,
    alignItems: 'center',
  },
  sectionLabel: {
    fontFamily: fonts.headlineBold,
    fontSize: 11,
    letterSpacing: 2.2,
    color: colors.subtext,
    textTransform: 'uppercase',
  },
  ctaSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.surfaceLow,
    paddingVertical: 16,
    borderRadius: 16,
  },
  ctaSecondaryText: {
    fontFamily: fonts.label,
    fontSize: 15,
    color: colors.primary,
  },
  ctaGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.card,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 97, 147, 0.12)',
  },
  ctaGhostText: {
    fontFamily: fonts.label,
    fontSize: 15,
    color: colors.secondary,
  },
  footer: { marginTop: 40, alignItems: 'center', gap: 20 },
  legal: {
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
    color: colors.outline,
    textAlign: 'center',
    maxWidth: 300,
  },
  legalAccent: {
    fontFamily: fonts.bodyMedium,
    color: colors.primary,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 28,
  },
  footerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerChipText: {
    fontFamily: fonts.headlineBold,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.subtext,
    textTransform: 'uppercase',
  },
});
