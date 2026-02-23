import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ActivityIndicator,
  StyleSheet,
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

  // Load current language and supported languages on mount
  useEffect(() => {
    if (visible) {
      setCurrentLang(getCurrentLanguage());
      setSupportedLangs(getSupportedLanguages());
    }
  }, [visible]);

  // Handle language change
  const handleLanguageSelect = async (langCode: string) => {
    if (langCode === currentLang || changing) {
      return;
    }

    setChanging(true);
    hapticLight();

    try {
      await changeLanguage(langCode);
      hapticSuccess();

      // For RTL languages, the app will reload automatically
      // For LTR languages, just close the modal
      const langData = supportedLangs.find((l) => l.code === langCode);
      if (!langData?.isRTL) {
        onClose();
      }
      // If RTL, app will reload - no need to close
    } catch (error) {
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
          className="bg-dark-card rounded-t-3xl border-t border-dark-border"
          style={{ paddingBottom: insets.bottom + 20 }}
        >
          {/* Modal Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-dark-border">
            <Text className="text-white text-lg font-bold">
              {t('settings.language')}
            </Text>
            <Pressable
              onPress={() => {
                hapticLight();
                onClose();
              }}
              className="w-8 h-8 bg-dark-border rounded-full items-center justify-center active:opacity-70"
            >
              <Ionicons name="close" size={18} color="#9CA3AF" />
            </Pressable>
          </View>

          {/* Language List */}
          <View className="px-5 pt-2 max-h-[70vh]">
            {changing ? (
              <View className="py-8 items-center">
                <ActivityIndicator color="#00FF41" />
                <Text className="text-gray-400 font-mono text-xs mt-3">
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
                      ? 'border-b border-dark-border'
                      : ''
                  }`}
                >
                  <View className="flex-1">
                    <Text className="text-white text-sm font-medium">
                      {lang.nativeName}
                    </Text>
                    <Text className="text-gray-500 text-xs mt-0.5">
                      {lang.name}
                    </Text>
                  </View>

                  {lang.isRTL && (
                    <View className="bg-terminal-green/10 rounded-lg px-2 py-1 mr-2">
                      <Text className="text-terminal-green font-mono text-[10px]">
                        RTL
                      </Text>
                    </View>
                  )}

                  {currentLang === lang.code && !changing && (
                    <Ionicons name="checkmark" size={20} color="#00FF41" />
                  )}
                </Pressable>
              ))
            )}

            {/* Info Footer */}
            <View className="mt-4 mb-2 bg-terminal-green/5 rounded-xl p-3 border border-terminal-green/10">
              <View className="flex-row items-start">
                <Ionicons
                  name="information-circle"
                  size={16}
                  color="#00FF41"
                  style={{ marginTop: 2, marginRight: 8 }}
                />
                <View className="flex-1">
                  <Text className="text-gray-400 text-xs">
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
