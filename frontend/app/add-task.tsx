import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function AddTaskScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add New</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.subtitle}>What would you like to add?</Text>
      </View>

      {/* Bottom Section with X and Buttons */}
      <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        {/* X Button */}
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#333" />
        </TouchableOpacity>

        {/* Action Buttons */}
        <View style={styles.buttonsContainer}>
          {/* Task Button */}
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => router.back()}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="checkbox-outline" size={32} color="#00E0C6" />
            </View>
            <Text style={styles.buttonLabel}>Task</Text>
          </TouchableOpacity>

          {/* Event Button */}
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => router.back()}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="calendar-outline" size={32} color="#FF9500" />
            </View>
            <Text style={styles.buttonLabel}>Event</Text>
          </TouchableOpacity>

          {/* Birthday Button */}
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => router.push('/add-birthday')}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="gift-outline" size={32} color="#FF6B6B" />
            </View>
            <Text style={styles.buttonLabel}>Birthday</Text>
          </TouchableOpacity>
        </View>
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 40,
  },
  bottomSection: {
    backgroundColor: '#fff',
    paddingTop: 20,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    top: -25,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 20,
  },
  actionButton: {
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});
