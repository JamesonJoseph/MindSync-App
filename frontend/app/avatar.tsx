import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Speech from 'expo-speech';
import { auth } from '../firebaseConfig';
import { getApiBaseUrl } from '../utils/api';

type AvatarState = 'idle' | 'listening' | 'speaking';

interface VoiceAnalysis {
  transcript: string;
  emotion: string;
  confidence: number;
  suggestions: string;
  earlyWarning: string;
}

const videos = {
  idle: require('./assets/avatar/idle_animation.mp4'),
  listening: require('./assets/avatar/listening.mp4'),
  speaking: require('./assets/avatar/speaking.mp4'),
};

export default function AvatarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState<VoiceAnalysis | null>(null);
  const [showResponse, setShowResponse] = useState(false);
  
  const videoRef = useRef<Video>(null);
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  
  const userId = auth.currentUser?.uid || '';
  const userEmail = auth.currentUser?.email || '';

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const getVideoSource = () => {
    switch (avatarState) {
      case 'listening':
        return videos.listening;
      case 'speaking':
        return videos.speaking;
      default:
        return videos.idle;
    }
  };

  const handleStartListening = async () => {
    if (!permission?.granted) {
      Alert.alert('Permission Required', 'Microphone permission is needed for voice interaction.');
      requestPermission();
      return;
    }

    setIsListening(true);
    setAvatarState('listening');
    setTranscript('');
    setAiResponse(null);
    setShowResponse(false);

    try {
      if (cameraRef.current) {
        const recording = await cameraRef.current.recordAsync({
          maxDuration: 30,
        });

        if (recording?.uri) {
          await processVoiceRecording(recording.uri);
        }
      }
    } catch (error) {
      console.log('Recording error:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    } finally {
      setIsListening(false);
    }
  };

  const handleStopListening = async () => {
    setIsListening(false);
    if (cameraRef.current) {
      cameraRef.current.stopRecording();
    }
  };

  const processVoiceRecording = async (audioUri: string) => {
    setIsProcessing(true);
    setAvatarState('listening');

    try {
      const filename = audioUri.split('/').pop() || 'audio.m4a';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `audio/${match[1]}` : 'audio/m4a';

      const formData = new FormData();
      formData.append('audio', {
        uri: audioUri,
        name: filename,
        type,
      } as any);
      formData.append('userId', userId);
      formData.append('userEmail', userEmail);

      const apiUrl = getApiBaseUrl();
      const response = await fetch(`${apiUrl}/api/avatar/analyze-voice`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data: VoiceAnalysis = await response.json();
        setTranscript(data.transcript || 'No speech detected');
        setAiResponse(data);
        setShowResponse(true);
        
        if (data.suggestions) {
          setAvatarState('speaking');
          
          await Speech.speak(data.suggestions, {
            language: 'en-US',
            pitch: 1.0,
            rate: 0.9,
          });
          
          setAvatarState('idle');
        }
      } else {
        Alert.alert('Error', 'Failed to analyze voice. Please try again.');
        setAvatarState('idle');
      }
    } catch (error) {
      console.log('Voice processing error:', error);
      Alert.alert('Error', 'Failed to process voice. Please try again.');
      setAvatarState('idle');
    } finally {
      setIsProcessing(false);
    }
  };

  const getWarningColor = (warning: string) => {
    if (!warning) return '#22C55E';
    const lower = warning.toLowerCase();
    if (lower.includes('urgent') || lower.includes('immediate')) return '#EF4444';
    if (lower.includes('consider') || lower.includes('recommended')) return '#F97316';
    if (lower.includes('monitor') || lower.includes('watch')) return '#EAB308';
    return '#22C55E';
  };

  const getEmotionEmoji = (emotion: string) => {
    const emojis: { [key: string]: string } = {
      happy: '😊',
      sad: '😢',
      angry: '😠',
      anxious: '😰',
      frustrated: '😤',
      neutral: '😐',
      excited: '🤩',
      tired: '😴',
    };
    return emojis[emotion?.toLowerCase()] || '😐';
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Companion</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Avatar Video Container */}
        <View style={styles.avatarContainer}>
          <Video
            ref={videoRef}
            source={getVideoSource()}
            style={styles.avatarVideo}
            resizeMode={ResizeMode.COVER}
            isLooping
            shouldPlay
            isMuted={false}
          />
          
          {/* Hidden Camera for Audio Recording */}
          {isListening && permission?.granted && (
            <View style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}>
              <CameraView
                ref={cameraRef}
                style={{ flex: 1 }}
                facing="front"
                mode="video"
              />
            </View>
          )}

          {/* State Indicator */}
          <View style={styles.stateIndicator}>
            <Text style={styles.stateText}>
              {avatarState === 'listening' ? '🎧 Listening...' : 
               avatarState === 'speaking' ? '💬 Speaking...' : '👋 Hello!'}
            </Text>
          </View>
        </View>

        {/* Microphone Button */}
        <View style={styles.micContainer}>
          <TouchableOpacity
            style={[
              styles.micButton,
              isListening && styles.micButtonActive,
              isProcessing && styles.micButtonProcessing,
            ]}
            onPress={isListening ? handleStopListening : handleStartListening}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : (
              <Ionicons 
                name={isListening ? 'stop' : 'mic'} 
                size={32} 
                color="#fff" 
              />
            )}
          </TouchableOpacity>
          <Text style={styles.micHint}>
            {isListening ? 'Tap to stop' : 'Tap to speak'}
          </Text>
        </View>

        {/* Transcript Display */}
        {transcript && (
          <View style={styles.transcriptContainer}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="text-to-speech" size={20} color="#00E0C6" />
              <Text style={styles.sectionTitle}>Your Words</Text>
            </View>
            <Text style={styles.transcriptText}>{transcript}</Text>
          </View>
        )}

        {/* AI Response */}
        {showResponse && aiResponse && (
          <View style={styles.responseContainer}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="brain" size={20} color="#9D4EDD" />
              <Text style={styles.sectionTitle}>AI Analysis</Text>
            </View>

            {/* Emotion Display */}
            <View style={styles.emotionCard}>
              <Text style={styles.emotionEmoji}>{getEmotionEmoji(aiResponse.emotion)}</Text>
              <View style={styles.emotionInfo}>
                <Text style={styles.emotionLabel}>Detected Emotion</Text>
                <Text style={styles.emotionValue}>
                  {aiResponse.emotion || 'Neutral'} 
                  {aiResponse.confidence ? ` (${aiResponse.confidence}% confidence)` : ''}
                </Text>
              </View>
            </View>

            {/* Suggestions */}
            {aiResponse.suggestions && (
              <View style={styles.suggestionCard}>
                <View style={styles.suggestionHeader}>
                  <Ionicons name="bulb-outline" size={18} color="#F97316" />
                  <Text style={styles.suggestionTitle}>Suggestions</Text>
                </View>
                <Text style={styles.suggestionText}>{aiResponse.suggestions}</Text>
              </View>
            )}

            {/* Early Warning */}
            {aiResponse.earlyWarning && (
              <View style={[styles.warningCard, { borderColor: getWarningColor(aiResponse.earlyWarning) }]}>
                <View style={styles.warningHeader}>
                  <Ionicons name="warning-outline" size={18} color={getWarningColor(aiResponse.earlyWarning)} />
                  <Text style={[styles.warningTitle, { color: getWarningColor(aiResponse.earlyWarning) }]}>
                    Note
                  </Text>
                </View>
                <Text style={styles.warningText}>{aiResponse.earlyWarning}</Text>
              </View>
            )}
          </View>
        )}

        {/* Quick Access Buttons */}
        <Text style={styles.quickAccessTitle}>Quick Access</Text>
        <View style={styles.quickAccessContainer}>
          <TouchableOpacity 
            style={styles.quickAccessButton}
            onPress={() => router.push('/tasks')}
          >
            <MaterialCommunityIcons name="checkbox-marked-outline" size={24} color="#9D4EDD" />
            <Text style={styles.quickAccessText}>Tasks</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickAccessButton}
            onPress={() => router.push('/journal')}
          >
            <MaterialCommunityIcons name="book-outline" size={24} color="#00E0C6" />
            <Text style={styles.quickAccessText}>Journal</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickAccessButton}
            onPress={() => router.push('/home')}
          >
            <MaterialCommunityIcons name="account-outline" size={24} color="#F97316" />
            <Text style={styles.quickAccessText}>Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/home')}>
          <Ionicons name="home-outline" size={26} color="#888" />
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/journal')}>
          <Ionicons name="book-outline" size={26} color="#888" />
          <Text style={styles.navText}>Journal</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItemActive}>
          <MaterialCommunityIcons name="account-voice" size={26} color="#00E0C6" />
          <Text style={[styles.navText, { color: '#00E0C6' }]}>Avatar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/tasks')}>
          <Ionicons name="checkbox-outline" size={26} color="#888" />
          <Text style={styles.navText}>Tasks</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="documents-outline" size={26} color="#888" />
          <Text style={styles.navText}>Docs</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFCFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  avatarContainer: {
    width: '100%',
    height: 280,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#E0F7F4',
    position: 'relative',
  },
  avatarVideo: {
    width: '100%',
    height: '100%',
  },
  stateIndicator: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  stateText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  micContainer: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  micButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#00E0C6',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },
  micButtonActive: {
    backgroundColor: '#EF4444',
  },
  micButtonProcessing: {
    backgroundColor: '#9D4EDD',
  },
  micHint: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  transcriptContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  transcriptText: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
  },
  responseContainer: {
    marginBottom: 20,
  },
  emotionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  emotionEmoji: {
    fontSize: 40,
    marginRight: 16,
  },
  emotionInfo: {
    flex: 1,
  },
  emotionLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  emotionValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textTransform: 'capitalize',
  },
  suggestionCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F97316',
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F97316',
  },
  suggestionText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  warningCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  warningText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  quickAccessTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  quickAccessContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAccessButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  quickAccessText: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
  },
  navItemActive: {
    alignItems: 'center',
    flex: 1,
  },
  navText: {
    fontSize: 12,
    marginTop: 4,
    color: '#888',
  },
});
