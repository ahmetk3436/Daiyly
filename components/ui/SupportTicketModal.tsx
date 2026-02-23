import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { hapticSuccess, hapticError } from '../../lib/haptics';

const OPS_URL = 'http://89.47.113.196:8095/api/webhooks/support';

interface Props {
  visible: boolean;
  onClose: () => void;
  appId: string;
  userEmail?: string;
}

export default function SupportTicketModal({ visible, onClose, appId, userEmail }: Props) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState(userEmail || '');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) {
      hapticError();
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${OPS_URL}/${appId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          description: description.trim(),
          user_email: email.trim() || 'anonymous@guest.user',
        }),
      });
      if (!res.ok) throw new Error('Failed to submit');
      hapticSuccess();
      setSent(true);
    } catch {
      hapticError();
      setError('Could not send. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSubject('');
    setDescription('');
    setEmail(userEmail || '');
    setSent(false);
    setError('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable onPress={handleClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              marginTop: 'auto',
              backgroundColor: '#0f0f1a',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: '85%',
            }}
          >
            <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
              {/* Handle bar */}
              <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' }} />
              </View>

              <View style={{ paddingHorizontal: 24, paddingBottom: 40 }}>
                {sent ? (
                  <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                    <Ionicons name="checkmark-circle" size={56} color="#22c55e" />
                    <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff', marginTop: 16 }}>Ticket Sent!</Text>
                    <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 8, textAlign: 'center' }}>
                      We'll get back to you as soon as possible.
                    </Text>
                    <Pressable onPress={handleClose} style={{ marginTop: 24 }}>
                      <LinearGradient
                        colors={['#6366f1', '#8b5cf6'] as any}
                        style={{ paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 }}
                      >
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Done</Text>
                      </LinearGradient>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 }}>Contact Support</Text>
                    <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>We typically respond within 24 hours.</Text>

                    <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Email</Text>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="your@email.com"
                      placeholderTextColor="#374151"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderRadius: 12,
                        padding: 14,
                        fontSize: 15,
                        color: '#fff',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.08)',
                        marginBottom: 14,
                      }}
                    />

                    <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Subject</Text>
                    <TextInput
                      value={subject}
                      onChangeText={setSubject}
                      placeholder="Brief description of the issue"
                      placeholderTextColor="#374151"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderRadius: 12,
                        padding: 14,
                        fontSize: 15,
                        color: '#fff',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.08)',
                        marginBottom: 14,
                      }}
                    />

                    <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Description</Text>
                    <TextInput
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Tell us more about what happened..."
                      placeholderTextColor="#374151"
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderRadius: 12,
                        padding: 14,
                        fontSize: 15,
                        color: '#fff',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.08)',
                        minHeight: 100,
                        marginBottom: 14,
                      }}
                    />

                    {error ? (
                      <Text style={{ fontSize: 13, color: '#ef4444', marginBottom: 12 }}>{error}</Text>
                    ) : null}

                    <Pressable onPress={handleSubmit} disabled={loading} style={{ marginTop: 4 }}>
                      <LinearGradient
                        colors={['#6366f1', '#8b5cf6'] as any}
                        style={{
                          paddingVertical: 16,
                          borderRadius: 14,
                          alignItems: 'center',
                          opacity: loading ? 0.6 : 1,
                        }}
                      >
                        {loading ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Submit Ticket</Text>
                        )}
                      </LinearGradient>
                    </Pressable>
                  </>
                )}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
