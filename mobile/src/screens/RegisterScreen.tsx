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
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { register } from '../api/auth';
import { useSession } from '../context/SessionContext';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export function RegisterScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { setTokens, markOpenCreateCompanyAfterAuth } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setBusy(true);
    try {
      const t = await register({
        email: email.trim(),
        password,
        name: name.trim(),
      });
      if (route.params?.flow === 'createCompany') {
        markOpenCreateCompanyAfterAuth();
      }
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
            { paddingTop: Math.max(insets.top, 16) + 4, paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.backRow}
            onPress={() => navigation.navigate('Login')}
            hitSlop={12}
          >
            <MaterialIcons name="arrow-back" size={20} color={colors.primary} />
            <Text style={styles.backText}>Назад ко входу</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Регистрация</Text>
          <Text style={styles.subtitle}>
            Создайте аккаунт директора или введите код приглашения после входа в
            приложение.
          </Text>

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
                placeholder="Как к вам обращаться"
                placeholderTextColor={colors.outline}
                value={name}
                onChangeText={setName}
              />
            </View>
            <View style={styles.inputShell}>
              <MaterialIcons
                name="alternate-email"
                size={22}
                color={colors.outline}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Email"
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
                placeholder="Пароль (не менее 8 символов)"
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
              <Text style={styles.ctaPrimaryText}>Создать аккаунт</Text>
              <MaterialIcons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
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
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  orbTop: {
    top: -90,
    right: -70,
    backgroundColor: 'rgba(0, 97, 147, 0.07)',
  },
  orbBottom: {
    bottom: -100,
    left: -80,
    backgroundColor: 'rgba(139, 76, 0, 0.06)',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  backText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.primary,
  },
  title: {
    fontFamily: fonts.headline,
    fontSize: 28,
    letterSpacing: -0.4,
    color: colors.primary,
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.subtext,
    marginBottom: 28,
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
    marginTop: 10,
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
});
