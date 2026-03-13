import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Video, ResizeMode, Audio } from 'expo-av';
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

const VIDEO_SOURCES = {
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
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  
  const videoRef = useRef<Video>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const userId = auth.currentUser?.uid || '';
  const userEmail = auth.currentUser?.email || '';

  useEffect(() => {
    checkMicrophonePermission();
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const checkMicrophonePermission = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      const granted = status === 'granted';
      setMicPermissionGranted(granted);
      console.log('[Audio] Microphone permission status:', status);
    } catch (error) {
      console.log('[Audio] Error checking permissions:', error);
    }
  };

  const getVideoSource = () => {
    return VIDEO_SOURCES[avatarState];
  };

  const handleStartListening = async () => {
    console.log('[Audio] Starting listening...');
    
    if (!micPermissionGranted) {
      console.log('[Audio] Requesting microphone permission...');
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Microphone permission is needed for voice interaction.');
        setMicPermissionGranted(false);
        return;
      }
      setMicPermissionGranted(true);
    }

    setIsListening(true);
    setAvatarState('listening');
    setTranscript('');
    setAiResponse(null);
    setShowResponse(false);

    try {
      console.log('[Audio] Setting audio mode...');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      console.log('[Audio] Creating recording...');
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      recordingRef.current = recording;
      console.log('[Audio] Recording started successfully - tap stop when done');
      
    } catch (error) {
      console.log('[Audio] Recording error:', error);
      setIsListening(false);
      setAvatarState('idle');
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const handleStopListening = async () => {
    console.log('[Audio] Stopping listening...');
    
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const recording = recordingRef.current;
    
    if (!recording) {
      console.log('[Audio] No recording to stop');
      setIsListening(false);
      return;
    }

    setIsListening(false);
    setIsProcessing(true);
    setAvatarState('listening');

    try {
      console.log('[Audio] Stopping recording and creating file...');
      await recording.stopAndUnloadAsync();
      
      const uri = recording.getURI();
      console.log('[Audio] Recording URI:', uri);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      if (uri) {
        console.log('[Audio] Processing voice recording...');
        await processVoiceRecording(uri);
      } else {
        console.log('[Audio] No URI from recording');
        Alert.alert('Error', 'No audio recorded. Please try again.');
        setAvatarState('idle');
      }
    } catch (error) {
      console.log('[Audio] Error stopping recording:', error);
      Alert.alert('Error', 'Failed to process recording. Please try again.');
      setAvatarState('idle');
    } finally {
      recordingRef.current = null;
      setIsProcessing(false);
    }
  };

  const processVoiceRecording = async (audioUri: string) => {
    console.log('[Audio] processVoiceRecording called with URI:', audioUri);
    setIsProcessing(true);
    setAvatarState('listening');

    try {
      const filename = 'recording.m4a';
      const type = 'audio/m4a';

      const formData = new FormData();
      formData.append('audio', {
        uri: audioUri,
        name: filename,
        type,
      } as any);
      formData.append('userId', userId || 'anonymous');
      formData.append('userEmail', userEmail || 'anonymous@example.com');

      console.log('[Audio] Sending to backend...', { userId, userEmail });
      const apiUrl = getApiBaseUrl();
      console.log('[Audio] API URL:', apiUrl);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      try {
        const response = await fetch(`${apiUrl}/api/avatar/analyze-voice`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
          },
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        console.log('[Audio] Response status:', response.status);

        if (response.ok) {
          const data: VoiceAnalysis = await response.json();
          console.log('[Audio] Received response:', JSON.stringify(data));
          
          setTranscript(data.transcript || 'No speech detected');
          setAiResponse(data);
          setShowResponse(true);
          
          if (data.suggestions) {
            console.log('[Audio] Speaking response...');
            setAvatarState('speaking');
            
            await Speech.speak(data.suggestions, {
              language: 'en-US',
              pitch: 1.0,
              rate: 0.9,
              voice: '147342',
              onDone: () => {
                console.log('[Audio] Speech completed');
                setAvatarState('idle');
              },
              onError: (error) => {
                console.log('[Audio] Speech error:', error);
                setAvatarState('idle');
              },
            });
          } else {
            setAvatarState('idle');
          }
        } else {
          console.log('[Audio] Server error:', response.status);
          const errorText = await response.text();
          console.log('[Audio] Server error response:', errorText);
          Alert.alert('Error', 'Failed to analyze voice. Please try again.');
          setAvatarState('idle');
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        console.log('[Audio] Fetch error:', fetchError.message || fetchError);
        if (fetchError.name === 'AbortError') {
          Alert.alert('Timeout', 'The request took too long. Please try again.');
        } else {
          Alert.alert('Error', `Failed to connect: ${fetchError.message || 'Unknown error'}`);
        }
        setAvatarState('idle');
      }
    } catch (error) {
      console.log('[Audio] Voice processing error:', error);
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

          {/* State Indicator */}
          <View style={styles.stateIndicator}>
            <Text style={styles.stateText}>
              {isProcessing ? 'Processing...' : 
               avatarState === 'listening' ? 'Listening...' : 
               avatarState === 'speaking' ? 'Speaking...' : 'Hello!'}
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
        {transcript ? (
          <View style={styles.transcriptContainer}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="microphone-message" size={20} color="#00E0C6" />
              <Text style={styles.sectionTitle}>Your Words</Text>
            </View>
            <Text style={styles.transcriptText}>{transcript}</Text>
          </View>
        ) : null}

        {/* AI Response */}
        {showResponse && aiResponse ? (
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
            {aiResponse.suggestions ? (
              <View style={styles.suggestionCard}>
                <View style={styles.suggestionHeader}>
                  <Ionicons name="bulb-outline" size={18} color="#F97316" />
                  <Text style={styles.suggestionTitle}>Suggestions</Text>
                </View>
                <Text style={styles.suggestionText}>{aiResponse.suggestions}</Text>
              </View>
            ) : null}

            {/* Early Warning */}
            {aiResponse.earlyWarning ? (
              <View style={[styles.warningCard, { borderColor: getWarningColor(aiResponse.earlyWarning) }]}>
                <View style={styles.warningHeader}>
                  <Ionicons name="warning-outline" size={18} color={getWarningColor(aiResponse.earlyWarning)} />
                  <Text style={[styles.warningTitle, { color: getWarningColor(aiResponse.earlyWarning) }]}>
                    Note
                  </Text>
                </View>
                <Text style={styles.warningText}>{aiResponse.earlyWarning}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

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
