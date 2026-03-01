import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FeatureConfig {
  icon: string;
  text: string;
}

export interface PlanConfig {
  id: 'annual' | 'monthly';
  label: string;
  price: string;
  per_month?: string;
  badge?: string | null;
  is_default: boolean;
}

export interface PaywallConfig {
  variant: string;
  headline: string;
  /** Headline with {name} token */
  headline_named: string;
  subtitle: string;
  social_proof: string;
  show_urgency: boolean;
  urgency_trigger: string;
  urgency_trigger_value: number;
  urgency_text: string;
  urgency_badge: string;
  features: FeatureConfig[];
  plans: PlanConfig[];
  cta_primary: string;
  cta_subtext: string;
  cta_processing: string;
  restore_text: string;
  trial_notice: string;
  trial_days: number;
}

// ─── Cache keys ──────────────────────────────────────────────────────────────

const CACHE_KEY    = '@daiyly_paywall_config';
const CACHE_TS_KEY = '@daiyly_paywall_config_ts';
const STALE_TTL_MS = 5 * 60 * 1000;
const HARD_TTL_MS  = 60 * 60 * 1000;

// ─── Hardcoded fallback ──────────────────────────────────────────────────────

export const DEFAULT_PAYWALL_CONFIG: PaywallConfig = {
  variant: 'default',
  headline: 'Know yourself, grow every day',
  headline_named: 'Hey {name}, unlock your full journal',
  subtitle: 'Track emotions in real time. Spot patterns. Feel better.',
  social_proof: '50,000+ people journaling daily',
  show_urgency: true,
  urgency_trigger: 'install_days_lte',
  urgency_trigger_value: 3,
  urgency_text: 'Limited time offer — Save 50% today',
  urgency_badge: 'SAVE 50%',
  features: [
    { icon: 'analytics-outline',     text: 'AI-powered weekly insights' },
    { icon: 'cloud-outline',          text: 'Word cloud visualization' },
    { icon: 'infinite-outline',       text: 'Unlimited journal history' },
    { icon: 'search-outline',         text: 'Full-text search across entries' },
    { icon: 'share-outline',          text: 'Shareable mood cards' },
    { icon: 'download-outline',       text: 'Data export anytime' },
  ],
  plans: [
    { id: 'annual',  label: 'Annual Plan',  price: '$29.99/year', per_month: '$2.50/mo', badge: 'Best Value', is_default: true  },
    { id: 'monthly', label: 'Monthly Plan', price: '$4.99/month', badge: null,            is_default: false },
  ],
  cta_primary:    'Start 7-Day Free Trial',
  cta_subtext:    'No payment due now',
  cta_processing: 'Processing...',
  restore_text:   'Restore Purchases',
  trial_notice:   '7-day free trial, then $29.99/year. Cancel anytime.',
  trial_days:     7,
};

// ─── Fetch + cache ───────────────────────────────────────────────────────────

async function fetchAndCache(): Promise<PaywallConfig> {
  try {
    const { data } = await api.get('/config');
    const raw = data?.paywall_config;
    if (raw && typeof raw === 'object') {
      const config: PaywallConfig = { ...DEFAULT_PAYWALL_CONFIG, ...raw };
      await AsyncStorage.multiSet([
        [CACHE_KEY,    JSON.stringify(config)],
        [CACHE_TS_KEY, String(Date.now())],
      ]);
      return config;
    }
  } catch {}
  return DEFAULT_PAYWALL_CONFIG;
}

export async function getPaywallConfig(): Promise<PaywallConfig> {
  try {
    const [[, cachedStr], [, tsStr]] = await AsyncStorage.multiGet([CACHE_KEY, CACHE_TS_KEY]);
    const ts  = tsStr ? parseInt(tsStr, 10) : 0;
    const age = Date.now() - ts;

    if (cachedStr && age < HARD_TTL_MS) {
      const config = JSON.parse(cachedStr) as PaywallConfig;
      if (age > STALE_TTL_MS) {
        fetchAndCache().catch(() => {});
      }
      return config;
    }
  } catch {}

  return fetchAndCache();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function resolveUrgency(config: PaywallConfig, daysSinceInstall: number): boolean {
  if (!config.show_urgency) return false;
  switch (config.urgency_trigger) {
    case 'always': return true;
    case 'never':  return false;
    case 'install_days_lte':
    default:
      return daysSinceInstall <= config.urgency_trigger_value;
  }
}

export function resolveHeadline(config: PaywallConfig, name?: string | null): string {
  if (name && config.headline_named) {
    return config.headline_named.replace('{name}', name);
  }
  return config.headline;
}

export function getDefaultPlan(config: PaywallConfig): PlanConfig {
  return config.plans.find((p) => p.is_default) ?? config.plans[0];
}
