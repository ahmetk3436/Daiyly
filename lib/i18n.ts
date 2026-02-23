import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { getLocales } from 'expo-localization';

// Import translations
import en from '../locales/en.json';
import tr from '../locales/tr.json';
import de from '../locales/de.json';
import fr from '../locales/fr.json';
import es from '../locales/es.json';
import it from '../locales/it.json';
import pt from '../locales/pt.json';
import ru from '../locales/ru.json';
import ar from '../locales/ar.json';
import zh from '../locales/zh.json';

export const LANGUAGE_STORAGE_KEY = '@daiyly_language';

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  isRTL: boolean;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', name: 'English', nativeName: 'English', isRTL: false },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', isRTL: false },
  { code: 'de', name: 'German', nativeName: 'Deutsch', isRTL: false },
  { code: 'fr', name: 'French', nativeName: 'Français', isRTL: false },
  { code: 'es', name: 'Spanish', nativeName: 'Español', isRTL: false },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', isRTL: false },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', isRTL: false },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', isRTL: false },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', isRTL: true },
  { code: 'zh', name: 'Chinese', nativeName: '中文', isRTL: false },
];

// Get device language code (e.g., 'en-US' -> 'en')
const getDeviceLanguage = (): string => {
  const locales = getLocales();
  if (locales && locales.length > 0) {
    const deviceLang = locales[0].languageCode || 'en';
    // Check if device language is supported
    const isSupported = SUPPORTED_LANGUAGES.some((lang) => lang.code === deviceLang);
    return isSupported ? deviceLang : 'en';
  }
  return 'en';
};

// Initialize i18n
const initI18n = async () => {
  let savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);

  // If no saved language, use device language
  if (!savedLanguage) {
    savedLanguage = getDeviceLanguage();
  }

  await i18n.use(initReactI18next).init({
    compatibilityJSON: 'v3',
    resources: {
      en: { translation: en },
      tr: { translation: tr },
      de: { translation: de },
      fr: { translation: fr },
      es: { translation: es },
      it: { translation: it },
      pt: { translation: pt },
      ru: { translation: ru },
      ar: { translation: ar },
      zh: { translation: zh },
    },
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

  // Handle RTL for Arabic
  const langData = SUPPORTED_LANGUAGES.find((l) => l.code === savedLanguage);
  if (langData?.isRTL && !I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
  } else if (!langData?.isRTL && I18nManager.isRTL) {
    I18nManager.allowRTL(false);
    I18nManager.forceRTL(false);
  }

  return savedLanguage;
};

// Change language with app reload for RTL
export const changeLanguage = async (languageCode: string): Promise<void> => {
  const langData = SUPPORTED_LANGUAGES.find((l) => l.code === languageCode);
  if (!langData) {
    throw new Error(`Unsupported language: ${languageCode}`);
  }

  // Save to storage
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, languageCode);

  // Change i18n language
  await i18n.changeLanguage(languageCode);

  // Handle RTL - requires reload for Arabic
  const needsReload =
    (langData.isRTL && !I18nManager.isRTL) ||
    (!langData.isRTL && I18nManager.isRTL);

  if (needsReload) {
    if (langData.isRTL) {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(true);
    } else {
      I18nManager.allowRTL(false);
      I18nManager.forceRTL(false);
    }

    // Reload app to apply RTL changes
    await Updates.reloadAsync();
  }
};

// Get current language
export const getCurrentLanguage = (): string => {
  return i18n.language;
};

// Get supported languages list
export const getSupportedLanguages = (): SupportedLanguage[] => {
  return SUPPORTED_LANGUAGES;
};

// Check if current language is RTL
export const isRTL = (): boolean => {
  return I18nManager.isRTL;
};

// Track initialization state
let initPromise: Promise<string> | null = null;

// Explicit initialization function (for calling in app root)
export const initLanguage = async (): Promise<string> => {
  if (!initPromise) {
    initPromise = initI18n();
  }
  return initPromise;
};

// Auto-initialize on module load for convenience
// Note: This will start initialization but components should still await initLanguage()
initPromise = initI18n();

export default i18n;
