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
import { createCompany } from '../api/companies';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateCompany'>;

export function CreateCompanyScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [orgName, setOrgName] = useState('');
  const [inn, setInn] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    const name = orgName.trim();
    if (!name) {
      Alert.alert('Название', 'Введите название организации');
      return;
    }
    setBusy(true);
    try {
      const res = await createCompany(name);
      const extra = inn.trim()
        ? `\n\nИНН/реквизиты пока не сохраняются в облаке — только название.`
        : '';
      Alert.alert(
        'Компания создана',
        `Код приглашения: ${res.inviteCode}${extra}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
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
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={12}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Новая компания</Text>
        <View style={styles.topSpacer} />
      </View>

      <Pressable style={styles.flex} onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroCircle}>
              <MaterialIcons name="domain" size={40} color={colors.primary} />
            </View>
            <Text style={styles.heroTitle}>Начните свой путь</Text>
            <Text style={styles.heroSub}>
              Создайте профиль организации для управления объектами и задачами
              вашей команды.
            </Text>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Название организации</Text>
            <View style={styles.pill}>
              <MaterialIcons
                name="business"
                size={22}
                color="rgba(0, 97, 147, 0.65)"
                style={styles.pillIcon}
              />
              <TextInput
                style={styles.pillInput}
                placeholder="ООО СтройКонсалт"
                placeholderTextColor="rgba(111, 120, 129, 0.75)"
                value={orgName}
                onChangeText={setOrgName}
              />
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>
              ИНН / Реквизиты{' '}
              <Text style={styles.labelOptional}>
                (опционально, не сохраняются)
              </Text>
            </Text>
            <View style={styles.pill}>
              <MaterialIcons
                name="description"
                size={22}
                color="rgba(0, 97, 147, 0.65)"
                style={styles.pillIcon}
              />
              <TextInput
                style={styles.pillInput}
                placeholder="7700000000"
                placeholderTextColor="rgba(111, 120, 129, 0.75)"
                value={inn}
                onChangeText={setInn}
                keyboardType="numeric"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.cta, busy && styles.ctaDisabled]}
            onPress={onSubmit}
            disabled={busy}
            activeOpacity={0.92}
          >
            <Text style={styles.ctaText}>Создать компанию</Text>
            <View style={styles.ctaIconWrap}>
              <MaterialIcons name="arrow-forward" size={22} color="#fff" />
            </View>
          </TouchableOpacity>

          <Text style={styles.legal}>
            Нажимая кнопку, вы подтверждаете согласие с условиями использования и
            политикой конфиденциальности.
          </Text>
        </ScrollView>
      </Pressable>
    </Root>
  );
}

const styles = StyleSheet.create({
  rootWrap: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: 'rgba(249, 249, 249, 0.92)',
  },
  backBtn: { padding: 4 },
  topTitle: {
    fontFamily: fonts.headlineBold,
    fontSize: 17,
    letterSpacing: -0.3,
    color: colors.primary,
  },
  topSpacer: { width: 32 },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 8,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  hero: { alignItems: 'center', marginBottom: 32 },
  heroCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceLow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    overflow: 'hidden',
  },
  heroTitle: {
    fontFamily: fonts.headline,
    fontSize: 24,
    letterSpacing: -0.4,
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSub: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.subtext,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  fieldBlock: { marginBottom: 22 },
  label: {
    fontFamily: fonts.label,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.subtext,
    marginBottom: 8,
    marginLeft: 14,
  },
  labelOptional: {
    textTransform: 'none',
    letterSpacing: 0,
    fontFamily: fonts.body,
    fontSize: 10,
    fontStyle: 'italic',
    opacity: 0.65,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(191, 199, 210, 0.22)',
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  pillIcon: { marginRight: 10 },
  pillInput: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 14,
    paddingRight: 12,
  },
  cta: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 22,
  },
  ctaDisabled: { opacity: 0.55 },
  ctaText: {
    fontFamily: fonts.headlineBold,
    fontSize: 16,
    color: '#fff',
    letterSpacing: -0.2,
  },
  ctaIconWrap: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    padding: 6,
  },
  legal: {
    marginTop: 22,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
    color: colors.subtext,
    textAlign: 'center',
    paddingHorizontal: 28,
  },
});
