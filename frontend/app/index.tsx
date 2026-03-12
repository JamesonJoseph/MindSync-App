import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  ActivityIndicator
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, Stack } from "expo-router";

// --- FIREBASE IMPORTS ---
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  onAuthStateChanged
} from "firebase/auth";
import { auth } from "../firebaseConfig";
import * as Google from "expo-auth-session/providers/google";

// =====================================================================
// 🔴 🔴 🔴 PASTE YOUR WEB CLIENT ID RIGHT HERE 🔴 🔴 🔴
// =====================================================================
const GOOGLE_CLIENT_ID = "503344530777-kt0qsq41gk9og1nn0c5oskv20fmjj30h.apps.googleusercontent.com";

export default function IndexScreen() {
  const router = useRouter();

  // --- ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS ---
  
  // Auth & Navigation States
  const [currentSection, setCurrentSection] = useState("intro1");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  // Auth Form States
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  
  // Questionnaire States
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [occupation, setOccupation] = useState("");
  const [sleep, setSleep] = useState("");
  const [activity, setActivity] = useState("");
  const [screenTime, setScreenTime] = useState("");
  
  // Google Auth
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_CLIENT_ID, 
  });

  // --- EFFECTS ---
  
  // CHECK PERSISTENT LOGIN
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("Persistent user found:", user.email);
        router.replace('/home' as any);
      } else {
        setIsCheckingAuth(false);
      }
    });
    return unsubscribe;
  }, [router]);

  // Google Sign-In Response Handler
  useEffect(() => {
    if (response?.type === "success") {
      setAuthLoading(true);
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      
      signInWithCredential(auth, credential)
        .then((userCredential) => {
          console.log("Google Sign-In Successful:", userCredential.user.email);
          router.replace('/journal' as any);
        })
        .catch((error) => {
          Alert.alert("Google Login Error", error.message);
        })
        .finally(() => {
          setAuthLoading(false);
        });
    }
  }, [response, router]);

  // --- HANDLERS ---

  // FIREBASE: SIGN UP (Email/Password)
  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert("Missing Fields", "Please enter an email and password.");
      return;
    }
    setAuthLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      console.log("Registered:", userCredential.user.email);
      router.replace('/journal' as any);
    } catch (error: any) {
      Alert.alert("Sign Up Error", error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // FIREBASE: LOGIN (Email/Password)
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Missing Fields", "Please enter an email and password.");
      return;
    }
    setAuthLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      console.log("Logged in:", userCredential.user.email);
      router.replace('/home' as any);
    } catch (error: any) {
      Alert.alert("Login Error", error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // --- RENDER HELPERS ---

  const renderChips = (options: string[], selectedValue: string, onSelect: (val: string) => void) => (
    <View style={styles.chipContainer}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[styles.chip, selectedValue === opt && styles.chipActive]}
          onPress={() => onSelect(opt)}
        >
          <Text style={[styles.chipText, selectedValue === opt && styles.chipTextActive]}>
            {opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // --- CONDITIONAL RETURNS ---

  if (isCheckingAuth) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
        <ActivityIndicator size="large" color="#00b894" />
      </View>
    );
  }

  // --- MAIN RENDER ---
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        
        {/* --- SECTION 1: Intro --- */}
        {currentSection === "intro1" && (
          <View style={styles.page}>
            <Ionicons name="sync-circle-outline" size={80} color="#00b894" />
            <Text style={styles.title}>All your daily life, in sync</Text>
            <Text style={styles.subtitle}>Journal, reminders, calendar and wellness - connected in one simple app.</Text>
            <TouchableOpacity style={styles.button} onPress={() => setCurrentSection("intro2")}>
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* --- SECTION 2: AI Insights --- */}
        {currentSection === "intro2" && (
          <View style={styles.page}>
            <Ionicons name="bulb-outline" size={80} color="#00b894" />
            <Text style={styles.title}>Understand how you feel</Text>
            <Text style={styles.subtitle}>Write a daily journal and let AI help you track emotional patterns.</Text>
            <TouchableOpacity style={styles.button} onPress={() => setCurrentSection("intro3")}>
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* --- SECTION 3: Privacy --- */}
        {currentSection === "intro3" && (
          <View style={styles.page}>
            <Ionicons name="shield-checkmark-outline" size={80} color="#00b894" />
            <Text style={styles.title}>Your data stays private</Text>
            <Text style={styles.subtitle}>Your mind is your own space. We just help you manage it. Your data is strictly protected.</Text>
            <TouchableOpacity style={styles.button} onPress={() => setCurrentSection("welcome")}>
              <Text style={styles.buttonText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* --- SECTION 4: Welcome / Auth Choice --- */}
        {currentSection === "welcome" && (
          <View style={styles.page}>
            <Text style={styles.title}>Welcome to MindSync</Text>
            <Text style={styles.subtitle}>Let's get started on your journey to mental clarity.</Text>
            
            <TouchableOpacity 
              style={[styles.button, styles.googleButton]} 
              onPress={() => promptAsync()}
              disabled={!request || authLoading}
            >
              {authLoading ? (
                 <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color="#fff" style={{marginRight: 10}} />
                  <Text style={styles.buttonText}>Sign Up with Google</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.buttonOutline} onPress={() => setCurrentSection("login")}>
              <Text style={styles.buttonOutlineText}>Login with Email</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={{marginTop: 20}} onPress={() => setCurrentSection("questionnaire")}>
              <Text style={{color: "#555"}}>Don't have an account? <Text style={{color: "#00b894", fontWeight: "bold"}}>Sign Up</Text></Text>
            </TouchableOpacity>
          </View>
        )}

        {/* --- NEW SECTION: Questionnaire --- */}
        {currentSection === "questionnaire" && (
          <ScrollView contentContainerStyle={styles.scrollPage} showsVerticalScrollIndicator={false}>
            <TouchableOpacity style={styles.backButton} onPress={() => setCurrentSection("welcome")}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>

            <Text style={styles.title}>Tell us about yourself</Text>
            <Text style={styles.subtitle}>This helps us personalize your MindSync experience and tailor your wellness journey.</Text>

            <Text style={styles.label}>Date of Birth</Text>
            <TextInput 
              style={styles.input} 
              placeholder="YYYY-MM-DD" 
              placeholderTextColor="#999" 
              value={dob}
              onChangeText={setDob}
            />

            <Text style={styles.label}>Gender</Text>
            {renderChips(["Female", "Male", "Other", "Prefer not to say"], gender, setGender)}

            <Text style={styles.label}>Occupation</Text>
            {renderChips(["Student", "Working Professional", "Self-employed", "Freelancer", "Homemaker", "Other"], occupation, setOccupation)}

            <Text style={styles.label}>Sleep Duration</Text>
            {renderChips(["< 5 hours", "5–6 hours", "6–8 hours", "> 8 hours"], sleep, setSleep)}

            <Text style={styles.label}>Physical Activity Level</Text>
            {renderChips(["Rarely", "1–2 days/week", "3–5 days/week", "Daily"], activity, setActivity)}

            <Text style={styles.label}>Screen Time</Text>
            {renderChips(["Less than 2 hours", "2–4 hours", "4–6 hours", "More than 6 hours"], screenTime, setScreenTime)}

            <TouchableOpacity style={[styles.button, {marginTop: 20}]} onPress={() => setCurrentSection("signup")}>
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
            <View style={{height: 40}} />
          </ScrollView>
        )}

        {/* --- SECTION 5: Sign Up (Final Step) --- */}
        {currentSection === "signup" && (
          <View style={styles.page}>
            <TouchableOpacity style={styles.backButton} onPress={() => setCurrentSection("questionnaire")}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>

            <Text style={styles.title}>Create Your Account</Text>
            <Text style={styles.subtitle}>You're almost there!</Text>

            <TextInput 
              style={styles.input} 
              placeholder="Full Name" 
              placeholderTextColor="#999" 
              value={name}
              onChangeText={setName}
            />
            <TextInput 
              style={styles.input} 
              placeholder="Email" 
              placeholderTextColor="#999" 
              keyboardType="email-address" 
              autoCapitalize="none" 
              value={email}
              onChangeText={setEmail}
            />
            <TextInput 
              style={styles.input} 
              placeholder="Password" 
              placeholderTextColor="#999" 
              secureTextEntry 
              value={password}
              onChangeText={setPassword}
            />
            
            <TouchableOpacity style={styles.button} onPress={handleSignUp} disabled={authLoading}>
              {authLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Account</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* --- SECTION 6: Login --- */}
        {currentSection === "login" && (
          <View style={styles.page}>
            <TouchableOpacity style={styles.backButton} onPress={() => setCurrentSection("welcome")}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Continue your journey to mindfulness</Text>
            
            <TextInput 
              style={styles.input} 
              placeholder="Email" 
              placeholderTextColor="#999" 
              keyboardType="email-address" 
              autoCapitalize="none" 
              value={email}
              onChangeText={setEmail}
            />
            <TextInput 
              style={styles.input} 
              placeholder="Password" 
              placeholderTextColor="#999" 
              secureTextEntry 
              value={password}
              onChangeText={setPassword}
            />
            
            <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={authLoading}>
              {authLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Login</Text>}
            </TouchableOpacity>
          </View>
        )}

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
  },
  page: {
    width: "100%",
    padding: 30,
    alignItems: "center",
  },
  scrollPage: {
    padding: 30,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginTop: 20,
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 40,
    lineHeight: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginTop: 15,
    marginBottom: 10,
    alignSelf: "flex-start",
  },
  button: {
    backgroundColor: "#00b894",
    width: "100%",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 15,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  googleButton: {
    backgroundColor: "#DB4437",
  },
  buttonOutline: {
    backgroundColor: "transparent",
    width: "100%",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#00b894",
    alignItems: "center",
  },
  buttonOutlineText: {
    color: "#00b894",
    fontSize: 16,
    fontWeight: "bold",
  },
  input: {
    width: "100%",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginBottom: 15,
    fontSize: 16,
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 10,
  },
  chip: {
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  chipActive: {
    backgroundColor: "#00b894",
    borderColor: "#00b894",
  },
  chipText: {
    color: "#555",
    fontSize: 14,
  },
  chipTextActive: {
    color: "#fff",
    fontWeight: "bold",
  }
});
