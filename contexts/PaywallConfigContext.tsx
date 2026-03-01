import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  DEFAULT_PAYWALL_CONFIG,
  PaywallConfig,
  getPaywallConfig,
} from '../lib/paywallConfig';

interface PaywallConfigContextValue {
  config: PaywallConfig;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const PaywallConfigContext = createContext<PaywallConfigContextValue>({
  config: DEFAULT_PAYWALL_CONFIG,
  isLoading: true,
  refresh: async () => {},
});

export function PaywallConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<PaywallConfig>(DEFAULT_PAYWALL_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    const cfg = await getPaywallConfig();
    setConfig(cfg);
    setIsLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <PaywallConfigContext.Provider value={{ config, isLoading, refresh: load }}>
      {children}
    </PaywallConfigContext.Provider>
  );
}

export function usePaywallConfig() {
  return useContext(PaywallConfigContext);
}
