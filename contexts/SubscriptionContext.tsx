import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import * as Sentry from '@sentry/react-native';
import {
  checkSubscriptionStatus,
  purchasePackage,
  restorePurchases,
  getOfferings,
  initializePurchases,
  PurchasesPackage,
  PurchasesOffering,
} from '../lib/purchases';

interface SubscriptionContextType {
  isSubscribed: boolean;
  isLoading: boolean;
  offerings: PurchasesOffering | null;
  checkSubscription: () => Promise<void>;
  handlePurchase: (pkg: PurchasesPackage) => Promise<boolean>;
  handleRestore: () => Promise<boolean>;
  refreshOfferings: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined,
);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
};

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  // Re-entry guard: prevents double-tapping the purchase button from launching
  // two concurrent RevenueCat purchase flows, which can produce duplicate charges.
  const isPurchasing = useRef(false);

  const checkSubscription = async () => {
    try {
      const subscribed = await checkSubscriptionStatus();
      setIsSubscribed(subscribed);
    } catch (error) {
      Sentry.captureException(error);
      console.error('Error checking subscription:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurchase = async (
    pkg: PurchasesPackage,
  ): Promise<boolean> => {
    if (isPurchasing.current) return false;
    isPurchasing.current = true;
    setIsLoading(true);
    try {
      const success = await purchasePackage(pkg);
      if (success) {
        setIsSubscribed(true);
      }
      return success;
    } catch (error) {
      Sentry.captureException(error);
      console.error('Purchase error:', error);
      return false;
    } finally {
      isPurchasing.current = false;
      setIsLoading(false);
    }
  };

  const handleRestore = async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const success = await restorePurchases();
      if (success) {
        setIsSubscribed(true);
      }
      return success;
    } catch (error) {
      Sentry.captureException(error);
      console.error('Restore error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshOfferings = async () => {
    try {
      const offeringsData = await getOfferings();
      setOfferings(offeringsData);
    } catch (error) {
      Sentry.captureException(error);
      console.error('Error fetching offerings:', error);
    }
  };

  useEffect(() => {
    (async () => {
      await initializePurchases();
      await checkSubscription();
      await refreshOfferings();
    })();
  }, []);

  return (
    <SubscriptionContext.Provider
      value={{
        isSubscribed,
        isLoading,
        offerings,
        checkSubscription,
        handlePurchase,
        handleRestore,
        refreshOfferings,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};
