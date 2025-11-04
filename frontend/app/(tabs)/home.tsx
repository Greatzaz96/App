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

export default function Home() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const racesResponse = await axios.get(`${API_URL}/api/races?status=waiting`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRaces(racesResponse.data.slice(0, 5));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF3B30" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF3B30" />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.name}</Text>
        </View>
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{user?.stats?.total_races || 0}</Text>
            <Text style={styles.statLabel}>Races</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{user?.stats?.wins || 0}</Text>
            <Text style={styles.statLabel}>Wins</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/create-circuit')}
          >
            <Ionicons name="add-circle" size={40} color="#FF3B30" />
            <Text style={styles.actionText}>Create Circuit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/tracks')}
          >
            <Ionicons name="map-outline" size={40} color="#FF3B30" />
            <Text style={styles.actionText}>Browse Tracks</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/races')}
          >
            <Ionicons name="flag-outline" size={40} color="#FF3B30" />
            <Text style={styles.actionText}>Join Race</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/friends')}
          >
            <Ionicons name="people-outline" size={40} color="#FF3B30" />
            <Text style={styles.actionText}>Find Friends</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Open Races</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/races')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        {races.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="flag-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>No open races</Text>
            <Text style={styles.emptySubtext}>Create a race to get started</Text>
          </View>
        ) : (
          races.map((race: any) => (
            <TouchableOpacity
              key={race.id}
              style={styles.raceCard}
              onPress={() => router.push(`/race/${race.id}`)}
            >
              <View style={styles.raceHeader}>
                <Text style={styles.raceTitle}>{race.circuit_name}</Text>
                <View style={styles.raceBadge}>
                  <Text style={styles.raceBadgeText}>Open</Text>
                </View>
              </View>
              <View style={styles.raceInfo}>
                <Ionicons name="person-outline" size={16} color="#999" />
                <Text style={styles.raceInfoText}>{race.creator_name}</Text>
                <Ionicons name="people-outline" size={16} color="#999" style={{ marginLeft: 16 }} />
                <Text style={styles.raceInfoText}>{race.participants.length} joined</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
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
    padding: 24,
    paddingTop: 16,
  },
  greeting: {
    fontSize: 16,
    color: '#999',
  },
  userName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF3B30',
  },
  statLabel: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  section: {
    padding: 24,
    paddingTop: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  seeAllText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
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
    marginBottom: 8,
  },
  raceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  raceBadge: {
    backgroundColor: '#34C759',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  raceBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  raceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  raceInfoText: {
    color: '#999',
    fontSize: 14,
    marginLeft: 6,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    color: '#fff',
    marginTop: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
});
