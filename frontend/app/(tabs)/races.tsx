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
import { formatDistanceToNow } from 'date-fns';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function Races() {
  const { token } = useAuth();
  const router = useRouter();
  const [races, setRaces] = useState([]);
  const [filter, setFilter] = useState<'waiting' | 'active' | 'completed'>('waiting');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadRaces();
  }, [filter]);

  const loadRaces = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/races?status=${filter}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRaces(response.data);
    } catch (error) {
      console.error('Error loading races:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRaces();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting':
        return '#34C759';
      case 'active':
        return '#FF9500';
      case 'completed':
        return '#666';
      default:
        return '#666';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'Open';
      case 'active':
        return 'Racing';
      case 'completed':
        return 'Finished';
      default:
        return status;
    }
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
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'waiting' && styles.filterButtonActive]}
          onPress={() => setFilter('waiting')}
        >
          <Text style={[styles.filterText, filter === 'waiting' && styles.filterTextActive]}>
            Open
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'active' && styles.filterButtonActive]}
          onPress={() => setFilter('active')}
        >
          <Text style={[styles.filterText, filter === 'active' && styles.filterTextActive]}>
            Racing
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'completed' && styles.filterButtonActive]}
          onPress={() => setFilter('completed')}
        >
          <Text style={[styles.filterText, filter === 'completed' && styles.filterTextActive]}>
            Completed
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF3B30" />
        }
      >
        {races.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="flag-outline" size={64} color="#666" />
            <Text style={styles.emptyText}>No {filter} races</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'waiting'
                ? 'Create a race to get started'
                : 'Check back later'}
            </Text>
          </View>
        ) : (
          races.map((race: any) => (
            <TouchableOpacity
              key={race.id}
              style={styles.raceCard}
              onPress={() => router.push(`/race/${race.id}`)}
            >
              <View style={styles.raceHeader}>
                <View style={styles.raceTitleContainer}>
                  <Text style={styles.raceTitle}>{race.circuit_name}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(race.status) },
                    ]}
                  >
                    <Text style={styles.statusText}>{getStatusText(race.status)}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </View>

              <View style={styles.raceInfo}>
                <View style={styles.raceInfoRow}>
                  <Ionicons name="person-outline" size={16} color="#999" />
                  <Text style={styles.raceInfoText}>{race.creator_name}</Text>
                </View>
                <View style={styles.raceInfoRow}>
                  <Ionicons name="people-outline" size={16} color="#999" />
                  <Text style={styles.raceInfoText}>{race.participants.length} racers</Text>
                </View>
                {race.created_at && (
                  <View style={styles.raceInfoRow}>
                    <Ionicons name="time-outline" size={16} color="#999" />
                    <Text style={styles.raceInfoText}>
                      {formatDistanceToNow(new Date(race.created_at), { addSuffix: true })}
                    </Text>
                  </View>
                )}
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
  raceCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  raceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  raceTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  raceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  raceInfo: {
    gap: 8,
  },
  raceInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  raceInfoText: {
    color: '#999',
    fontSize: 13,
    marginLeft: 6,
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
