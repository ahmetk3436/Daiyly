// Safe import — react-native-purchases requires a dev build (not available in Expo Go)
import * as Sentry from '@sentry/react-native';
let Purchases: any = null;
let LOG_LEVEL: any = null;
let RevenueCatUI: any = null;
let isInitialized = false;

let ENTITLEMENT_VERIFICATION_MODE: any = null;

try {
  const mod = require('react-native-purchases');
  Purchases = mod.default;
  LOG_LEVEL = mod.LOG_LEVEL;
  ENTITLEMENT_VERIFICATION_MODE = mod.ENTITLEMENT_VERIFICATION_MODE;
} catch {
  console.warn('[Purchases] react-native-purchases not available (Expo Go?)');
}

try {
  RevenueCatUI = require('react-native-purchases-ui').default;
} catch {
  console.warn('[Purchases] react-native-purchases-ui not available — using custom paywall');
}

export type PurchasesPackage = any;
export type PurchasesOffering = any;

const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_KEY;

export const initializePurchases = async () => {
  if (!Purchases || !API_KEY) {
    console.warn('[Purchases] Not available or API key missing — running in free mode');
    return;
  }

  try {
    Purchases.setLogLevel(LOG_LEVEL.WARN);
    await Purchases.configure({
      apiKey: API_KEY,
      entitlementVerificationMode: ENTITLEMENT_VERIFICATION_MODE?.INFORMATIONAL,
    });
    isInitialized = true;
    if (__DEV__) console.log('[Purchases] RevenueCat initialized');
  } catch (error) {
    Sentry.captureException(error);
    console.warn('[Purchases] Configure failed (Expo Go?) — running in free mode');
    isInitialized = false;
  }
};

export const getOfferings = async (): Promise<PurchasesOffering | null> => {
  if (!isInitialized) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch (error) {
    Sentry.captureException(error);
    console.warn('[Purchases] getOfferings failed:', error);
    return null;
  }
};

export const purchasePackage = async (
  pkg: PurchasesPackage,
): Promise<boolean> => {
  if (!isInitialized) return false;
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo.entitlements.active.premium !== undefined;
  } catch (error: any) {
    if (!error.userCancelled) {
      Sentry.captureException(error);
      console.warn('[Purchases] Purchase failed:', error);
    }
    return false;
  }
};

export const restorePurchases = async (): Promise<boolean> => {
  if (!isInitialized) return false;
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo.entitlements.active.premium !== undefined;
  } catch (error) {
    Sentry.captureException(error);
    console.warn('[Purchases] Restore failed:', error);
    return false;
  }
};

export const checkSubscriptionStatus = async (): Promise<boolean> => {
  if (!isInitialized) return false;
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active.premium !== undefined;
  } catch (error) {
    Sentry.captureException(error);
    console.warn('[Purchases] Status check failed:', error);
    return false;
  }
};

// --- RevenueCat Paywalls (dashboard-configured) ---

export const hasRevenueCatPaywall = (): boolean => {
  return RevenueCatUI !== null && isInitialized;
};

export const presentPaywall = async (): Promise<boolean> => {
  if (!RevenueCatUI || !isInitialized) return false;
  try {
    const result = await RevenueCatUI.presentPaywall();
    return result === 'PURCHASED' || result === 'RESTORED';
  } catch (error) {
    Sentry.captureException(error);
    console.warn('[Purchases] presentPaywall failed:', error);
    return false;
  }
};

export const presentPaywallIfNeeded = async (): Promise<boolean> => {
  if (!RevenueCatUI || !isInitialized) return false;
  try {
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: 'premium',
    });
    return result === 'PURCHASED' || result === 'RESTORED';
  } catch (error) {
    Sentry.captureException(error);
    console.warn('[Purchases] presentPaywallIfNeeded failed:', error);
    return false;
  }
};
