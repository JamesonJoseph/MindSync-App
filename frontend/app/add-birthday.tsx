import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { auth } from '../firebaseConfig';
import { getApiBaseUrl } from '../utils/api';

export default function AddBirthdayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = auth.currentUser?.uid || '';
  
  const [name, setName] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(new Date());
  const [selectedColor, setSelectedColor] = useState('#FF6B6B');
  const [notifications, setNotifications] = useState([
    { id: '1', label: 'On the day at 9 AM', enabled: true },
    { id: '2', label: '1 week before at 9 AM', enabled: true },
  ]);
  const [showAddNotification, setShowAddNotification] = useState(false);
  const [newNotificationLabel, setNewNotificationLabel] = useState('');
  const [newNotificationTime, setNewNotificationTime] = useState('9 AM');

  const notificationOptions = [
    'On the day at',
    '1 day before at',
    '2 days before at',
    '3 days before at',
    '1 week before at',
    '2 weeks before at',
    '1 month before at',
  ];

  const timeOptions = ['6 AM', '7 AM', '8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM', '8 PM'];

  const colors = ['#FF6B6B', '#00E0C6', '#FF9500', '#5856D6', '#34C759', '#007AFF'];

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const handleDateSelect = (day: number) => {
    const newDate = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth(), day);
    setSelectedDate(newDate);
    setShowDatePicker(false);
  };

  const goToPrevMonth = () => {
    setPickerMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setPickerMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter a name');
      return;
    }
    
    const birthdayData = {
      id: Date.now().toString(),
      name: name.trim(),
      date: selectedDate.toISOString().split('T')[0],
      color: selectedColor,
      notifications: notifications.filter(n => n.enabled).map(n => n.label)
    };
    
    try {
      const { authFetch } = await import('../utils/api');
      const res = await authFetch(`${getApiBaseUrl()}/api/birthdays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          ...birthdayData
        }),
      });
      
      if (res.ok) {
        router.back();
      } else {
        console.log('API not available, saving locally');
      }
    } catch (error) {
      console.log('Error saving birthday, saving to local storage', error);
    }
    
    router.back();
  };

  const toggleNotification = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, enabled: !n.enabled } : n)
    );
  };

  const addNotification = () => {
    if (newNotificationLabel && newNotificationTime) {
      const label = `${newNotificationLabel} ${newNotificationTime}`;
      setNotifications(prev => [...prev, { 
        id: Date.now().toString(), 
        label, 
        enabled: true 
      }]);
      setShowAddNotification(false);
      setNewNotificationLabel('On the day at');
      setNewNotificationTime('9 AM');
    }
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="close" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Birthday</Text>
        <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Add Name */}
        <View style={styles.section}>
          <Text style={styles.label}>Add name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter name"
            value={name}
            onChangeText={setName}
            placeholderTextColor="#999"
          />
        </View>

        {/* Category Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity style={styles.tab}>
            <Ionicons name="calendar-outline" size={20} color="#999" />
            <Text style={styles.tabText}>Event</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tab}>
            <Ionicons name="checkbox-outline" size={20} color="#999" />
            <Text style={styles.tabText}>Task</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, styles.tabActive]}>
            <Ionicons name="gift" size={20} color="#FF6B6B" />
            <Text style={[styles.tabText, styles.tabTextActive]}>Birthday</Text>
          </TouchableOpacity>
        </View>

        {/* Date Picker */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.datePicker} onPress={() => setShowDatePicker(true)}>
            <Ionicons name="calendar" size={24} color="#00E0C6" />
            <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          {notifications.map((notification) => (
            <View 
              key={notification.id} 
              style={[styles.notificationItem, !notification.enabled && styles.notificationDisabled]}
            >
              <TouchableOpacity 
                style={styles.notificationLeft}
                onPress={() => toggleNotification(notification.id)}
              >
                <Ionicons 
                  name={notification.enabled ? "notifications" : "notifications-outline"} 
                  size={20} 
                  color={notification.enabled ? "#00E0C6" : "#ccc"} 
                />
                <Text style={[styles.notificationLabel, !notification.enabled && styles.notificationLabelDisabled]}>
                  {notification.label}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeNotification(notification.id)}>
                <Ionicons name="close-circle" size={22} color="#ff4d4f" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity 
            style={styles.addNotificationButton}
            onPress={() => setShowAddNotification(true)}
          >
            <Ionicons name="add" size={20} color="#00E0C6" />
            <Text style={styles.addNotificationText}>Add notification</Text>
          </TouchableOpacity>
        </View>

        {/* Color Picker */}
        <View style={styles.section}>
          <View style={styles.colorSectionHeader}>
            <Text style={styles.sectionTitle}>Color</Text>
            <View style={[styles.colorPreview, { backgroundColor: selectedColor }]} />
          </View>
          <View style={styles.colorPicker}>
            {colors.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorOption,
                  { backgroundColor: color },
                  selectedColor === color && styles.colorOptionSelected
                ]}
                onPress={() => setSelectedColor(color)}
              />
            ))}
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Floating Add Button */}
      <TouchableOpacity 
        style={[styles.floatingAddButton, { bottom: Math.max(insets.bottom, 20) + 60 }]}
        onPress={handleSave}
      >
        <Text style={styles.floatingAddText}>⊕</Text>
      </TouchableOpacity>

      {/* Date Picker Modal */}
      <Modal visible={showDatePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.datePickerModal, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={goToPrevMonth}>
                <Ionicons name="chevron-back" size={28} color="#333" />
              </TouchableOpacity>
              <Text style={styles.monthYearText}>
                {pickerMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
              <TouchableOpacity onPress={goToNextMonth}>
                <Ionicons name="chevron-forward" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.weekdayRow}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <Text key={day} style={styles.weekdayText}>{day}</Text>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {[...Array(getFirstDayOfMonth(pickerMonth))].map((_, i) => (
                <View key={`empty-${i}`} style={styles.dayCell} />
              ))}
              {[...Array(getDaysInMonth(pickerMonth))].map((_, i) => {
                const day = i + 1;
                const isSelected = 
                  selectedDate.getDate() === day &&
                  selectedDate.getMonth() === pickerMonth.getMonth() &&
                  selectedDate.getFullYear() === pickerMonth.getFullYear();
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayCell, isSelected && styles.selectedDay]}
                    onPress={() => handleDateSelect(day)}
                  >
                    <Text style={[styles.dayText, isSelected && styles.selectedDayText]}>{day}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Notification Modal */}
      <Modal visible={showAddNotification} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.addNotificationModal, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Notification</Text>
              <TouchableOpacity onPress={() => setShowAddNotification(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>When</Text>
            <View style={styles.optionsRow}>
              {notificationOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.optionButton,
                    newNotificationLabel === option && styles.optionButtonSelected
                  ]}
                  onPress={() => setNewNotificationLabel(option)}
                >
                  <Text style={[
                    styles.optionButtonText,
                    newNotificationLabel === option && styles.optionButtonTextSelected
                  ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.modalLabel, { marginTop: 16 }]}>Time</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeScrollView}>
              <View style={styles.optionsRow}>
                {timeOptions.map((time) => (
                  <TouchableOpacity
                    key={time}
                    style={[
                      styles.timeButton,
                      newNotificationTime === time && styles.timeButtonSelected
                    ]}
                    onPress={() => setNewNotificationTime(time)}
                  >
                    <Text style={[
                      styles.timeButtonText,
                      newNotificationTime === time && styles.timeButtonTextSelected
                    ]}>
                      {time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.addButton} onPress={addNotification}>
              <Text style={styles.addButtonText}>Add Notification</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  headerButton: {
    padding: 4,
    minWidth: 50,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00E0C6',
    textAlign: 'right',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginTop: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#FFF0F0',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999',
    marginLeft: 6,
  },
  tabTextActive: {
    color: '#FF6B6B',
  },
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dateText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  notificationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationLabel: {
    fontSize: 15,
    color: '#333',
    marginLeft: 12,
  },
  addNotificationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  addNotificationText: {
    fontSize: 15,
    color: '#00E0C6',
    marginLeft: 8,
    fontWeight: '500',
  },
  colorSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  colorPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  colorPicker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: '#333',
  },
  floatingAddButton: {
    position: 'absolute',
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#00E0C6',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#00E0C6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  floatingAddText: {
    fontSize: 32,
    color: '#fff',
    marginTop: -2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  datePickerModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthYearText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekdayText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '600',
    width: 40,
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedDay: {
    backgroundColor: '#00E0C6',
    borderRadius: 20,
  },
  dayText: {
    fontSize: 16,
    color: '#333',
  },
  selectedDayText: {
    color: '#fff',
    fontWeight: '600',
  },
  notificationDisabled: {
    opacity: 0.5,
  },
  notificationLabelDisabled: {
    color: '#ccc',
    textDecorationLine: 'line-through',
  },
  addNotificationModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
    marginBottom: 8,
  },
  optionButtonSelected: {
    backgroundColor: '#00E0C6',
  },
  optionButtonText: {
    fontSize: 14,
    color: '#666',
  },
  optionButtonTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  timeScrollView: {
    marginTop: 4,
  },
  timeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
  },
  timeButtonSelected: {
    backgroundColor: '#00E0C6',
  },
  timeButtonText: {
    fontSize: 14,
    color: '#666',
  },
  timeButtonTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#00E0C6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
