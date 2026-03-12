import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { auth } from '../firebaseConfig';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Extract a name from the logged-in user's email, or default to 'User'
  const userEmail = auth.currentUser?.email || '';
  const rawName = userEmail.split('@')[0] || 'User';
  const userName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {/* --- TOP BAR --- */}
        <View style={styles.topBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={styles.profileCircle}>
              <Text style={styles.profileInitial}>{userName.charAt(0)}</Text>
            </View>
            <Text style={styles.dashboardText}>Dashboard</Text>
          </View>
          <Ionicons name="notifications-outline" size={24} color="#333" />
        </View>

        {/* --- GREETING --- */}
        <View style={styles.greetingContainer}>
          <Text style={styles.greetingTitle}>Hello {userName} 👋</Text>
          <Text style={styles.greetingSubtitle}>How are you today?</Text>
        </View>

        {/* --- SELFIE CARD --- */}
        <View style={styles.selfieCard}>
          <View style={styles.selfieCardTop}>
            <MaterialCommunityIcons name="face-recognition" size={60} color="white" />
          </View>
          <View style={styles.selfieCardBottom}>
            <View style={{ flex: 1 }}>
              <Text style={styles.selfieCardTitle}>Take a selfie now</Text>
              <Text style={styles.selfieCardDesc}>
                Let AI analyze your mood & stress levels
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.selfieButton}
              onPress={() => router.push('/emotion' as any)}
            >
              <Text style={styles.selfieButtonText}>Click Here</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* --- QUICK ACCESS --- */}
        <Text style={styles.sectionTitle}>Quick Access</Text>
        <View style={styles.gridContainer}>
          
          {/* Journal Card (Wired to /journal) */}
          <TouchableOpacity 
            style={styles.gridCard} 
            onPress={() => router.push('/journal')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#E0F7F4' }]}>
              <MaterialCommunityIcons name="note-edit-outline" size={24} color="#00C896" />
            </View>
            <Text style={styles.cardTitle}>Journal</Text>
            <Text style={styles.cardSubtitle}>Daily reflection</Text>
          </TouchableOpacity>

          {/* Calendar Card */}
          <TouchableOpacity style={styles.gridCard}>
            <View style={[styles.iconBox, { backgroundColor: '#F3E8FF' }]}>
              <Ionicons name="calendar-outline" size={24} color="#9D4EDD" />
            </View>
            <Text style={styles.cardTitle}>Calendar</Text>
            <Text style={styles.cardSubtitle}>Meeting @ 10 AM</Text>
          </TouchableOpacity>

          {/* Documents Card */}
          <TouchableOpacity style={styles.gridCard}>
            <View style={[styles.iconBox, { backgroundColor: '#FFEDD5' }]}>
              <Ionicons name="document-text-outline" size={24} color="#F97316" />
            </View>
            <Text style={styles.cardTitle}>Documents</Text>
            <Text style={styles.cardSubtitle}>Dream Log & Ideas</Text>
          </TouchableOpacity>

          {/* Budget Card */}
          <TouchableOpacity style={styles.gridCard}>
            <View style={[styles.iconBox, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="wallet-outline" size={24} color="#0284C7" />
            </View>
            <Text style={styles.cardTitle}>Budget</Text>
            <Text style={styles.cardSubtitle}>It's Fine</Text>
          </TouchableOpacity>

        </View>

        {/* Spacing for bottom nav and FAB */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* --- FLOATING ROBOT BUTTON --- */}
      <TouchableOpacity style={[styles.fab, { bottom: 90 + insets.bottom }]}>
        <MaterialCommunityIcons name="robot-outline" size={28} color="#000" />
      </TouchableOpacity>

      {/* --- BOTTOM NAVIGATION --- */}
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <View style={styles.navItem}>
          <Ionicons name="home" size={26} color="#00E0C6" />
          <Text style={[styles.navText, { color: '#00E0C6', fontWeight: 'bold' }]}>Home</Text>
        </View>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/health' as any)}>
          <MaterialCommunityIcons name="head-cog-outline" size={26} color="#00E0C6" />
          <Text style={styles.navText}>Health</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/tasks' as any)}>
          <MaterialCommunityIcons name="clipboard-check-outline" size={26} color="#00E0C6" />
          <Text style={styles.navText}>Tasks</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/budget' as any)}>
          <MaterialCommunityIcons name="hand-coin-outline" size={26} color="#00E0C6" />
          <Text style={styles.navText}>Budget</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/document' as any)}>
          <Ionicons name="documents-outline" size={26} color="#00E0C6" />
          <Text style={styles.navText}>Document</Text>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 15,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  profileCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFE5B4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D97706',
  },
  dashboardText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  greetingContainer: {
    marginBottom: 25,
  },
  greetingTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111',
  },
  greetingSubtitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginTop: 4,
  },
  selfieCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 30,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  selfieCardTop: {
    height: 140,
    backgroundColor: '#A5B4FC', // Soft purple/blue matching the image
    justifyContent: 'center',
    alignItems: 'center',
  },
  selfieCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  selfieCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
  },
  selfieCardDesc: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
    paddingRight: 10,
  },
  selfieButton: {
    backgroundColor: '#00E0C6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  selfieButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 15,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#777',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    right: 20,
    backgroundColor: '#00E0C6',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
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
  navText: {
    fontSize: 12,
    marginTop: 4,
    color: '#00E0C6',
  },
});