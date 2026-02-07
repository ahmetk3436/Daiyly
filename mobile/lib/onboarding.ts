import * as SecureStore from 'expo-secure-store';

const ONBOARDING_KEY = 'onboarding_complete';

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(ONBOARDING_KEY);
    return value === 'true';
  } catch (error) {
    // If there's an error reading, assume onboarding is not seen
    return false;
  }
}

export async function setOnboardingSeen(): Promise<void> {
  await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
}