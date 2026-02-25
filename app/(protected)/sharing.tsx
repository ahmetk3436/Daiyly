import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import api from '../../lib/api';
import { getGuestEntries } from '../../lib/guest';
import {
  hapticLight,
  hapticSuccess,
  hapticError,
  hapticSelection,
} from '../../lib/haptics';
import type { JournalEntry, JournalStreak } from '../../types/journal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 64;

// ─── Mood gradient variants with quotes ───────────────────────────────

interface GradientVariant {
  colors: readonly [string, string, ...string[]];
  quote: string;
}

const MOOD_GRADIENTS: Record<string, GradientVariant[]> = {
  happy: [
    { colors: ['#F59E0B', '#F97316', '#EAB308'], quote: '"Happiness is not by chance, but by choice." -- Jim Rohn' },
    { colors: ['#FBBF24', '#F59E0B', '#D97706'], quote: '"The purpose of our lives is to be happy." -- Dalai Lama' },
    { colors: ['#FCD34D', '#FB923C', '#F59E0B'], quote: '"Happiness depends upon ourselves." -- Aristotle' },
  ],
  calm: [
    { colors: ['#10B981', '#06B6D4', '#0D9488'], quote: '"Peace comes from within. Do not seek it without." -- Buddha' },
    { colors: ['#34D399', '#2DD4BF', '#14B8A6'], quote: '"In the midst of movement, find stillness." -- Deepak Chopra' },
    { colors: ['#6EE7B7', '#5EEAD4', '#2DD4BF'], quote: '"Calm mind brings inner strength." -- Dalai Lama' },
  ],
  sad: [
    { colors: ['#3B82F6', '#6366F1', '#4F46E5'], quote: '"Even the darkest night will end and the sun will rise." -- Victor Hugo' },
    { colors: ['#60A5FA', '#818CF8', '#6366F1'], quote: '"The wound is the place where the Light enters you." -- Rumi' },
    { colors: ['#93C5FD', '#A5B4FC', '#818CF8'], quote: '"Tears are words the heart cannot express." -- Gerard Way' },
  ],
  angry: [
    { colors: ['#EF4444', '#DC2626', '#B91C1C'], quote: '"For every minute you are angry you lose 60 seconds of peace." -- Emerson' },
    { colors: ['#F87171', '#EF4444', '#DC2626'], quote: '"Anger is an acid that damages the vessel in which it is stored." -- Mark Twain' },
    { colors: ['#FCA5A5', '#F87171', '#EF4444'], quote: '"Let go of anger. It only hurts you in the end." -- Unknown' },
  ],
  anxious: [
    { colors: ['#8B5CF6', '#7C3AED', '#6D28D9'], quote: '"You are braver than you believe." -- A.A. Milne' },
    { colors: ['#A78BFA', '#8B5CF6', '#7C3AED'], quote: '"Courage is not the absence of fear, but the triumph over it." -- Mandela' },
    { colors: ['#C4B5FD', '#A78BFA', '#8B5CF6'], quote: '"Breathe. You are enough. You have enough." -- Unknown' },
  ],
  tired: [
    { colors: ['#6B7280', '#4B5563', '#374151'], quote: '"Rest when you are weary. Refresh and renew yourself." -- Ralph Marston' },
    { colors: ['#9CA3AF', '#6B7280', '#4B5563'], quote: '"Almost everything will work again if you unplug it for a while." -- Anne Lamott' },
    { colors: ['#94A3B8', '#64748B', '#475569'], quote: '"It is okay to rest. You are not a machine." -- Unknown' },
  ],
  excited: [
    { colors: ['#EC4899', '#DB2777', '#BE185D'], quote: '"Life is either a daring adventure or nothing at all." -- Helen Keller' },
    { colors: ['#F472B6', '#EC4899', '#DB2777'], quote: '"The energy you give the world comes back to you." -- Unknown' },
    { colors: ['#FBCFE8', '#F9A8D4', '#F472B6'], quote: '"Let your enthusiasm light the way." -- Unknown' },
  ],
  neutral: [
    { colors: ['#475569', '#334155', '#1E293B'], quote: '"Be present in all things and thankful for all things." -- Maya Angelou' },
    { colors: ['#64748B', '#475569', '#334155'], quote: '"Awareness is the greatest agent for change." -- Eckhart Tolle' },
    { colors: ['#6366F1', '#4F46E5', '#4338CA'], quote: '"The present moment is the only moment available." -- Thich Nhat Hanh' },
  ],
};

// Map emoji to mood key
function emojiToMoodKey(emoji: string): string {
  const map: Record<string, string> = {
    '\u{1F60A}': 'happy',
    '\u{1F60C}': 'calm',
    '\u{1F614}': 'sad',
    '\u{1F622}': 'sad',
    '\u{1F62D}': 'sad',
    '\u{1F624}': 'angry',
    '\u{1F630}': 'anxious',
    '\u{1F634}': 'tired',
    '\u{1F973}': 'excited',
    '\u{1F970}': 'excited',
    '\u{1F610}': 'neutral',
    '\u{1F914}': 'neutral',
  };
  return map[emoji] || 'neutral';
}

function getMoodLabel(score: number): string {
  if (score <= 20) return 'Feeling Low';
  if (score <= 40) return 'A Bit Down';
  if (score <= 60) return 'Neutral';
  if (score <= 80) return 'Feeling Good';
  return 'Amazing!';
}

// ─── Card type definitions ────────────────────────────────────────────

type CardType = 'entry' | 'weekly' | 'streak';

interface MoodDistItem {
  emoji: string;
  count: number;
  percentage: number;
}

export default function SharingScreen() {
  const { isAuthenticated } = useAuth();
  const { isDark } = useTheme();
  const params = useLocalSearchParams<{
    entryId?: string;
    cardType?: CardType;
  }>();

  const cardRef = useRef<View>(null);

  const [cardType, setCardType] = useState<CardType>(params.cardType || 'entry');
  const [variantIndex, setVariantIndex] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [streak, setStreak] = useState<JournalStreak | null>(null);
  const [moodDistribution, setMoodDistribution] = useState<MoodDistItem[]>([]);
  const [avgScore, setAvgScore] = useState(0);
  const [totalEntries, setTotalEntries] = useState(0);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      if (isAuthenticated) {
        const promises: Promise<any>[] = [
          api.get('/streak').catch(() => ({ data: null })),
          api.get('/journals/insights').catch(() => ({ data: null })),
        ];

        if (params.entryId) {
          promises.push(api.get(`/journals/${params.entryId}`));
        } else {
          promises.push(
            api.get('/journals?offset=0&limit=1').then((res) => {
              const entries = res.data.entries || [];
              return { data: entries[0] || null };
            })
          );
        }

        const [streakRes, insightsRes, entryRes] = await Promise.all(promises);

        setStreak(streakRes.data);

        if (insightsRes.data?.data) {
          const ins = insightsRes.data.data;
          setMoodDistribution(ins.mood_distribution || []);
          setAvgScore(Math.round(ins.average_mood_score || 0));
          setTotalEntries(ins.total_entries || 0);
        }

        const fetchedEntry = entryRes.data?.data || entryRes.data;
        if (fetchedEntry) setEntry(fetchedEntry);
      } else {
        // Guest mode
        const guestEntries = await getGuestEntries();
        if (guestEntries.length > 0) {
          const latest = guestEntries.sort(
            (a: any, b: any) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0];
          setEntry({
            id: latest.id,
            user_id: '',
            mood_emoji: latest.mood_emoji,
            mood_score: latest.mood_score,
            content: latest.content,
            photo_url: '',
            card_color: latest.card_color,
            entry_date: latest.created_at,
            is_private: false,
            created_at: latest.created_at,
            updated_at: latest.created_at,
          });

          // Compute basic distribution
          const emojiMap: Record<string, number> = {};
          guestEntries.forEach((e: any) => {
            const em = e.mood_emoji || '\u{1F610}';
            emojiMap[em] = (emojiMap[em] || 0) + 1;
          });
          const dist = Object.entries(emojiMap)
            .map(([emoji, count]) => ({
              emoji,
              count,
              percentage: Math.round((count / guestEntries.length) * 100),
            }))
            .sort((a, b) => b.count - a.count);
          setMoodDistribution(dist);
          setTotalEntries(guestEntries.length);

          const totalScore = guestEntries.reduce(
            (sum: number, e: any) => sum + (e.mood_score || 50),
            0
          );
          setAvgScore(Math.round(totalScore / guestEntries.length));
        }
      }
    } catch (err) {
      console.error('Failed to load sharing data:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, params.entryId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Current mood key and gradient
  const moodKey = entry ? emojiToMoodKey(entry.mood_emoji) : 'neutral';
  const variants = MOOD_GRADIENTS[moodKey] || MOOD_GRADIENTS.neutral;
  const currentVariant = variants[variantIndex % variants.length];

  const handleShuffle = () => {
    hapticSelection();
    setVariantIndex((prev) => (prev + 1) % variants.length);
  };

  const handleShare = async () => {
    if (!cardRef.current) return;

    try {
      setSharing(true);
      hapticLight();

      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        width: 1080,
        height: 1920,
      });

      const fileUri = FileSystem.cacheDirectory + `daiyly-share-${Date.now()}.png`;
      await FileSystem.copyAsync({ from: uri, to: fileUri });

      await Sharing.shareAsync(fileUri, {
        mimeType: 'image/png',
        dialogTitle: 'Share your Daiyly card',
      });

      hapticSuccess();
    } catch (error) {
      console.error('Share error:', error);
      hapticError();
      Alert.alert('Share Failed', 'Could not share your card. Please try again.');
    } finally {
      setSharing(false);
    }
  };

  // ─── Card Renderers ─────────────────────────────────────────────────

  const renderEntryCard = () => {
    if (!entry) {
      return (
        <View className="items-center justify-center py-20">
          <Text className="text-4xl mb-3">{'\u{1F4DD}'}</Text>
          <Text className="text-base text-text-secondary">No entry to share</Text>
          <Text className="text-sm text-text-muted mt-1">Write your first journal entry</Text>
        </View>
      );
    }

    const snippet = entry.content
      ? entry.content.length > 120
        ? entry.content.substring(0, 120) + '...'
        : entry.content
      : '';

    const formattedDate = new Date(entry.entry_date || entry.created_at).toLocaleDateString(
      'en-US',
      { weekday: 'long', month: 'long', day: 'numeric' }
    );

    return (
      <View
        ref={cardRef}
        collapsable={false}
        style={{
          width: CARD_WIDTH,
          aspectRatio: 9 / 16,
        }}
      >
        <LinearGradient
          colors={currentVariant.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            flex: 1,
            borderRadius: 24,
            overflow: 'hidden',
          }}
        >
          {/* Decorative circles */}
          <View
            style={{
              position: 'absolute',
              width: 180,
              height: 180,
              borderRadius: 90,
              backgroundColor: 'rgba(255,255,255,0.08)',
              top: -40,
              right: -40,
            }}
          />
          <View
            style={{
              position: 'absolute',
              width: 240,
              height: 240,
              borderRadius: 120,
              backgroundColor: 'rgba(255,255,255,0.05)',
              bottom: -60,
              left: -60,
            }}
          />

          <View style={{ flex: 1, padding: 28, justifyContent: 'space-between' }}>
            {/* Header: Branding + Date */}
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="book" size={16} color="rgba(255,255,255,0.8)" />
                  <Text
                    style={{
                      color: 'rgba(255,255,255,0.9)',
                      fontSize: 13,
                      fontWeight: '800',
                      letterSpacing: 3,
                      marginLeft: 6,
                      textTransform: 'uppercase',
                    }}
                  >
                    DAIYLY
                  </Text>
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
                  {formattedDate}
                </Text>
              </View>
            </View>

            {/* Center: Emoji + Mood + Score */}
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ fontSize: 80 }}>{entry.mood_emoji}</Text>
              <View
                style={{
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  borderRadius: 20,
                  paddingHorizontal: 16,
                  paddingVertical: 6,
                  marginTop: 12,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                  {getMoodLabel(entry.mood_score)} {'\u2022'} {entry.mood_score}/100
                </Text>
              </View>

              {/* Journal snippet */}
              {snippet ? (
                <View
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderRadius: 16,
                    padding: 16,
                    marginTop: 20,
                    width: '100%',
                  }}
                >
                  <Text
                    style={{
                      color: 'rgba(255,255,255,0.9)',
                      fontSize: 14,
                      fontStyle: 'italic',
                      lineHeight: 22,
                      textAlign: 'center',
                    }}
                    numberOfLines={4}
                  >
                    "{snippet}"
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Bottom: Quote + CTA */}
            <View>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: 11,
                  fontStyle: 'italic',
                  textAlign: 'center',
                  marginBottom: 16,
                  lineHeight: 16,
                }}
                numberOfLines={2}
              >
                {currentVariant.quote}
              </Text>
              <View
                style={{
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 16,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                  Track your mood with Daiyly
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  };

  const renderWeeklyCard = () => {
    const topMoods = moodDistribution.slice(0, 5);
    const maxCount = Math.max(...topMoods.map((m) => m.count), 1);

    return (
      <View
        ref={cardRef}
        collapsable={false}
        style={{
          width: CARD_WIDTH,
          aspectRatio: 9 / 16,
        }}
      >
        <LinearGradient
          colors={currentVariant.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            flex: 1,
            borderRadius: 24,
            overflow: 'hidden',
          }}
        >
          {/* Decorative */}
          <View
            style={{
              position: 'absolute',
              width: 200,
              height: 200,
              borderRadius: 100,
              backgroundColor: 'rgba(255,255,255,0.06)',
              top: -50,
              left: -50,
            }}
          />

          <View style={{ flex: 1, padding: 28, justifyContent: 'space-between' }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="book" size={16} color="rgba(255,255,255,0.8)" />
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: 13,
                    fontWeight: '800',
                    letterSpacing: 3,
                    marginLeft: 6,
                    textTransform: 'uppercase',
                  }}
                >
                  DAIYLY
                </Text>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
                Weekly Report
              </Text>
            </View>

            {/* Title */}
            <View style={{ alignItems: 'center', marginTop: 8 }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                My Week in Moods
              </Text>
              <View
                style={{
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  borderRadius: 20,
                  paddingHorizontal: 20,
                  paddingVertical: 8,
                  marginTop: 12,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>
                  Avg: {avgScore}/100
                </Text>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 6 }}>
                {totalEntries} {totalEntries === 1 ? 'entry' : 'entries'} this week
              </Text>
            </View>

            {/* Mood Distribution Bars */}
            <View style={{ marginTop: 8 }}>
              {topMoods.length > 0 ? (
                topMoods.map((item, index) => (
                  <View
                    key={index}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginBottom: 10,
                    }}
                  >
                    <Text style={{ fontSize: 24, width: 36 }}>{item.emoji}</Text>
                    <View
                      style={{
                        flex: 1,
                        height: 28,
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        borderRadius: 14,
                        overflow: 'hidden',
                        marginHorizontal: 8,
                      }}
                    >
                      <View
                        style={{
                          height: '100%',
                          width: `${Math.max((item.count / maxCount) * 100, 10)}%`,
                          backgroundColor: 'rgba(255,255,255,0.3)',
                          borderRadius: 14,
                          justifyContent: 'center',
                          paddingRight: 8,
                          alignItems: 'flex-end',
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                          {item.count}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', width: 40, textAlign: 'right' }}>
                      {item.percentage}%
                    </Text>
                  </View>
                ))
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                    Not enough data yet
                  </Text>
                </View>
              )}
            </View>

            {/* Bottom: Quote + CTA */}
            <View>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: 11,
                  fontStyle: 'italic',
                  textAlign: 'center',
                  marginBottom: 16,
                  lineHeight: 16,
                }}
                numberOfLines={2}
              >
                {currentVariant.quote}
              </Text>
              <View
                style={{
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 16,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                  Track your mood with Daiyly
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  };

  const renderStreakCard = () => {
    const currentStreak = streak?.current_streak || 0;
    const longestStreak = streak?.longest_streak || 0;
    const total = streak?.total_entries || totalEntries || 0;

    return (
      <View
        ref={cardRef}
        collapsable={false}
        style={{
          width: CARD_WIDTH,
          aspectRatio: 9 / 16,
        }}
      >
        <LinearGradient
          colors={['#F59E0B', '#EF4444', '#EC4899'] as const}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            flex: 1,
            borderRadius: 24,
            overflow: 'hidden',
          }}
        >
          {/* Decorative */}
          <View
            style={{
              position: 'absolute',
              width: 160,
              height: 160,
              borderRadius: 80,
              backgroundColor: 'rgba(255,255,255,0.08)',
              top: -30,
              right: -30,
            }}
          />
          <View
            style={{
              position: 'absolute',
              width: 220,
              height: 220,
              borderRadius: 110,
              backgroundColor: 'rgba(255,255,255,0.05)',
              bottom: -50,
              left: -50,
            }}
          />

          <View style={{ flex: 1, padding: 28, justifyContent: 'space-between' }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="book" size={16} color="rgba(255,255,255,0.8)" />
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: 13,
                    fontWeight: '800',
                    letterSpacing: 3,
                    marginLeft: 6,
                    textTransform: 'uppercase',
                  }}
                >
                  DAIYLY
                </Text>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
                Writing Streak
              </Text>
            </View>

            {/* Center: Streak number */}
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 80 }}>{'\u{1F525}'}</Text>
              <Text
                style={{
                  color: '#fff',
                  fontSize: 72,
                  fontWeight: '900',
                  marginTop: 8,
                }}
              >
                {currentStreak}
              </Text>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: 20,
                  fontWeight: '700',
                  marginTop: 4,
                }}
              >
                Day Streak
              </Text>

              {/* Stats row */}
              <View
                style={{
                  flexDirection: 'row',
                  marginTop: 24,
                  gap: 16,
                }}
              >
                <View
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    borderRadius: 16,
                    paddingVertical: 12,
                    paddingHorizontal: 20,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' }}>
                    Best Streak
                  </Text>
                  <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 2 }}>
                    {longestStreak}
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    borderRadius: 16,
                    paddingVertical: 12,
                    paddingHorizontal: 20,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' }}>
                    Total Entries
                  </Text>
                  <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 2 }}>
                    {total}
                  </Text>
                </View>
              </View>
            </View>

            {/* Bottom: CTA */}
            <View>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: 11,
                  fontStyle: 'italic',
                  textAlign: 'center',
                  marginBottom: 16,
                  lineHeight: 16,
                }}
              >
                "The secret of getting ahead is getting started." -- Mark Twain
              </Text>
              <View
                style={{
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 16,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                  Track your mood with Daiyly
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  };

  // ─── Main Render ────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
          <Text className="text-base text-text-muted mt-4">
            Preparing your share cards...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const CARD_TABS: { type: CardType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { type: 'entry', label: 'Entry', icon: 'document-text-outline' },
    { type: 'weekly', label: 'Weekly', icon: 'bar-chart-outline' },
    { type: 'streak', label: 'Streak', icon: 'flame-outline' },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
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
          <Text className="text-base text-text-secondary ml-1">Back</Text>
        </Pressable>
        <Text className="text-lg font-semibold text-text-primary">Share</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }}
      >
        {/* Card Type Selector */}
        <View className="flex-row mt-4 mb-5 mx-6" style={{ gap: 8 }}>
          {CARD_TABS.map((tab) => {
            const isActive = cardType === tab.type;
            return (
              <Pressable
                key={tab.type}
                onPress={() => {
                  hapticSelection();
                  setCardType(tab.type);
                  setVariantIndex(0);
                }}
                className={`flex-1 flex-row items-center justify-center py-3 rounded-xl ${
                  isActive
                    ? 'bg-blue-600'
                    : 'bg-surface-muted'
                }`}
                style={
                  isActive
                    ? {
                        shadowColor: '#2563EB',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 4,
                      }
                    : undefined
                }
              >
                <Ionicons
                  name={tab.icon}
                  size={16}
                  color={isActive ? '#FFFFFF' : isDark ? '#94A3B8' : '#6B7280'}
                  style={{ marginRight: 4 }}
                />
                <Text
                  className={`text-sm font-semibold ${
                    isActive ? 'text-white' : 'text-text-secondary'
                  }`}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Card Preview */}
        <View
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.25,
            shadowRadius: 20,
            elevation: 16,
          }}
        >
          {cardType === 'entry' && renderEntryCard()}
          {cardType === 'weekly' && renderWeeklyCard()}
          {cardType === 'streak' && renderStreakCard()}
        </View>

        {/* Shuffle Button (not for streak which has fixed gradient) */}
        {cardType !== 'streak' && (
          <Pressable
            onPress={handleShuffle}
            className="flex-row items-center bg-surface-muted rounded-full px-5 py-3 mt-5 active:scale-95"
          >
            <Ionicons
              name="shuffle-outline"
              size={18}
              color={isDark ? '#94A3B8' : '#6B7280'}
            />
            <Text className="text-sm font-semibold text-text-secondary ml-2">
              Shuffle Style
            </Text>
          </Pressable>
        )}

        {/* Share Button */}
        <Pressable
          onPress={handleShare}
          disabled={sharing}
          className="mt-5 mx-8 active:scale-[0.97]"
          style={{ width: CARD_WIDTH }}
        >
          <LinearGradient
            colors={['#2563EB', '#1D4ED8'] as const}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 16,
              paddingVertical: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#2563EB',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            {sharing ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="share-outline" size={22} color="#FFFFFF" />
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 16,
                    fontWeight: '700',
                    marginLeft: 8,
                  }}
                >
                  Share Card
                </Text>
              </>
            )}
          </LinearGradient>
        </Pressable>

        {/* Save to Camera Roll hint */}
        <Text className="text-xs text-text-muted mt-3 text-center">
          Card will be shared as an image (1080x1920)
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
