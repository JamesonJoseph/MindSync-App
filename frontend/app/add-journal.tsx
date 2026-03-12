import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { auth } from "../firebaseConfig";
import { getApiBaseUrl } from "../utils/api";

export default function AddJournalScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams(); 
  
  const existingId = params.id as string;
  const [content, setContent] = useState((params.content as string) || "");
  const [analysis, setAnalysis] = useState((params.analysis as string) || ""); 
  
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false); 

  const today = new Date();
  const dateString = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const dayString = today.toLocaleDateString("en-US", { weekday: "long" });

  // --- AI ANALYSIS FUNCTION ---
  const handleAnalyze = async () => {
    if (!content.trim()) {
      Alert.alert("Empty Journal", "Please write your journal entry first before analyzing!");
      return;
    }

    setIsAnalyzing(true);
    try {
      const apiUrl = getApiBaseUrl();
      const response = await fetch(`${apiUrl}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setAnalysis(data.analysis); 
      } else {
        Alert.alert("Error", "Could not analyze the journal.");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Network Error", "Check your connection to the server.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- SAVE FUNCTION ---
  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert("Wait a second", "Please write something about your day first!");
      return;
    }

    // 1. Get current Firebase user
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Authentication Error", "You must be logged in to save a journal.");
      return;
    }

    setIsSaving(true);
    
    try {
      const apiUrl = getApiBaseUrl();
      const method = existingId ? "PUT" : "POST";
      const endpoint = existingId ? `${apiUrl}/api/journals/${existingId}` : `${apiUrl}/api/journals`;

      // 2. Prepare payload including email and title
      const response = await fetch(endpoint, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid, 
          userEmail: user.email, // <--- Added email here
          title: `Entry for ${dateString}`, // <--- Added title here
          content: content,
          aiAnalysis: analysis, 
        }),
      });

      if (response.ok) {
        Alert.alert("Success!", existingId ? "Journal updated!" : "Journal saved!");
        router.replace("/journal" as any); 
      } else {
        Alert.alert("Error", "Failed to save to database.");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Network Error", "Check your server connection.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />

        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled" 
        >
          <View style={styles.header}>
            <Ionicons name="calendar-outline" size={26} color="#333" />
            <View style={styles.headerDateContainer}>
              <Text style={styles.headerDate}>{dateString}</Text>
              <Text style={styles.headerDay}>{dayString}</Text>
            </View>
            <Ionicons name="person-circle-outline" size={32} color="#00E0C6" />
          </View>

          <Text style={styles.sectionTitle}>{existingId ? "Edit Journal" : "New Journal"}</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder={"How was your day? Start writing here...\nToday I felt very productive because....."}
              placeholderTextColor="#999"
              multiline
              textAlignVertical="top"
              maxLength={500}
              value={content}
              onChangeText={setContent}
            />
            <Text style={styles.charCount}>{content.length}/500</Text>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.outlineButton} onPress={() => router.back()}>
              <Text style={styles.outlineButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.solidButton} onPress={handleSave} disabled={isSaving}>
              <Text style={styles.solidButtonText}>{isSaving ? "Saving..." : "Done"}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.analyseButton, isAnalyzing && { opacity: 0.7 }]} 
            onPress={handleAnalyze}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <MaterialCommunityIcons name="magic-staff" size={20} color="#000" />
            )}
            <Text style={styles.analyseButtonText}>
              {isAnalyzing ? "Analyzing..." : "Analyse this Journal"}
            </Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>AI Insights</Text>
          
          <View style={[styles.aiInsightsCard, analysis ? {borderColor: '#00E0C6', backgroundColor: '#e8fdfa'} : null]}>
            {analysis ? (
              <Text style={styles.analysisResultText}>{analysis}</Text>
            ) : (
              <>
                <MaterialCommunityIcons name="head-cog-outline" size={32} color="#A7F3D0" />
                <Text style={styles.aiInsightsText}>
                  Your insights will appear here after you analyze your journal entry.
                </Text>
              </>
            )}
          </View>
          
          <View style={{ alignItems: "flex-end" }}>
            <TouchableOpacity style={styles.continueChatButton}>
              <Text style={styles.continueChatText}>Continue Chat</Text>
              <Ionicons name="chatbubble-ellipses" size={16} color="#000" />
            </TouchableOpacity>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFCFC" },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 25 },
  headerDateContainer: { alignItems: "center" },
  headerDate: { fontSize: 18, fontWeight: "bold", color: "#111" },
  headerDay: { fontSize: 14, color: "#777" },
  sectionTitle: { fontSize: 16, fontWeight: "bold", color: "#111", marginBottom: 10, marginTop: 15 },
  inputContainer: { borderWidth: 1.5, borderColor: "#A7F3D0", borderRadius: 16, backgroundColor: "#fff", height: 180, padding: 15 },
  textInput: { flex: 1, fontSize: 16, color: "#333" },
  charCount: { textAlign: "right", color: "#bbb", fontSize: 12, marginTop: 5 },
  actionRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 15 },
  outlineButton: { flex: 1, borderWidth: 1, borderColor: "#E0E0E0", borderRadius: 12, paddingVertical: 14, marginRight: 10, alignItems: "center", backgroundColor: "#fff" },
  outlineButtonText: { color: "#555", fontWeight: "600" },
  solidButton: { flex: 1, backgroundColor: "#00E0C6", borderRadius: 12, paddingVertical: 14, marginLeft: 10, alignItems: "center" },
  solidButtonText: { color: "#000", fontWeight: "600", fontSize: 16 },
  analyseButton: { flexDirection: "row", backgroundColor: "#34E0A1", borderRadius: 12, paddingVertical: 14, justifyContent: "center", alignItems: "center", marginTop: 15, gap: 8 },
  analyseButtonText: { color: "#000", fontWeight: "bold", fontSize: 16 },
  aiInsightsCard: { borderWidth: 1.5, borderColor: "#A7F3D0", borderRadius: 16, backgroundColor: "#fff", padding: 25, alignItems: "center", marginTop: 15 },
  aiInsightsText: { color: "#888", textAlign: "center", marginTop: 10, lineHeight: 22 },
  analysisResultText: { color: "#2d3436", fontSize: 15, lineHeight: 24, textAlign: "left" },
  continueChatButton: { flexDirection: "row", backgroundColor: "#00E0C6", borderRadius: 20, paddingVertical: 10, paddingHorizontal: 20, alignItems: "center", marginTop: 15, gap: 8 },
  continueChatText: { color: "#000", fontWeight: "bold" },
});
