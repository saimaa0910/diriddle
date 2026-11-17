import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { notificationsApi } from '../api/notifications.api';

// Configure notification behavior when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync().catch(() => null);
    if (!tokenData?.data) {
      return null;
    }

    const pushToken = tokenData.data;
    const platform = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';

    // Register with diriddle backend
    await notificationsApi.registerDeviceToken(pushToken, platform).catch(() => {
      // Non-blocking in offline/demo mode
    });

    return pushToken;
  } catch {
    // Fail gracefully on simulator or development environments without push credentials
    return null;
  }
}
