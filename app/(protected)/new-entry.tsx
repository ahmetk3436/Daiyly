import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import Constants from 'expo-constants';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import api from '../../lib/api';
import {
  saveGuestEntry,
  hasGuestUsesRemaining,
  incrementGuestUses,
} from '../../lib/guest';
import {
  hapticLight,
  hapticSelection,
  hapticSuccess,
  hapticError,
  hapticMedium,
} from '../../lib/haptics';
import { trackEntrySaved } from '../../lib/review';
import { MOOD_OPTIONS } from '../../types/journal';
import { useTranslation } from 'react-i18next';
import { analyzeTextEmotion, getEmotionColor, getEmotionEmoji, type EmotionAIResult } from '../../lib/emotionAI';
import WritingPromptCard from '../../components/ui/WritingPromptCard';
import { getReframeQuestions } from '../../lib/cognitiveReframe';

// HealthKit is iOS-only and unavailable in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';
let AppleHealthKit: any = null;
if (Platform.OS === 'ios' && !isExpoGo) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    AppleHealthKit = require('react-native-health').default;
  } catch {
    AppleHealthKit = null;
  }
}

const MOOD_SCORES: number[] = [20, 40, 60, 80, 100];

// Must match backend CardColors allowlist in daiyly/models.go exactly.
const CARD_COLORS: string[] = [
  '#fef3c7', // Amber pastel
  '#dbeafe', // Blue pastel
  '#dcfce7', // Green pastel
  '#fce7f3', // Pink pastel
  '#ede9fe', // Violet pastel
  '#fef2f2', // Red pastel
];

const ACTIVITY_TAGS = [
  { id: 'work', label: 'Work', icon: 'briefcase-outline' as const },
  { id: 'exercise', label: 'Exercise', icon: 'fitness-outline' as const },
  { id: 'social', label: 'Social', icon: 'people-outline' as const },
  { id: 'reading', label: 'Reading', icon: 'book-outline' as const },
  { id: 'nature', label: 'Nature', icon: 'leaf-outline' as const },
  { id: 'music', label: 'Music', icon: 'musical-notes-outline' as const },
  { id: 'cooking', label: 'Cooking', icon: 'restaurant-outline' as const },
  { id: 'travel', label: 'Travel', icon: 'airplane-outline' as const },
  { id: 'meditation', label: 'Meditate', icon: 'flower-outline' as const },
  { id: 'family', label: 'Family', icon: 'heart-outline' as const },
];

const DRAFT_KEY = '@daiyly_draft';

type QuickEntryMode = 'free' | 'gratitude' | 'oneline' | 'reflect' | 'bullet' | 'voice';

const QUICK_ENTRY_MODES: {
  id: QuickEntryMode;
  label: string;
  emoji: string;
  color: string;
  bgClass: string;
  selectedBgClass: string;
  selectedTextClass: string;
  scaffold: string | null;
}[] = [
  {
    id: 'free',
    label: 'Standard',
    emoji: '\u2736',
    color: '#64748B',
    bgClass: 'bg-slate-100 dark:bg-slate-800',
    selectedBgClass: 'bg-slate-200 dark:bg-slate-700',
    selectedTextClass: 'text-slate-700 dark:text-slate-200',
    scaffold: null,
  },
  {
    id: 'oneline',
    label: 'Quick',
    emoji: '\u26A1',
    color: '#2563EB',
    bgClass: 'bg-blue-50 dark:bg-blue-900/30',
    selectedBgClass: 'bg-blue-100 dark:bg-blue-800/50',
    selectedTextClass: 'text-blue-800 dark:text-blue-300',
    scaffold: '',
  },
  {
    id: 'gratitude',
    label: 'Gratitude',
    emoji: '\u{1F64F}',
    color: '#D97706',
    bgClass: 'bg-amber-50 dark:bg-amber-900/30',
    selectedBgClass: 'bg-amber-100 dark:bg-amber-800/50',
    selectedTextClass: 'text-amber-800 dark:text-amber-300',
    scaffold: null, // handled specially via GratitudeInputs
  },
  {
    id: 'bullet',
    label: 'Bullets',
    emoji: '\u{1F4CB}',
    color: '#10B981',
    bgClass: 'bg-emerald-50 dark:bg-emerald-900/30',
    selectedBgClass: 'bg-emerald-100 dark:bg-emerald-800/50',
    selectedTextClass: 'text-emerald-800 dark:text-emerald-300',
    scaffold: null, // handled specially via BulletInputs
  },
  {
    id: 'voice',
    label: 'Voice',
    emoji: '\u{1F399}\u{FE0F}',
    color: '#EF4444',
    bgClass: 'bg-red-50 dark:bg-red-900/30',
    selectedBgClass: 'bg-red-100 dark:bg-red-800/50',
    selectedTextClass: 'text-red-800 dark:text-red-300',
    scaffold: null,
  },
  {
    id: 'reflect',
    label: 'Reflect',
    emoji: '\u{1F4AD}',
    color: '#7C3AED',
    bgClass: 'bg-violet-50 dark:bg-violet-900/30',
    selectedBgClass: 'bg-violet-100 dark:bg-violet-800/50',
    selectedTextClass: 'text-violet-800 dark:text-violet-300',
    scaffold:
      "Today's highlight: \n\nSomething I want to remember: \n\nHow I'm feeling: ",
  },
];

const ENCOURAGING_PROMPTS = [
  'Every entry matters, no matter how short.',
  'You\u2019re building a habit that future you will thank you for.',
  'No judgment here. Just write.',
];

interface DraftData {
  selectedMood: string | null;
  moodScore: number;
  title: string;
  content: string;
  cardColor: string;
  selectedTags: string[];
  photoUri: string | null;
  audioUri: string | null;
  savedAt: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function NewEntryScreen() {
  const { t } = useTranslation();
  const { isAuthenticated, isGuest } = useAuth();
  const { isDark } = useTheme();
  const params = useLocalSearchParams<{ quickMood?: string }>();

  const [selectedMood, setSelectedMood] = useState<string | null>(
    params.quickMood || null
  );
  const [moodScore, setMoodScore] = useState<number>(60);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [aiEmotion, setAiEmotion] = useState<EmotionAIResult | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  // Default must be in the CARD_COLORS allowlist (must match backend daiyly/models.go CardColors).
  // '#6366F1' is NOT in the allowlist and would cause a 400 on save.
  const [cardColor, setCardColor] = useState(CARD_COLORS[1]); // '#dbeafe' — blue pastel
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  // Cognitive Reframe state
  const [showReframe, setShowReframe] = useState(false);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);
  const [reframeText, setReframeText] = useState('');
  const [reframeSaving, setReframeSaving] = useState(false);
  const [reframeSaved, setReframeSaved] = useState(false);
  const draftTimerRef = useRef<NodeJS.Timeout | null>(null);
  const draftRestoredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentInputRef = useRef<TextInput>(null);

  // Quick entry mode (must be declared before toggleDisplayMode)
  const [quickMode, setQuickMode] = useState<QuickEntryMode>('free');

  // Top-level Quick/Full display mode (persisted)
  const [isQuickDisplayMode, setIsQuickDisplayMode] = useState(false);

  // Load persisted display mode preference
  useEffect(() => {
    AsyncStorage.getItem('@daiyly_entry_mode').then((val) => {
      if (val === 'quick') {
        setIsQuickDisplayMode(true);
        setQuickMode('oneline');
      }
    }).catch(() => {});
  }, []);

  const toggleDisplayMode = useCallback((toQuick: boolean) => {
    hapticSelection();
    setIsQuickDisplayMode(toQuick);
    AsyncStorage.setItem('@daiyly_entry_mode', toQuick ? 'quick' : 'full').catch(() => {});
    if (toQuick) {
      setQuickMode('oneline');
    } else {
      setQuickMode('free');
    }
  }, []);

  // Gratitude mode fields
  const [gratitudeLine1, setGratitudeLine1] = useState('');
  const [gratitudeLine2, setGratitudeLine2] = useState('');
  const [gratitudeLine3, setGratitudeLine3] = useState('');

  // Bullet mode items
  const [bulletItems, setBulletItems] = useState<string[]>(['', '', '']);

  // Rotating encouraging subtitle (random on mount)
  const encouragingPrompt = useMemo(
    () => ENCOURAGING_PROMPTS[Math.floor(Math.random() * ENCOURAGING_PROMPTS.length)],
    []
  );

  // Photo state
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFullscreen, setPhotoFullscreen] = useState(false);

  // Voice state
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [transcriptText, setTranscriptText] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [amplitudeHistory, setAmplitudeHistory] = useState<number[]>(Array(30).fill(0.1));
  const [recordedAmplitudes, setRecordedAmplitudes] = useState<number[]>([]);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meteringTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // HealthKit insight toast
  const [healthInsight, setHealthInsight] = useState<string | null>(null);

  // Restore draft on mount
  useEffect(() => {
    if (params.quickMood) return;
    AsyncStorage.getItem(DRAFT_KEY).then((raw) => {
      if (!raw) return;
      try {
        const draft: DraftData = JSON.parse(raw);
        if (draft.content || draft.title || draft.selectedMood) {
          setSelectedMood(draft.selectedMood);
          setMoodScore(draft.moodScore);
          setTitle(draft.title);
          setContent(draft.content);
          setCardColor(draft.cardColor);
          setSelectedTags(draft.selectedTags || []);
          if (draft.photoUri) setPhotoUri(draft.photoUri);
          if (draft.audioUri) setAudioUri(draft.audioUri);
          setDraftRestored(true);
          draftRestoredTimerRef.current = setTimeout(() => setDraftRestored(false), 3000);
        }
      } catch {}
    }).catch(() => {});
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (meteringTimerRef.current) clearInterval(meteringTimerRef.current);
      if (draftRestoredTimerRef.current) clearTimeout(draftRestoredTimerRef.current);
    };
  }, []);

  // Debounced draft save
  const saveDraft = useCallback(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      const draft: DraftData = {
        selectedMood, moodScore, title, content, cardColor, selectedTags,
        photoUri, audioUri,
        savedAt: new Date().toISOString(),
      };
      AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft)).catch(() => {});
    }, 1000);
  }, [selectedMood, moodScore, title, content, cardColor, selectedTags, photoUri, audioUri]);

  useEffect(() => {
    saveDraft();
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
  }, [saveDraft]);

  // Auto-set mood score from selected mood
  useEffect(() => {
    if (selectedMood) {
      const moodOption = MOOD_OPTIONS.find((m) => m.emoji === selectedMood);
      if (moodOption) {
        switch (moodOption.value) {
          case 'happy':
          case 'excited':
            setMoodScore(80);
            break;
          case 'calm':
            setMoodScore(70);
            break;
          case 'neutral':
            setMoodScore(50);
            break;
          case 'anxious':
          case 'tired':
            setMoodScore(40);
            break;
          case 'sad':
            setMoodScore(30);
            break;
          case 'angry':
            setMoodScore(20);
            break;
        }
      }
    }
  }, [selectedMood]);

  // Debounced AI emotion analysis (800ms) — silent on error, never blocks user flow
  useEffect(() => {
    if (!content || content.length < 20) {
      setAiEmotion(null);
      return;
    }
    const timer = setTimeout(async () => {
      setAiAnalyzing(true);
      const result = await analyzeTextEmotion(content);
      setAiEmotion(result);
      setAiAnalyzing(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [content]);

  const toggleTag = (tagId: string) => {
    hapticSelection();
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((t) => t !== tagId)
        : [...prev, tagId]
    );
  };

  const handleQuickMode = (mode: QuickEntryMode) => {
    hapticSelection();
    setQuickMode(mode);
    const modeData = QUICK_ENTRY_MODES.find((m) => m.id === mode);
    if (mode === 'free' || mode === 'reflect' || mode === 'oneline') {
      if (modeData && modeData.scaffold !== null) {
        setContent(modeData.scaffold);
      } else {
        setContent('');
      }
      setTimeout(() => contentInputRef.current?.focus(), 100);
    } else if (mode === 'gratitude') {
      setGratitudeLine1('');
      setGratitudeLine2('');
      setGratitudeLine3('');
    } else if (mode === 'bullet') {
      setBulletItems(['', '', '']);
    } else if (mode === 'voice') {
      // Auto-start voice recording
      setTimeout(() => startRecording(), 300);
    }
  };

  const addBulletItem = () => {
    if (bulletItems.length >= 50) return; // backend cap
    hapticLight();
    setBulletItems((prev) => [...prev, '']);
  };

  const removeBulletItem = (index: number) => {
    hapticLight();
    setBulletItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateBulletItem = (index: number, text: string) => {
    setBulletItems((prev) => prev.map((item, i) => (i === index ? text : item)));
  };

  // Compute final content from structured modes before saving
  const getFinalContent = (): string => {
    if (quickMode === 'gratitude') {
      const parts: string[] = [];
      if (gratitudeLine1.trim()) parts.push(`Grateful for: ${gratitudeLine1.trim()}`);
      if (gratitudeLine2.trim()) parts.push(`Win: ${gratitudeLine2.trim()}`);
      if (gratitudeLine3.trim()) parts.push(`Smile: ${gratitudeLine3.trim()}`);
      return parts.join('\n') || content;
    }
    if (quickMode === 'bullet') {
      const filled = bulletItems.filter((b) => b.trim());
      return filled.map((b, i) => `${i + 1}. ${b.trim()}`).join('\n') || content;
    }
    return content;
  };

  // --- Photo Picker ---
  const handlePhotoPress = () => {
    hapticLight();
    Alert.alert(t('entry.addPhoto'), t('entry.addPhoto'), [
      { text: t('entry.camera'), onPress: () => pickPhoto('camera') },
      { text: t('entry.gallery'), onPress: () => pickPhoto('gallery') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const pickPhoto = async (source: 'camera' | 'gallery') => {
    try {
      let result: ImagePicker.ImagePickerResult;

      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(t('entry.permissionRequired'), t('entry.cameraPermission'));
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          allowsEditing: true,
          aspect: [1, 1],
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(t('entry.permissionRequired'), t('entry.galleryPermission'));
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          allowsEditing: true,
          aspect: [1, 1],
        });
      }

      if (!result.canceled && result.assets.length > 0) {
        hapticSuccess();
        setPhotoUri(result.assets[0].uri);
        setPhotoUrl(null);
      }
    } catch (err) {
      Sentry.captureException(err);
      hapticError();
      Alert.alert(t('common.error'), t('entry.errorPickPhoto'));
    }
  };

  const removePhoto = () => {
    hapticLight();
    setPhotoUri(null);
    setPhotoUrl(null);
  };

  const uploadPhoto = async (uri: string): Promise<string> => {
    // Derive MIME type and extension from the URI so the backend Content-Type
    // header matches the actual file bytes and passes magic-byte validation.
    // Expo ImagePicker returns URIs ending in .heic, .jpg, .png, or .webp.
    const lower = uri.toLowerCase();
    let mimeType = 'image/jpeg';
    let fileName = 'photo.jpg';
    if (lower.endsWith('.png')) {
      mimeType = 'image/png';
      fileName = 'photo.png';
    } else if (lower.endsWith('.webp')) {
      mimeType = 'image/webp';
      fileName = 'photo.webp';
    } else if (lower.endsWith('.heic') || lower.endsWith('.heif')) {
      mimeType = 'image/heic';
      fileName = 'photo.heic';
    }

    const formData = new FormData();
    formData.append('photo', {
      uri,
      type: mimeType,
      name: fileName,
    } as any);
    const { data } = await api.post('/journals/upload-photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.url;
  };

  // --- Voice Recording ---
  const handleVoicePress = async () => {
    if (isRecording) {
      await stopRecording();
    } else if (!audioUri) {
      await startRecording();
    }
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('entry.permissionRequired'), t('entry.micPermission'));
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      const recordingOptions: Audio.RecordingOptions = {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      };
      await recording.prepareToRecordAsync(recordingOptions);
      await recording.startAsync();
      recordingRef.current = recording;

      setIsRecording(true);
      setRecordingDuration(0);
      hapticMedium();

      durationTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      // Start metering polling
      meteringTimerRef.current = setInterval(async () => {
        if (!recordingRef.current) return;
        try {
          const status = await recordingRef.current.getStatusAsync();
          if (status.isRecording && status.metering !== undefined) {
            // Map dB (-60 to 0) to amplitude (0.05 to 1.0)
            const db = status.metering; // typically -160 to 0 on iOS
            const normalized = Math.max(0.05, Math.min(1.0, (db + 60) / 60));
            setAmplitudeHistory(prev => {
              const next = [...prev.slice(1), normalized];
              return next;
            });
          }
        } catch {}
      }, 80);
    } catch (err) {
      Sentry.captureException(err);
      hapticError();
      Alert.alert(t('common.error'), t('entry.errorRecording'));
    }
  };

  const stopRecording = async () => {
    try {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }

      if (meteringTimerRef.current) {
        clearInterval(meteringTimerRef.current);
        meteringTimerRef.current = null;
      }

      if (!recordingRef.current) return;
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      setIsRecording(false);
      hapticMedium();

      if (uri) {
        setAudioUri(uri);
        // Snapshot the waveform for playback display
        setAmplitudeHistory(prev => {
          setRecordedAmplitudes(prev);
          return Array(30).fill(0.1);
        });
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch (err) {
      Sentry.captureException(err);
      hapticError();
      setIsRecording(false);
    }
  };

  const handlePlayPause = async () => {
    if (!audioUri) return;

    try {
      if (isPlaying) {
        if (soundRef.current) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
        }
      } else {
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }

        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded) {
              setPlaybackPosition(status.positionMillis / 1000);
              setPlaybackDuration(status.durationMillis ? status.durationMillis / 1000 : recordingDuration);
              if (status.didJustFinish) {
                setIsPlaying(false);
                setPlaybackPosition(0);
              }
            }
          }
        );
        soundRef.current = sound;
        setIsPlaying(true);
        hapticLight();
      }
    } catch (err) {
      Sentry.captureException(err);
      hapticError();
      Alert.alert(t('common.error'), t('entry.errorAudioPlay'));
    }
  };

  const handleTranscribe = async () => {
    if (!audioUri) return;

    try {
      setIsTranscribing(true);
      hapticLight();

      const formData = new FormData();
      formData.append('audio', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'voice.m4a',
      } as any);

      const { data } = await api.post('/journals/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const transcript: string = data.transcript || data.text || '';
      if (transcript) {
        hapticSuccess();
        setTranscriptText(transcript);
        setContent((prev) => {
          const trimmed = prev.trim();
          return trimmed ? `${transcript}\n\n${trimmed}` : transcript;
        });
      } else {
        hapticError();
        Alert.alert(t('entry.noTranscript'), t('entry.noTranscriptBody'));
      }
    } catch (err) {
      Sentry.captureException(err);
      hapticError();
      Alert.alert(t('entry.transcriptionFailed'), t('entry.transcriptionFailedBody'));
    } finally {
      setIsTranscribing(false);
    }
  };

  const removeAudio = async () => {
    hapticLight();
    if (soundRef.current) {
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setIsPlaying(false);
    setAudioUri(null);
    setTranscriptText(null);
    setRecordingDuration(0);
    setRecordedAmplitudes([]);
    setPlaybackPosition(0);
    setPlaybackDuration(0);
  };

  const handleSave = async () => {
    if (!selectedMood) {
      hapticError();
      Alert.alert(t('entry.selectMood'), t('entry.selectMoodBody'));
      return;
    }

    // Enforce 60-char hard cap for one-line mode on submit, not just via maxLength UI prop.
    if (quickMode === 'oneline' && content.length > 60) {
      hapticError();
      Alert.alert(t('entry.tooLong'), t('entry.oneLineLimit'));
      return;
    }

    setSaving(true);

    try {
      const entryDate = new Date().toISOString().split('T')[0];

      // Upload photo if present and authenticated
      let finalPhotoUrl: string | null = photoUrl;
      if (photoUri && !photoUrl && isAuthenticated) {
        try {
          finalPhotoUrl = await uploadPhoto(photoUri);
          setPhotoUrl(finalPhotoUrl);
        } catch (uploadErr) {
          Sentry.captureException(uploadErr);
          // Non-fatal: save entry without photo
          finalPhotoUrl = null;
        }
      }

      if (isAuthenticated) {
        const finalContent = getFinalContent();
        const payload: Record<string, unknown> = {
          mood_emoji: selectedMood,
          mood_score: moodScore,
          content: finalContent.trim() || title.trim() || '',
          card_color: cardColor,
          tags: selectedTags,
          entry_date: entryDate,
          entry_type: quickMode === 'free' ? 'standard' : quickMode === 'oneline' ? 'quick' : quickMode,
        };

        if (finalPhotoUrl) payload.photo_url = finalPhotoUrl;
        if (transcriptText) payload.transcript = transcriptText;

        const saveRes = await api.post('/journals', payload);
        const createdId: string = saveRes.data?.id || saveRes.data?.journal?.id || null;
        if (createdId) setSavedEntryId(createdId);
      } else {
        const canUse = await hasGuestUsesRemaining();
        if (!canUse) {
          hapticError();
          Alert.alert(
            t('entry.guestLimitTitle'),
            t('entry.guestLimitBody'),
            [
              { text: t('entry.later'), style: 'cancel' },
              {
                text: t('common.signUp'),
                onPress: () => router.push('/(auth)/register'),
              },
            ]
          );
          setSaving(false);
          return;
        }

        const finalContent = getFinalContent();
        await saveGuestEntry({
          id: `guest_${Date.now()}`,
          mood_emoji: selectedMood,
          mood_score: moodScore,
          content: finalContent.trim() || title.trim() || '',
          card_color: cardColor,
          tags: selectedTags,
          created_at: new Date().toISOString(),
          entry_date: entryDate,
        });
        await incrementGuestUses();
      }

      AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
      hapticSuccess();
      trackEntrySaved().catch(() => {});

      // Show HealthKit insight if available (iOS real device only)
      const insight = await getHealthInsight(moodScore);
      if (insight) {
        setHealthInsight(insight);
        // Auto-dismiss after 4 seconds, then navigate
        await new Promise<void>((res) => setTimeout(res, 4000));
      }

      // Cognitive Reframe: show for low-mood entries (score <= 40) for authenticated users
      if (isAuthenticated && moodScore <= 40) {
        setShowReframe(true);
        // Don't navigate back yet — user may want to add a reflection
        return;
      }

      router.back();
    } catch (err: any) {
      Sentry.captureException(err);
      hapticError();
      const message =
        err?.response?.data?.message ||
        t('entry.saveFailed');
      Alert.alert(t('common.error'), message);
    } finally {
      setSaving(false);
    }
  };

  // ─── HealthKit insight ─────────────────────────────────────────────────────

  /**
   * Reads last night's sleep and today's step count from HealthKit.
   * Returns a human-readable insight string if relevant, or null.
   * Only runs on iOS in a real build (not Expo Go).
   */
  const getHealthInsight = useCallback(
    (currentMoodScore: number): Promise<string | null> => {
      return new Promise((resolve) => {
        if (!AppleHealthKit || Platform.OS !== 'ios') {
          resolve(null);
          return;
        }
        try {
          const permissions = {
            permissions: {
              read: [
                'SleepAnalysis' as const,
                'StepCount' as const,
              ],
              write: [],
            },
          };
          AppleHealthKit.initHealthKit(permissions, (initErr: Error) => {
            if (initErr) {
              resolve(null);
              return;
            }

            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(20, 0, 0, 0);
            const now = new Date();

            const sleepOpts = {
              startDate: yesterday.toISOString(),
              endDate: now.toISOString(),
            };

            AppleHealthKit.getSleepSamples(sleepOpts, (sleepErr: Error, sleepResults: any[]) => {
              if (sleepErr || !sleepResults || sleepResults.length === 0) {
                resolve(null);
                return;
              }

              // Sum total asleep duration in hours
              let totalSleepMs = 0;
              for (const sample of sleepResults) {
                if (sample.value === 'ASLEEP' || sample.value === 'INBED') {
                  const start = new Date(sample.startDate).getTime();
                  const end = new Date(sample.endDate).getTime();
                  if (end > start) totalSleepMs += end - start;
                }
              }
              const sleepHours = +(totalSleepMs / (1000 * 60 * 60)).toFixed(1);

              // Determine insight based on sleep and mood
              const isNegativeMood = currentMoodScore <= 40;
              const isPositiveMood = currentMoodScore >= 70;

              if (sleepHours < 6 && isNegativeMood) {
                resolve(
                  t('healthKit.sleepLowMood', {
                    hours: sleepHours,
                    defaultValue: `You slept only ${sleepHours}h — low sleep often affects mood`,
                  })
                );
              } else if (sleepHours > 8 && isPositiveMood) {
                resolve(
                  t('healthKit.sleepHighMood', {
                    hours: sleepHours,
                    defaultValue: `Great sleep (${sleepHours}h) likely boosted your mood today`,
                  })
                );
              } else {
                resolve(null);
              }
            });
          });
        } catch {
          resolve(null);
        }
      });
    },
    [t]
  );

  const getMoodScoreLabel = (score: number): string => {
    if (score >= 80) return 'Great';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Okay';
    if (score >= 20) return 'Low';
    return 'Tough';
  };

  const getMoodScoreColor = (score: number): string => {
    if (score >= 80) return '#22C55E';
    if (score >= 60) return '#3B82F6';
    if (score >= 40) return '#F59E0B';
    if (score >= 20) return '#F97316';
    return '#EF4444';
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* HealthKit insight toast */}
      {healthInsight !== null && (
        <Pressable
          className="absolute top-16 left-4 right-4 z-50 bg-blue-600 rounded-2xl px-4 py-3 flex-row items-center"
          style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 8 }}
          onPress={() => setHealthInsight(null)}
        >
          <Text className="text-xl mr-3">{'🌙'}</Text>
          <Text className="text-sm text-white font-medium flex-1">{healthInsight}</Text>
          <Ionicons name="close" size={16} color="#FFFFFF" />
        </Pressable>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-3 border-b border-border">
          <Pressable
            onPress={() => {
              hapticLight();
              router.back();
            }}
            className="flex-row items-center"
          >
            <Ionicons name="chevron-back" size={24} color={isDark ? '#94A3B8' : '#374151'} />
            <Text className="text-base text-text-secondary ml-1">{t('common.back')}</Text>
          </Pressable>
          <Text className="text-lg font-semibold text-text-primary">
            {t('entry.newEntry')}
          </Text>
          {/* Quick / Full toggle */}
          <View className="flex-row bg-surface-muted rounded-lg p-0.5">
            <Pressable
              onPress={() => toggleDisplayMode(true)}
              className={`px-3 py-1 rounded-md ${isQuickDisplayMode ? 'bg-background' : ''}`}
            >
              <Text className={`text-xs font-semibold ${isQuickDisplayMode ? 'text-text-primary' : 'text-text-muted'}`}>
                {t('newEntry.modeQuick')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => toggleDisplayMode(false)}
              className={`px-3 py-1 rounded-md ${!isQuickDisplayMode ? 'bg-background' : ''}`}
            >
              <Text className={`text-xs font-semibold ${!isQuickDisplayMode ? 'text-text-primary' : 'text-text-muted'}`}>
                {t('newEntry.modeFull')}
              </Text>
            </Pressable>
          </View>
        </View>

        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* Draft Restored Indicator */}
          {draftRestored && (
            <View className="bg-blue-50 dark:bg-blue-900/30 rounded-xl px-4 py-2.5 mt-3 flex-row items-center border border-blue-100 dark:border-blue-800">
              <Ionicons name="document-outline" size={16} color="#2563EB" />
              <Text className="text-xs text-blue-700 dark:text-blue-300 ml-2 font-medium">
                {t('entry.draftRestored')}
              </Text>
            </View>
          )}

          {/* Encouraging subtitle */}
          <Text className="text-xs text-text-muted text-center mt-4 px-4">
            {encouragingPrompt}
          </Text>

          {/* Writing Prompt Card — shown when content is empty, hidden in quick display mode */}
          {!isQuickDisplayMode && content === '' && quickMode === 'free' && (
            <WritingPromptCard
              mood={selectedMood}
              onSelectPrompt={(text) => setContent(text)}
            />
          )}

          {/* Quick Entry Mode Buttons — hidden in quick display mode */}
          {!isQuickDisplayMode && (
            <View className="mt-4">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}
              >
                {QUICK_ENTRY_MODES.map((mode) => {
                  const isSelected = quickMode === mode.id;
                  return (
                    <Pressable
                      key={mode.id}
                      onPress={() => handleQuickMode(mode.id)}
                      className={`flex-row items-center rounded-full px-3.5 py-2 border ${
                        isSelected
                          ? `${mode.selectedBgClass} border-transparent`
                          : `${mode.bgClass} border-border`
                      }`}
                    >
                      <Text className="text-sm mr-1">{mode.emoji}</Text>
                      <Text
                        className={`text-xs font-semibold ${
                          isSelected ? mode.selectedTextClass : 'text-text-secondary'
                        }`}
                      >
                        {mode.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Mode hints */}
              {quickMode === 'voice' && !isRecording && !audioUri && (
                <Text className="text-xs text-red-500 dark:text-red-400 mt-2 px-1">
                  {'\u{1F399}\u{FE0F}'} {t('entry.voiceAutoStarts')}
                </Text>
              )}
              {quickMode === 'bullet' && (
                <Text className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 px-1">
                  {'\u{1F4CB}'} {t('entry.addBulletPoints')}
                </Text>
              )}
            </View>
          )}

          {/* Mood Selector */}
          <View className="mt-5">
            <Text className="text-base font-semibold text-text-primary mb-3">
              {t('entry.howAreYou')}
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 10 }}>
              {MOOD_OPTIONS.map((mood) => {
                const isSelected = selectedMood === mood.emoji;
                return (
                  <Pressable
                    key={mood.value}
                    onPress={() => {
                      hapticSelection();
                      setSelectedMood(mood.emoji);
                    }}
                    className="items-center"
                  >
                    <View
                      className={`w-16 h-16 rounded-full items-center justify-center ${
                        isSelected ? 'border-2' : 'border border-border-strong'
                      }`}
                      style={{
                        backgroundColor: isSelected
                          ? `${mood.color}15`
                          : isDark ? '#1E293B' : '#F9FAFB',
                        borderColor: isSelected ? mood.color : isDark ? '#475569' : '#E5E7EB',
                      }}
                    >
                      <Text className="text-2xl">{mood.emoji}</Text>
                    </View>
                    <Text
                      className={`text-xs mt-1 ${
                        isSelected ? 'font-semibold' : 'text-text-secondary'
                      }`}
                      style={isSelected ? { color: mood.color } : undefined}
                    >
                      {mood.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Quick Display Mode: single-sentence input */}
          {isQuickDisplayMode && (
            <View className="mt-4">
              <TextInput
                ref={contentInputRef}
                className="bg-input-bg rounded-xl p-4 text-lg text-text-primary"
                placeholder={t('entry.quickPlaceholder')}
                placeholderTextColor={isDark ? '#64748B' : '#9CA3AF'}
                value={content}
                onChangeText={(text) => setContent(text.length <= 60 ? text : text.substring(0, 60))}
                maxLength={60}
              />
              <Text className="text-xs text-text-muted mt-1.5 text-right px-1">
                {content.length}/60
              </Text>
            </View>
          )}

          {/* Mood Score — hidden in quick display mode */}
          {!isQuickDisplayMode && (
          <View className="mt-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-semibold text-text-primary">
                {t('entry.rateYourDay')}
              </Text>
              <View
                className="rounded-full px-3 py-1"
                style={{
                  backgroundColor: `${getMoodScoreColor(moodScore)}15`,
                }}
              >
                <Text
                  className="text-sm font-bold"
                  style={{ color: getMoodScoreColor(moodScore) }}
                >
                  {moodScore} - {getMoodScoreLabel(moodScore)}
                </Text>
              </View>
            </View>
            <View className="flex-row" style={{ gap: 8 }}>
              {MOOD_SCORES.map((score) => {
                const isSelected = moodScore === score;
                return (
                  <Pressable
                    key={score}
                    className="flex-1"
                    onPress={() => {
                      hapticLight();
                      setMoodScore(score);
                    }}
                  >
                    <View
                      className={`py-3 rounded-xl items-center ${
                        isSelected ? '' : 'bg-surface-muted'
                      }`}
                      style={
                        isSelected
                          ? { backgroundColor: getMoodScoreColor(score) }
                          : undefined
                      }
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          isSelected ? 'text-white' : 'text-text-secondary'
                        }`}
                      >
                        {score}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
          )}

          {/* Title Input — hidden in quick display mode */}
          {!isQuickDisplayMode && (
          <View className="mt-6">
            <TextInput
              className="bg-input-bg rounded-xl px-4 py-3.5 text-base text-text-primary"
              placeholder="How are you feeling? (optional)"
              placeholderTextColor={isDark ? '#64748B' : '#9CA3AF'}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
          </View>
          )}

          {/* Journal Content — mode-specific — hidden in quick display mode */}
          {!isQuickDisplayMode && (
          <View className="mt-4">
            <Text className="text-base font-semibold text-text-primary mb-2">
              Journal
            </Text>

            {/* Gratitude Mode */}
            {quickMode === 'gratitude' && (
              <View style={{ gap: 10 }}>
                <View className="bg-input-bg rounded-xl px-4 py-3">
                  <Text className="text-xs text-amber-600 dark:text-amber-400 font-semibold mb-1.5">
                    {'\u{1F64F}'} {t('entry.gratefulFor')}
                  </Text>
                  <TextInput
                    className="text-base text-text-primary"
                    placeholder="Write something you're grateful for..."
                    placeholderTextColor={isDark ? '#64748B' : '#9CA3AF'}
                    value={gratitudeLine1}
                    onChangeText={setGratitudeLine1}
                    multiline
                  />
                </View>
                <View className="bg-input-bg rounded-xl px-4 py-3">
                  <Text className="text-xs text-amber-600 dark:text-amber-400 font-semibold mb-1.5">
                    {'\u{2B50}'} {t('entry.smallWin')}
                  </Text>
                  <TextInput
                    className="text-base text-text-primary"
                    placeholder="Even a tiny win counts..."
                    placeholderTextColor={isDark ? '#64748B' : '#9CA3AF'}
                    value={gratitudeLine2}
                    onChangeText={setGratitudeLine2}
                    multiline
                  />
                </View>
                <View className="bg-input-bg rounded-xl px-4 py-3">
                  <Text className="text-xs text-amber-600 dark:text-amber-400 font-semibold mb-1.5">
                    {'\u{1F604}'} {t('entry.madeMeSmile')}
                  </Text>
                  <TextInput
                    className="text-base text-text-primary"
                    placeholder="Big or small, it matters..."
                    placeholderTextColor={isDark ? '#64748B' : '#9CA3AF'}
                    value={gratitudeLine3}
                    onChangeText={setGratitudeLine3}
                    multiline
                  />
                </View>
              </View>
            )}

            {/* Bullet Mode */}
            {quickMode === 'bullet' && (
              <View>
                {bulletItems.map((item, index) => (
                  <View key={index} className="flex-row items-center mb-2">
                    <View className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 items-center justify-center mr-2 mt-1">
                      <Text className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        {index + 1}
                      </Text>
                    </View>
                    <TextInput
                      className="flex-1 bg-input-bg rounded-xl px-4 py-3 text-base text-text-primary"
                      placeholder={`Point ${index + 1}...`}
                      placeholderTextColor={isDark ? '#64748B' : '#9CA3AF'}
                      value={item}
                      onChangeText={(text) => updateBulletItem(index, text)}
                    />
                    {bulletItems.length > 1 && (
                      <Pressable
                        onPress={() => removeBulletItem(index)}
                        className="ml-2 p-2"
                      >
                        <Ionicons name="close-circle" size={20} color={isDark ? '#64748B' : '#9CA3AF'} />
                      </Pressable>
                    )}
                  </View>
                ))}
                <Pressable
                  onPress={addBulletItem}
                  className="flex-row items-center mt-1 py-2"
                >
                  <Ionicons name="add-circle-outline" size={20} color="#10B981" />
                  <Text className="text-sm font-medium text-emerald-600 dark:text-emerald-400 ml-1.5">
                    {t('entry.addBulletPoints')}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Quick (One Line) Mode */}
            {quickMode === 'oneline' && (
              <View>
                <TextInput
                  ref={contentInputRef}
                  className="bg-input-bg rounded-xl p-4 text-lg text-text-primary"
                  placeholder={t('entry.quickPlaceholder')}
                  placeholderTextColor={isDark ? '#64748B' : '#9CA3AF'}
                  value={content}
                  onChangeText={(text) => setContent(text.length <= 60 ? text : text.substring(0, 60))}
                  maxLength={60}
                />
                <Text className="text-xs text-text-muted mt-1.5 text-right px-1">
                  {content.length}/60
                </Text>
                <Text className="text-xs text-text-muted mt-0.5 px-1">
                  Hit save when ready
                </Text>
              </View>
            )}

            {/* Voice mode — show transcript or prompt to record */}
            {quickMode === 'voice' && (
              <View>
                {!audioUri && !isRecording && (
                  <View className="bg-input-bg rounded-xl p-6 items-center">
                    <Text className="text-3xl mb-3">{'\u{1F399}\u{FE0F}'}</Text>
                    <Text className="text-sm font-semibold text-text-primary text-center">
                      {t('entry.voiceStarting')}
                    </Text>
                    <Text className="text-xs text-text-muted text-center mt-1">
                      Tap the mic below to begin
                    </Text>
                  </View>
                )}
                {transcriptText && (
                  <TextInput
                    ref={contentInputRef}
                    multiline
                    className="bg-input-bg rounded-xl p-4 text-base text-text-primary min-h-[160px]"
                    placeholder="Your transcript will appear here..."
                    placeholderTextColor={isDark ? '#64748B' : '#9CA3AF'}
                    value={content}
                    onChangeText={setContent}
                    textAlignVertical="top"
                    style={{ lineHeight: 24 }}
                  />
                )}
              </View>
            )}

            {/* Standard / Reflect modes — normal textarea */}
            {(quickMode === 'free' || quickMode === 'reflect') && (
              <TextInput
                ref={contentInputRef}
                multiline
                className="bg-input-bg rounded-xl p-4 text-base text-text-primary min-h-[200px]"
                placeholder="What's on your mind today? Even a few words count."
                placeholderTextColor={isDark ? '#64748B' : '#9CA3AF'}
                value={content}
                onChangeText={setContent}
                textAlignVertical="top"
                style={{ lineHeight: 24 }}
                maxLength={50000}
              />
            )}

            {/* AI Emotion Chip — shown when text is long enough */}
            {(quickMode === 'free' || quickMode === 'reflect') && content.length >= 20 && (
              <View className="mt-2 flex-row items-center" style={{ minHeight: 28 }}>
                {aiAnalyzing ? (
                  <View className="flex-row items-center rounded-full px-3 py-1 bg-slate-100 dark:bg-slate-800">
                    <ActivityIndicator size="small" color="#94A3B8" style={{ marginRight: 6 }} />
                    <Text className="text-xs text-text-muted">{t('aiEmotion.analyzing')}</Text>
                  </View>
                ) : aiEmotion ? (
                  <View
                    className="flex-row items-center rounded-full px-3 py-1"
                    style={{ backgroundColor: `${getEmotionColor(aiEmotion.dominantEmotion)}33` }}
                  >
                    <Text style={{ fontSize: 13 }}>🤖</Text>
                    <Text
                      className="text-xs font-semibold ml-1 capitalize"
                      style={{ color: getEmotionColor(aiEmotion.dominantEmotion) }}
                    >
                      {t('aiEmotion.detected', {
                        emotion: aiEmotion.dominantEmotion,
                        pct: Math.round((aiEmotion.emotions.find(
                          (e) => e.type === aiEmotion.dominantEmotion
                        )?.score ?? 0) * 100),
                      })}
                    </Text>
                    <Text style={{ fontSize: 11, marginLeft: 4 }}>{getEmotionEmoji(aiEmotion.dominantEmotion)}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>
          )}

          {/* Activity Tags — hidden in quick display mode */}
          {!isQuickDisplayMode && (
          <View className="mt-6">
            <Text className="text-base font-semibold text-text-primary mb-3">
              Activities
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {ACTIVITY_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag.id);
                return (
                  <Pressable
                    key={tag.id}
                    onPress={() => toggleTag(tag.id)}
                    className={`flex-row items-center rounded-full px-3.5 py-2 border ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
                        : 'bg-surface-elevated border-border-strong'
                    }`}
                  >
                    <Ionicons
                      name={tag.icon}
                      size={16}
                      color={isSelected ? '#2563EB' : (isDark ? '#94A3B8' : '#6B7280')}
                    />
                    <Text
                      className={`text-sm ml-1.5 ${
                        isSelected
                          ? 'font-semibold text-blue-700 dark:text-blue-400'
                          : 'text-text-secondary'
                      }`}
                    >
                      {tag.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          )}

          {/* Media Toolbar: Photo + Voice — hidden in quick display mode */}
          {!isQuickDisplayMode && (
          <View className="mt-6">
            <Text className="text-base font-semibold text-text-primary mb-3">
              Media
            </Text>
            <View className="flex-row" style={{ gap: 12 }}>
              {/* Photo Button */}
              <Pressable
                onPress={handlePhotoPress}
                className="flex-1 flex-row items-center justify-center bg-surface-elevated border border-border-strong rounded-xl py-3"
                style={{ gap: 8 }}
              >
                <Ionicons
                  name="camera-outline"
                  size={20}
                  color={photoUri ? '#2563EB' : (isDark ? '#94A3B8' : '#6B7280')}
                />
                <Text
                  className={`text-sm font-medium ${photoUri ? 'text-blue-600' : 'text-text-secondary'}`}
                >
                  {photoUri ? 'Change Photo' : 'Photo'}
                </Text>
              </Pressable>

              {/* Voice Button */}
              <Pressable
                onPress={handleVoicePress}
                disabled={!!audioUri && !isRecording}
                className={`flex-1 flex-row items-center rounded-xl py-3 border ${
                  isRecording
                    ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700'
                    : 'justify-center bg-surface-elevated border-border-strong'
                }`}
                style={isRecording ? { paddingHorizontal: 0 } : { gap: 8 }}
              >
                {isRecording ? (
                  <View className="flex-1 flex-row items-center px-3" style={{ gap: 8 }}>
                    {/* Waveform bars */}
                    <View className="flex-row items-center flex-1" style={{ gap: 2, height: 32 }}>
                      {amplitudeHistory.slice(-20).map((amp, i) => (
                        <View
                          key={i}
                          className="flex-1 rounded-full bg-red-500"
                          style={{
                            height: Math.max(4, amp * 28),
                            opacity: 0.4 + (i / 20) * 0.6,
                          }}
                        />
                      ))}
                    </View>
                    {/* Timer */}
                    <View className="flex-row items-center" style={{ gap: 4 }}>
                      <View className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      <Text className="text-xs font-semibold text-red-600 dark:text-red-400 tabular-nums">
                        {formatDuration(recordingDuration)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <>
                    <Ionicons
                      name="mic-outline"
                      size={20}
                      color={
                        audioUri
                          ? (isDark ? '#94A3B8' : '#9CA3AF')
                          : (isDark ? '#94A3B8' : '#6B7280')
                      }
                    />
                    <Text
                      className={`text-sm font-medium ${
                        audioUri ? 'text-text-muted' : 'text-text-secondary'
                      }`}
                    >
                      Voice
                    </Text>
                  </>
                )}
              </Pressable>
            </View>

            {/* Photo Preview */}
            {photoUri && (
              <View className="mt-4 flex-row items-start" style={{ gap: 12 }}>
                <Pressable onPress={() => setPhotoFullscreen(true)}>
                  <Image
                    source={{ uri: photoUri }}
                    style={{ width: 100, height: 100, borderRadius: 12 }}
                    contentFit="cover"
                    placeholder="LGF5?xYk^6#M@-5c,1J5@[or[Q6."
                    transition={200}
                  />
                </Pressable>
                <View className="flex-1 justify-between self-stretch">
                  <Text className="text-xs text-text-secondary">
                    Photo attached. Tap to preview.
                  </Text>
                  <Pressable
                    onPress={removePhoto}
                    className="flex-row items-center self-start bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-1.5 border border-red-200 dark:border-red-700"
                    style={{ gap: 4 }}
                  >
                    <Ionicons name="close-circle-outline" size={14} color="#EF4444" />
                    <Text className="text-xs font-medium text-red-600 dark:text-red-400">
                      Remove
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Voice Recorder Playback */}
            {audioUri && !isRecording && (
              <View className="mt-4 bg-surface-elevated rounded-xl p-4 border border-border-strong">
                {/* Top row: play button + waveform + action buttons */}
                <View className="flex-row items-center" style={{ gap: 10 }}>
                  <Pressable
                    onPress={handlePlayPause}
                    className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 items-center justify-center"
                  >
                    <Ionicons
                      name={isPlaying ? 'pause' : 'play'}
                      size={18}
                      color="#2563EB"
                    />
                  </Pressable>

                  {/* Playback waveform */}
                  <View className="flex-1">
                    <View className="flex-row items-center flex-1" style={{ gap: 2, height: 24 }}>
                      {(recordedAmplitudes.length > 0 ? recordedAmplitudes.slice(-40) : Array(40).fill(0.15)).map((amp, i) => (
                        <View
                          key={i}
                          className={`flex-1 rounded-full ${isPlaying ? 'bg-blue-400' : 'bg-slate-300 dark:bg-slate-600'}`}
                          style={{ height: Math.max(2, amp * 20) }}
                        />
                      ))}
                    </View>
                    <View className="flex-row justify-between mt-1">
                      <Text className="text-[10px] text-text-muted tabular-nums">
                        {formatDuration(Math.floor(playbackPosition))}
                      </Text>
                      <Text className="text-[10px] text-text-muted tabular-nums">
                        {formatDuration(Math.floor(playbackDuration || recordingDuration))}
                      </Text>
                    </View>
                  </View>

                  {/* Action buttons */}
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    {!transcriptText && (
                      <Pressable
                        onPress={handleTranscribe}
                        disabled={isTranscribing}
                        className="bg-blue-50 dark:bg-blue-900/30 rounded-lg px-3 py-1.5 border border-blue-200 dark:border-blue-700 flex-row items-center"
                        style={{ gap: 4 }}
                      >
                        {isTranscribing ? (
                          <ActivityIndicator size="small" color="#2563EB" />
                        ) : (
                          <Ionicons name="text-outline" size={14} color="#2563EB" />
                        )}
                        <Text className="text-xs font-medium text-blue-700 dark:text-blue-400">
                          {isTranscribing ? 'Working...' : 'Transcribe'}
                        </Text>
                      </Pressable>
                    )}

                    <Pressable
                      onPress={removeAudio}
                      className="bg-red-50 dark:bg-red-900/30 rounded-lg p-1.5 border border-red-200 dark:border-red-700"
                    >
                      <Ionicons name="close" size={14} color="#EF4444" />
                    </Pressable>
                  </View>
                </View>

                {transcriptText && (
                  <View className="mt-3 pt-3 border-t border-border">
                    <Text className="text-xs font-semibold text-text-secondary mb-1">
                      Transcript (prepended to journal)
                    </Text>
                    <Text className="text-xs text-text-secondary leading-4" numberOfLines={3}>
                      {transcriptText}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
          )}

          {/* Card Color — hidden in quick display mode */}
          {!isQuickDisplayMode && (
          <View className="mt-6">
            <Text className="text-base font-semibold text-text-primary mb-3">
              Card Color
            </Text>
            <View className="flex-row" style={{ gap: 12 }}>
              {CARD_COLORS.map((color) => {
                const isSelected = cardColor === color;
                return (
                  <Pressable
                    key={color}
                    onPress={() => {
                      hapticLight();
                      setCardColor(color);
                    }}
                  >
                    <View
                      className={`w-10 h-10 rounded-full ${
                        isSelected
                          ? 'border-[3px] border-blue-500'
                          : 'border-2 border-border-strong'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
          )}
        </ScrollView>

        {/* Save Button (sticky bottom) */}
        <View
          className="px-5 py-4 bg-background border-t border-border"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: isDark ? 0.2 : 0.05,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Pressable
            onPress={handleSave}
            disabled={saving || !selectedMood}
            className={`rounded-2xl py-4 items-center flex-row justify-center ${
              !selectedMood ? 'bg-surface-muted' : 'bg-blue-600 active:bg-blue-700'
            }`}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle"
                  size={22}
                  color={!selectedMood ? (isDark ? '#475569' : '#9CA3AF') : '#FFFFFF'}
                />
                <Text
                  className={`text-base font-bold ml-2 ${
                    !selectedMood ? 'text-text-muted' : 'text-white'
                  }`}
                >
                  {t('entry.saveEntry')}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Cognitive Reframe Bottom Card */}
      {showReframe && (() => {
        const moodOption = MOOD_OPTIONS.find((m) => m.emoji === selectedMood);
        const moodValue = moodOption?.value ?? 'default';
        const questions = getReframeQuestions(moodValue);
        return (
          <Modal
            visible={showReframe}
            transparent
            animationType="slide"
            onRequestClose={() => { setShowReframe(false); router.back(); }}
          >
            <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
              <Pressable
                className="absolute inset-0"
                onPress={() => { setShowReframe(false); router.back(); }}
              />
              <View className="bg-background rounded-t-3xl px-5 pt-5 pb-8">
                {/* Handle bar */}
                <View className="w-10 h-1 rounded-full bg-border self-center mb-4" />

                <View className="flex-row items-center mb-1" style={{ gap: 8 }}>
                  <Text className="text-lg">{'\u{1F9E0}'}</Text>
                  <Text className="text-base font-bold text-text-primary">
                    {t('cognitiveReframe.prompt')}
                  </Text>
                </View>
                <Text className="text-xs text-text-muted mb-4">
                  Entry saved. Tap a question to reflect further.
                </Text>

                {/* Question pills */}
                <View style={{ gap: 8 }} className="mb-4">
                  {questions.map((q) => (
                    <Pressable
                      key={q}
                      onPress={() => {
                        hapticSelection();
                        setReframeText((prev) =>
                          prev ? `${prev}\n\n${q}\n` : `${q}\n`
                        );
                      }}
                      className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-xl px-4 py-3 active:opacity-70"
                    >
                      <Text className="text-sm text-blue-800 dark:text-blue-200 leading-5">
                        {q}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Reflection input */}
                <TextInput
                  className="bg-surface-elevated border border-border rounded-2xl px-4 py-3 text-sm text-text-primary mb-4"
                  placeholder={t('cognitiveReframe.addReflection')}
                  placeholderTextColor={isDark ? '#64748B' : '#9CA3AF'}
                  value={reframeText}
                  onChangeText={setReframeText}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  style={{ minHeight: 80 }}
                />

                {reframeSaved && (
                  <Text className="text-xs text-green-600 dark:text-green-400 text-center mb-2">
                    {t('cognitiveReframe.appendSuccess')}
                  </Text>
                )}

                {/* Action buttons */}
                <View className="flex-row" style={{ gap: 10 }}>
                  <Pressable
                    onPress={() => { hapticLight(); setShowReframe(false); router.back(); }}
                    className="flex-1 rounded-2xl py-3 items-center border border-border bg-surface-muted active:opacity-70"
                  >
                    <Text className="text-sm font-medium text-text-secondary">
                      {t('cognitiveReframe.noThanks')}
                    </Text>
                  </Pressable>

                  {reframeText.trim() && savedEntryId && (
                    <Pressable
                      disabled={reframeSaving}
                      onPress={async () => {
                        if (!reframeText.trim() || !savedEntryId) return;
                        hapticLight();
                        setReframeSaving(true);
                        try {
                          await api.put(`/journals/${savedEntryId}`, {
                            content: reframeText.trim(),
                          });
                          hapticSuccess();
                          setReframeSaved(true);
                          setTimeout(() => {
                            setShowReframe(false);
                            router.back();
                          }, 900);
                        } catch (err) {
                          Sentry.captureException(err);
                          hapticError();
                        } finally {
                          setReframeSaving(false);
                        }
                      }}
                      className="flex-1 rounded-2xl py-3 items-center bg-blue-600 active:bg-blue-700"
                    >
                      {reframeSaving ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text className="text-sm font-semibold text-white">
                          {t('common.save')}
                        </Text>
                      )}
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          </Modal>
        );
      })()}

      {/* Photo Fullscreen Modal */}
      {photoUri && (
        <Modal
          visible={photoFullscreen}
          transparent
          animationType="fade"
          onRequestClose={() => setPhotoFullscreen(false)}
        >
          <Pressable
            className="flex-1 items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.92)' }}
            onPress={() => setPhotoFullscreen(false)}
          >
            <Image
              source={{ uri: photoUri }}
              style={{ width: '95%', aspectRatio: 1, borderRadius: 16 }}
              contentFit="contain"
              placeholder="LGF5?xYk^6#M@-5c,1J5@[or[Q6."
              transition={200}
            />
            <Text className="text-white text-sm mt-4 opacity-60">
              {t('entry.tapToClose')}
            </Text>
          </Pressable>
        </Modal>
      )}
    </SafeAreaView>
  );
}
