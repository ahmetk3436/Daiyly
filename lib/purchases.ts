// Safe import — react-native-purchases requires a dev build (not available in Expo Go)
let Purchases: any = null;
let LOG_LEVEL: any = null;

try {
  const mod = require('react-native-purchases');
  Purchases = mod.default;
  LOG_LEVEL = mod.LOG_LEVEL;
} catch {
  console.warn('[Daiyly] react-native-purchases not available (Expo Go?)');
}

export type PurchasesPackage = any;
export type PurchasesOffering = any;

const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_KEY;

export const initializePurchases = async () => {
  if (!Purchases || !API_KEY) {
    console.warn('RevenueCat not available or API key not configured');
    return;
  }

  try {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey: API_KEY });
    console.log('RevenueCat initialized successfully');
  } catch (error) {
    console.error('Failed to initialize RevenueCat:', error);
  }
};

export const getOfferings = async (): Promise<PurchasesOffering | null> => {
  if (!Purchases) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch (error) {
    console.error('Failed to fetch offerings:', error);
    return null;
  }
};

export const purchasePackage = async (
  pkg: PurchasesPackage,
): Promise<boolean> => {
  if (!Purchases) return false;
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo.entitlements.active.premium !== undefined;
  } catch (error: any) {
    if (!error.userCancelled) {
      console.error('Purchase failed:', error);
    }
    return false;
  }
};

export const restorePurchases = async (): Promise<boolean> => {
  if (!Purchases) return false;
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo.entitlements.active.premium !== undefined;
  } catch (error) {
    console.error('Restore purchases failed:', error);
    return false;
  }
};

export const checkSubscriptionStatus = async (): Promise<boolean> => {
  if (!Purchases) return false;
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active.premium !== undefined;
  } catch (error) {
    console.error('Failed to check subscription status:', error);
    return false;
  }
};
