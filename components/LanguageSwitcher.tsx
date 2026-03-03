import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  changeLanguage,
  getCurrentLanguage,
  getSupportedLanguages,
  type SupportedLanguage,
} from '../lib/i18n';
import * as Sentry from '@sentry/react-native';
import { hapticLight, hapticSuccess } from '../lib/haptics';

interface LanguageSwitcherProps {
  visible: boolean;
  onClose: () => void;
}

export default function LanguageSwitcher({
  visible,
  onClose,
}: LanguageSwitcherProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [currentLang, setCurrentLang] = useState<string>('en');
  const [supportedLangs, setSupportedLangs] = useState<SupportedLanguage[]>([]);
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    if (visible) {
      setCurrentLang(getCurrentLanguage());
      setSupportedLangs(getSupportedLanguages());
    }
  }, [visible]);

  const handleLanguageSelect = async (langCode: string) => {
    if (langCode === currentLang || changing) {
      return;
    }

    setChanging(true);
    hapticLight();

    try {
      await changeLanguage(langCode);
      hapticSuccess();

      const langData = supportedLangs.find((l) => l.code === langCode);
      if (!langData?.isRTL) {
        onClose();
      }
    } catch (error) {
      Sentry.captureException(error);
      console.error('Failed to change language:', error);
      setChanging(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/80 justify-end">
        <View
          className="bg-surface-elevated rounded-t-3xl border-t border-border"
          style={{ paddingBottom: insets.bottom + 20 }}
        >
          {/* Modal Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-border">
            <Text className="text-text-primary text-lg font-bold">
              {t('settings.language')}
            </Text>
            <Pressable
              onPress={() => {
                hapticLight();
                onClose();
              }}
              className="w-8 h-8 bg-primary-100 dark:bg-primary-900 rounded-full items-center justify-center active:opacity-70"
            >
              <Ionicons name="close" size={18} color="#9CA3AF" />
            </Pressable>
          </View>

          {/* Language List */}
          <View className="px-5 pt-2 max-h-[70vh]">
            {changing ? (
              <View className="py-8 items-center">
                <ActivityIndicator color="#2563EB" />
                <Text className="text-text-muted text-xs mt-3">
                  {t('common.loading')}
                </Text>
              </View>
            ) : (
              supportedLangs.map((lang, index) => (
                <Pressable
                  key={lang.code}
                  onPress={() => handleLanguageSelect(lang.code)}
                  disabled={changing}
                  className={`flex-row items-center py-3.5 active:opacity-70 ${
                    index < supportedLangs.length - 1
                      ? 'border-b border-border'
                      : ''
                  }`}
                >
                  <View className="flex-1">
                    <Text className="text-text-primary text-sm font-medium">
                      {lang.nativeName}
                    </Text>
                    <Text className="text-text-secondary text-xs mt-0.5">
                      {lang.name}
                    </Text>
                  </View>

                  {lang.isRTL && (
                    <View className="bg-primary-100 dark:bg-primary-900 rounded-lg px-2 py-1 mr-2">
                      <Text className="text-primary text-[10px] font-semibold">
                        RTL
                      </Text>
                    </View>
                  )}

                  {currentLang === lang.code && !changing && (
                    <Ionicons name="checkmark" size={20} color="#2563EB" />
                  )}
                </Pressable>
              ))
            )}

            {/* Info Footer */}
            <View className="mt-4 mb-2 bg-primary-50 dark:bg-primary-900/20 rounded-xl p-3 border border-primary-200 dark:border-primary-800">
              <View className="flex-row items-start">
                <Ionicons
                  name="information-circle"
                  size={16}
                  color="#2563EB"
                  style={{ marginTop: 2, marginRight: 8 }}
                />
                <View className="flex-1">
                  <Text className="text-text-secondary text-xs">
                    For Arabic (RTL), the app will reload to apply layout
                    changes.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
