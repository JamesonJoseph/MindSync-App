import { Ionicons } from '@expo/vector-icons';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
    ScrollView, 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from '../firebaseConfig'; 
import { getApiBaseUrl } from '../utils/api';

interface EmotionResult {
    emotion: string;
    confidence?: number;
    details?: string;
}

const EMOTION_EMOJI: Record<string, string> = {
    happy: '😊', sad: '😢', angry: '😠', surprise: '😲', fear: '😨', disgust: '🤢', neutral: '😐',
};

export default function EmotionScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const cameraRef = useRef<CameraView>(null);

    const [facing] = useState<CameraType>('front');
    const [permission, requestPermission] = useCameraPermissions();
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<EmotionResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    if (!permission) return <View style={styles.centered} />;
    if (!permission.granted) {
        return (
            <View style={styles.centered}>
                <Ionicons name="camera-outline" size={64} color="#8E9CCF" />
                <Text style={styles.permTitle}>Camera Access Needed</Text>
                <Pressable style={styles.grantBtn} onPress={requestPermission}>
                    <Text style={styles.grantBtnText}>Grant Permission</Text>
                </Pressable>
            </View>
        );
    }

    const handleCapture = async () => {
        if (!cameraRef.current) return;
        try {
            // Lowered quality to 0.2 to bypass mobile hotspot lag
            const photo = await cameraRef.current.takePictureAsync({ quality: 0.2 });
            if (photo) {
                setPhotoUri(photo.uri);
                uploadPhoto(photo.uri); 
            }
        } catch (err) { setError('Capture failed.'); }
    };

    const uploadPhoto = async (uri: string) => {
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const user = auth.currentUser;
            const apiUrl = getApiBaseUrl();
            const formData = new FormData();
            formData.append('image', { uri, name: 'selfie.jpg', type: 'image/jpeg' } as any);
            formData.append('userId', user?.uid || "");
            formData.append('userEmail', user?.email || "");

            const response = await fetch(`${apiUrl}/api/emotion`, {
                method: 'POST',
                body: formData,
                headers: { 'Accept': 'application/json' },
            });

            const textResponse = await response.text();
            const data = JSON.parse(textResponse);
            if (!response.ok) throw new Error(data.error);

            setResult(data);
        } catch (err: any) { setError(err.message || 'Connection failed.'); }
        finally { setLoading(false); }
    };

    if (photoUri) {
        const emoji = result ? EMOTION_EMOJI[result.emotion.toLowerCase()] || '🤔' : '';
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} hitSlop={12}>
                        <Ionicons name="arrow-back" size={26} color="white" />
                    </Pressable>
                    <Text style={styles.headerTitle}>Analysis Result</Text>
                    <View style={{ width: 26 }} />
                </View>

                <Image source={{ uri: photoUri }} style={styles.preview} />

                <View style={styles.resultArea}>
                    {loading && <ActivityIndicator size="large" color="#00C896" />}
                    {result && !loading && (
                        <View style={styles.resultCard}>
                            <Text style={styles.emoji}>{emoji}</Text>
                            <Text style={styles.emotionLabel}>{result.emotion.toUpperCase()}</Text>
                            {result.confidence && <Text style={styles.confidenceText}>{result.confidence}% confidence</Text>}
                            
                            {/* FIXED SCROLL AREA */}
                            <View style={styles.scrollWrapper}>
                                <ScrollView showsVerticalScrollIndicator={true} nestedScrollEnabled={true}>
                                    <Text style={styles.detailsText}>{result.details}</Text>
                                </ScrollView>
                            </View>
                        </View>
                    )}
                    {error && <Text style={styles.errorText}>{error}</Text>}
                </View>

                <Pressable style={styles.retakeBtn} onPress={() => { setPhotoUri(null); setResult(null); }}>
                    <Ionicons name="camera-reverse-outline" size={20} color="white" />
                    <Text style={styles.retakeBtnText}>Retake</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <View style={styles.cameraContainer}>
            <CameraView ref={cameraRef} style={styles.camera} facing={facing} />
            <View style={styles.shutterArea}>
                <Pressable onPress={handleCapture} style={styles.shutterOuter}>
                    <View style={styles.shutterInner} />
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1A1A2E' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A1A2E' },
    permTitle: { color: 'white', fontSize: 20, marginTop: 20 },
    grantBtn: { marginTop: 20, backgroundColor: '#00C896', padding: 15, borderRadius: 25 },
    grantBtnText: { color: 'white', fontWeight: 'bold' },
    cameraContainer: { flex: 1, backgroundColor: 'black' },
    camera: { flex: 1 },
    shutterArea: { position: 'absolute', bottom: 40, width: '100%', alignItems: 'center' },
    shutterOuter: { width: 70, height: 70, borderRadius: 35, borderWidth: 4, borderColor: 'white', justifyContent: 'center', alignItems: 'center' },
    shutterInner: { width: 55, height: 55, borderRadius: 27.5, backgroundColor: 'white' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
    headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    preview: { width: '100%', height: 300, resizeMode: 'cover' },
    resultArea: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    resultCard: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', padding: 25, borderRadius: 20, width: '100%', height: 320 },
    emoji: { fontSize: 50 },
    emotionLabel: { color: '#00C896', fontSize: 28, fontWeight: 'bold', marginTop: 10 },
    confidenceText: { color: '#8E9CCF', fontSize: 14, marginTop: 5 },
    scrollWrapper: { height: 110, width: '100%', marginTop: 15, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 10 },
    detailsText: { color: '#E2E8F0', fontSize: 14, textAlign: 'center', lineHeight: 22 },
    errorText: { color: '#FF6B6B', marginTop: 10 },
    retakeBtn: { flexDirection: 'row', backgroundColor: '#00C896', margin: 30, padding: 15, borderRadius: 25, justifyContent: 'center' },
    retakeBtnText: { color: 'white', marginLeft: 10, fontWeight: 'bold' }
});
