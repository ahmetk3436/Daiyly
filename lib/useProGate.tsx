import { useSubscription } from '../contexts/SubscriptionContext';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { hasRevenueCatPaywall, presentPaywall } from './purchases';

export function useProGate() {
  const { isSubscribed, checkSubscription } = useSubscription();

  const requirePro = (feature: string, onAllowed?: () => void) => {
    if (isSubscribed) {
      onAllowed?.();
      return true;
    }

    if (hasRevenueCatPaywall()) {
      presentPaywall().then((purchased) => {
        if (purchased) {
          checkSubscription();
          onAllowed?.();
        }
      });
    } else {
      Alert.alert(
        'Premium Feature',
        `${feature} is available with Daiyly Premium. Start your free trial today!`,
        [
          { text: 'Maybe Later', style: 'cancel' },
          { text: 'See Plans', onPress: () => router.push('/(protected)/paywall?source=pro-gate') },
        ]
      );
    }
    return false;
  };

  return { isSubscribed, requirePro };
}
