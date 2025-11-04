import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function Tracks() {
  const { token } = useAuth();
  const router = useRouter();
  const [circuits, setCircuits] = useState([]);
  const [filter, setFilter] = useState<'all' | 'public' | 'private'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadCircuits();
  }, [filter]);

  const loadCircuits = async () => {
    try {
      let url = `${API_URL}/api/circuits`;
      if (filter === 'public') {
        url += '?is_public=true';
      } else if (filter === 'private') {
        url += '?is_public=false';
      }

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCircuits(response.data);
    } catch (error) {
      console.error('Error loading circuits:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadCircuits();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF3B30" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push('/create-circuit')}
        >
          <Ionicons name="add-circle" size={24} color="#fff" />
          <Text style={styles.createButtonText}>Create Circuit</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'public' && styles.filterButtonActive]}
          onPress={() => setFilter('public')}
        >
          <Text style={[styles.filterText, filter === 'public' && styles.filterTextActive]}>
            Public
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'private' && styles.filterButtonActive]}
          onPress={() => setFilter('private')}
        >
          <Text style={[styles.filterText, filter === 'private' && styles.filterTextActive]}>
            My Tracks
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF3B30" />
        }
      >
        {circuits.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="map-outline" size={64} color="#666" />
            <Text style={styles.emptyText}>No circuits found</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'private'
                ? 'Create your first circuit'
                : 'Be the first to create a circuit'}
            </Text>
          </View>
        ) : (
          circuits.map((circuit: any) => (
            <TouchableOpacity
              key={circuit.id}
              style={styles.circuitCard}
              onPress={() => router.push(`/circuit/${circuit.id}`)}
            >
              <View style={styles.circuitHeader}>
                <View style={styles.circuitTitleContainer}>
                  <Text style={styles.circuitName}>{circuit.name}</Text>
                  {!circuit.is_public && (
                    <Ionicons name="lock-closed" size={16} color="#999" style={{ marginLeft: 8 }} />
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </View>
              <View style={styles.circuitInfo}>
                <View style={styles.circuitInfoItem}>
                  <Ionicons name="person-outline" size={16} color="#999" />
                  <Text style={styles.circuitInfoText}>{circuit.creator_name}</Text>
                </View>
                <View style={styles.circuitInfoItem}>
                  <Ionicons name="navigate-outline" size={16} color="#999" />
                  <Text style={styles.circuitInfoText}>{circuit.distance.toFixed(2)} km</Text>
                </View>
                <View style={styles.circuitInfoItem}>
                  <Ionicons name="location-outline" size={16} color="#999" />
                  <Text style={styles.circuitInfoText}>{circuit.coordinates.length} points</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1E',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    padding: 14,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#FF3B30',
  },
  filterText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#fff',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  circuitCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  circuitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  circuitTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  circuitName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  circuitInfo: {
    flexDirection: 'row',
    gap: 16,
  },
  circuitInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  circuitInfoText: {
    color: '#999',
    fontSize: 13,
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    padding: 48,
    marginTop: 32,
  },
  emptyText: {
    fontSize: 20,
    color: '#fff',
    marginTop: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
});
