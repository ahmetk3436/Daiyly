import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Native haptic feedback (Apple Guideline 4.2 - Native Utility).
// Gracefully no-ops on Android/web where haptics may not be available.

export const hapticSuccess = () => {
  if (Platform.OS === 'ios') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
};

export const hapticError = () => {
  if (Platform.OS === 'ios') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
};

export const hapticWarning = () => {
  if (Platform.OS === 'ios') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }
};

export const hapticLight = () => {
  if (Platform.OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
};

export const hapticMedium = () => {
  if (Platform.OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
};

export const hapticSelection = () => {
  if (Platform.OS === 'ios') {
    Haptics.selectionAsync();
  }
};
