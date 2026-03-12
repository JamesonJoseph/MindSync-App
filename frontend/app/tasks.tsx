import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { auth } from '../firebaseConfig';
import API_BASE_URL from '../utils/api';

type Task = {
  _id: string;
  title: string;
  description: string;
  status: 'pending' | 'completed';
};

export default function TasksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = auth.currentUser?.uid || '';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (error) {
      console.log('Error fetching tasks', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !userId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, title: newTaskTitle.trim() }),
      });
      if (res.ok) {
        const newTask = await res.json();
        setTasks([newTask, ...tasks]);
        setNewTaskTitle('');
      }
    } catch (error) {
      console.log('Error adding task', error);
    }
  };

  const toggleTaskStatus = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    // Optimistic update
    setTasks(tasks.map(t => t._id === task._id ? { ...t, status: newStatus } : t));
    
    try {
      await fetch(`${API_BASE_URL}/api/tasks/${task._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (error) {
      console.log('Error updating task', error);
      // Revert on error
      setTasks(tasks.map(t => t._id === task._id ? { ...t, status: task.status } : t));
    }
  };

  const deleteTask = async (taskId: string) => {
    setTasks(tasks.filter(t => t._id !== taskId));
    try {
      await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.log('Error deleting task', error);
      fetchTasks(); // Reload to restore deleted item
    }
  };

  const renderTask = ({ item }: { item: Task }) => {
    const isCompleted = item.status === 'completed';
    return (
      <View style={styles.taskCard}>
        <TouchableOpacity style={styles.checkbox} onPress={() => toggleTaskStatus(item)}>
          <Ionicons 
            name={isCompleted ? "checkmark-circle" : "ellipse-outline"} 
            size={28} 
            color={isCompleted ? "#00C896" : "#ccc"} 
          />
        </TouchableOpacity>
        <View style={styles.taskInfo}>
          <Text style={[styles.taskTitle, isCompleted && styles.taskTitleCompleted]}>
            {item.title}
          </Text>
        </View>
        <TouchableOpacity style={styles.deleteButton} onPress={() => deleteTask(item._id)}>
          <Ionicons name="trash-outline" size={20} color="#ff4d4f" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tasks</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#00E0C6" />
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={item => item._id}
          renderItem={renderTask}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={() => (
            <Text style={styles.emptyText}>No tasks yet. Create one below!</Text>
          )}
        />
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Add a new task..."
          placeholderTextColor="#999"
          value={newTaskTitle}
          onChangeText={setNewTaskTitle}
          onSubmitEditing={handleAddTask}
        />
        <TouchableOpacity 
          style={[styles.addButton, !newTaskTitle.trim() && { opacity: 0.5 }]} 
          onPress={handleAddTask}
          disabled={!newTaskTitle.trim()}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 20,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  checkbox: {
    marginRight: 15,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  deleteButton: {
    padding: 5,
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 40,
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#333',
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00E0C6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
});
