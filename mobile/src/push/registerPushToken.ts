import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { registerPushToken as registerPushTokenApi } from '../api/auth';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Запрашивает разрешения, получает Expo или нативный push-токен и отправляет на бэкенд.
 * Ошибки глушим — пуши опциональны для работы приложения.
 */
export async function tryRegisterPushToken(): Promise<void> {
  if (!Device.isDevice) return;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
        ?.eas?.projectId ?? Constants.easConfig?.projectId;

    let token: string;
    let tokenKind: 'expo' | 'fcm' = 'fcm';

    if (projectId) {
      try {
        const expo = await Notifications.getExpoPushTokenAsync({ projectId });
        token = expo.data;
        tokenKind = 'expo';
      } catch {
        const native = await Notifications.getDevicePushTokenAsync();
        token = String(native.data);
        tokenKind = 'fcm';
      }
    } else {
      const native = await Notifications.getDevicePushTokenAsync();
      token = String(native.data);
      tokenKind = 'fcm';
    }

    await registerPushTokenApi({
      token,
      tokenKind,
      platform: Platform.OS,
    });
  } catch {
    // сеть / отсутствие EAS projectId / симулятор
  }
}
