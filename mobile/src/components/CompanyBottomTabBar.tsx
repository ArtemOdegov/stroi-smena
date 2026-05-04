import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../navigation/types';

export type CompanyTabId = 'chats' | 'calendar' | 'team' | 'settings';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Props = {
  navigation: Nav;
  companyId: string;
  companyName: string;
  active: CompanyTabId;
};

/** Высота полосы вкладок без safe area (иконка + подпись + индикатор). */
export function companyTabBarInnerHeight() {
  return 56;
}

export function companyTabBarTotalHeight(insetsBottom: number) {
  return companyTabBarInnerHeight() + Math.max(insetsBottom, 8);
}

export function CompanyBottomTabBar({
  navigation,
  companyId,
  companyName,
  active,
}: Props) {
  const insets = useSafeAreaInsets();
  const padBottom = Math.max(insets.bottom, 8);

  function go(tab: CompanyTabId) {
    if (tab === active) return;
    if (tab === 'chats') {
      navigation.navigate('ChatList', { companyId, companyName });
      return;
    }
    if (tab === 'calendar') {
      navigation.navigate('Calendar', { companyId, companyName });
      return;
    }
    if (tab === 'team') {
      navigation.navigate('Colleagues', { companyId, companyName });
      return;
    }
    navigation.navigate('CompanySettings', { companyId, companyName });
  }

  return (
    <View style={[styles.shell, { paddingBottom: padBottom }]}>
      <View style={styles.row}>
        <TabItem
          label="Чаты"
          iconActive="chat"
          iconIdle="chat-bubble-outline"
          selected={active === 'chats'}
          onPress={() => go('chats')}
        />
        <TabItem
          label="График"
          iconActive="calendar-today"
          iconIdle="event"
          selected={active === 'calendar'}
          onPress={() => go('calendar')}
        />
        <TabItem
          label="Команда"
          iconActive="groups"
          iconIdle="groups"
          selected={active === 'team'}
          onPress={() => go('team')}
        />
        <TabItem
          label="Настройки"
          iconActive="settings"
          iconIdle="settings"
          selected={active === 'settings'}
          onPress={() => go('settings')}
        />
      </View>
    </View>
  );
}

function TabItem({
  label,
  iconActive,
  iconIdle,
  selected,
  onPress,
}: {
  label: string;
  iconActive: React.ComponentProps<typeof MaterialIcons>['name'];
  iconIdle: React.ComponentProps<typeof MaterialIcons>['name'];
  selected: boolean;
  onPress: () => void;
}) {
  const color = selected ? colors.primary : colors.outline;
  return (
    <TouchableOpacity
      style={styles.tab}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <MaterialIcons
        name={(selected ? iconActive : iconIdle) as React.ComponentProps<
          typeof MaterialIcons
        >['name']}
        size={24}
        color={color}
      />
      <Text style={[styles.tabLabel, { color }]}>{label}</Text>
      <View
        style={[
          styles.dot,
          { opacity: selected ? 1 : 0, backgroundColor: colors.tertiary },
        ]}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: 'rgba(248, 250, 252, 0.94)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    minHeight: companyTabBarInnerHeight(),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 4,
  },
  tabLabel: {
    marginTop: 4,
    fontFamily: fonts.label,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 5,
  },
});
