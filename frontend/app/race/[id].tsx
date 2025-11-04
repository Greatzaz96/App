import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MapView, { Polyline, Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';
import io from 'socket.io-client';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
const WS_URL = API_URL?.replace('/api', '');

export default function RaceDetail() {
  const { id } = useLocalSearchParams();
  const { token, user } = useAuth();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const socketRef = useRef<any>(null);
  const locationSubscription = useRef<any>(null);

  const [race, setRace] = useState<any>(null);
  const [circuit, setCircuit] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRacing, setIsRacing] = useState(false);
  const [raceStartTime, setRaceStartTime] = useState<number | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    loadRaceData();
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, [id]);

  useEffect(() => {
    if (isRacing && raceStartTime) {
      const interval = setInterval(() => {
        setCurrentTime(Date.now() - raceStartTime);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isRacing, raceStartTime]);

  const loadRaceData = async () => {
    try {
      const [raceResponse, leaderboardResponse] = await Promise.all([
        axios.get(`${API_URL}/api/races/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/api/races/${id}/leaderboard`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setRace(raceResponse.data);
      setLeaderboard(leaderboardResponse.data);

      // Load circuit
      const circuitResponse = await axios.get(
        `${API_URL}/api/circuits/${raceResponse.data.circuit_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCircuit(circuitResponse.data);

      // Connect to WebSocket if race is active
      if (raceResponse.data.status === 'active' || raceResponse.data.status === 'waiting') {
        connectWebSocket();
      }
    } catch (error) {
      console.error('Error loading race data:', error);
      Alert.alert('Error', 'Failed to load race data');
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = () => {
    if (socketRef.current) return;

    const socket = io(`${WS_URL}/ws/${user?.id}`, {
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('WebSocket connected');
      socket.emit('join_race', { race_id: id });
    });

    socket.on('race_started', (data: any) => {
      Alert.alert('Race Started!', 'The race has begun. Good luck!');
      setRace((prev: any) => ({ ...prev, status: 'active' }));
      startRacing();
    });

    socket.on('participant_position', (data: any) => {
      console.log('Position update from:', data.user_id);
      // Update leaderboard or map markers
    });

    socket.on('participant_finished', (data: any) => {
      console.log('Participant finished:', data.user_id);
      loadRaceData(); // Refresh leaderboard
    });

    socketRef.current = socket;
  };

  const joinRace = async () => {
    try {
      await axios.post(
        `${API_URL}/api/races/${id}/join`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('Success', 'You joined the race!');
      loadRaceData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to join race');
    }
  };

  const startRaceAsCreator = async () => {
    try {
      await axios.post(
        `${API_URL}/api/races/${id}/start`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to start race');
    }
  };

  const startRacing = async () => {
    // Request location permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Location permission is required to race');
      return;
    }

    setIsRacing(true);
    setRaceStartTime(Date.now());

    // Start tracking location
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 10,
      },
      (location) => {
        const speed = location.coords.speed || 0;
        setCurrentSpeed(speed * 3.6); // Convert m/s to km/h

        // Send position update via WebSocket
        if (socketRef.current) {
          socketRef.current.emit('position_update', {
            race_id: id,
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            speed: speed,
          });
        }
      }
    );
  };

  const finishRace = () => {
    Alert.alert('Finish Race', 'Are you sure you want to finish?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        onPress: () => {
          const finalTime = (Date.now() - (raceStartTime || 0)) / 1000;
          if (socketRef.current) {
            socketRef.current.emit('finish_race', {
              race_id: id,
              final_time: finalTime,
            });
          }
          setIsRacing(false);
          if (locationSubscription.current) {
            locationSubscription.current.remove();
          }
          Alert.alert('Race Complete!', `Your time: ${formatTime(finalTime)}`);
          loadRaceData();
        },
      },
    ]);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF3B30" />
      </View>
    );
  }

  if (!race || !circuit) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Race not found</Text>
      </View>
    );
  }

  const isCreator = race.creator_id === user?.id;
  const hasJoined = race.participants.includes(user?.id);
  const canStart = isCreator && race.status === 'waiting' && race.participants.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Race</Text>
        <View style={styles.headerRight}>
          {race.status === 'waiting' && (
            <View style={[styles.statusBadge, { backgroundColor: '#34C759' }]}>
              <Text style={styles.statusText}>Open</Text>
            </View>
          )}
          {race.status === 'active' && (
            <View style={[styles.statusBadge, { backgroundColor: '#FF9500' }]}>
              <Text style={styles.statusText}>Racing</Text>
            </View>
          )}
          {race.status === 'completed' && (
            <View style={[styles.statusBadge, { backgroundColor: '#666' }]}>
              <Text style={styles.statusText}>Finished</Text>
            </View>
          )}
        </View>
      </View>

      {isRacing && (
        <View style={styles.racingOverlay}>
          <View style={styles.racingStats}>
            <View style={styles.racingStat}>
              <Text style={styles.racingStatLabel}>Time</Text>
              <Text style={styles.racingStatValue}>{formatTime(currentTime / 1000)}</Text>
            </View>
            <View style={styles.racingStat}>
              <Text style={styles.racingStatLabel}>Speed</Text>
              <Text style={styles.racingStatValue}>{currentSpeed.toFixed(0)} km/h</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={styles.map}
          initialRegion={{
            latitude: circuit.coordinates[0].latitude,
            longitude: circuit.coordinates[0].longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation={true}
        >
          <Polyline coordinates={circuit.coordinates} strokeColor="#FF3B30" strokeWidth={4} />
          <Marker coordinate={circuit.coordinates[0]} pinColor="green" title="Start" />
          <Marker
            coordinate={circuit.coordinates[circuit.coordinates.length - 1]}
            pinColor="red"
            title="Finish"
          />
        </MapView>
      </View>

      <ScrollView style={styles.infoContainer}>
        <Text style={styles.circuitName}>{circuit.name}</Text>
        <Text style={styles.raceInfo}>
          {circuit.distance.toFixed(2)} km • {race.participants.length} racers
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Leaderboard</Text>
          {leaderboard.length === 0 ? (
            <Text style={styles.emptyText}>No finishers yet</Text>
          ) : (
            leaderboard.map((participant, index) => (
              <View key={participant.id} style={styles.leaderboardItem}>
                <View style={styles.leaderboardRank}>
                  <Text style={styles.leaderboardRankText}>#{index + 1}</Text>
                </View>
                <Text style={styles.leaderboardName}>{participant.user_name}</Text>
                {participant.final_time && (
                  <Text style={styles.leaderboardTime}>
                    {formatTime(participant.final_time)}
                  </Text>
                )}
                {participant.status === 'active' && (
                  <Text style={styles.leaderboardStatus}>Racing...</Text>
                )}
              </View>
            ))
          )}
        </View>

        <View style={styles.actionButtons}>
          {race.status === 'waiting' && !hasJoined && (
            <TouchableOpacity style={styles.joinButton} onPress={joinRace}>
              <Ionicons name="enter" size={20} color="#fff" />
              <Text style={styles.buttonText}>Join Race</Text>
            </TouchableOpacity>
          )}

          {canStart && (
            <TouchableOpacity style={styles.startButton} onPress={startRaceAsCreator}>
              <Ionicons name="play" size={20} color="#fff" />
              <Text style={styles.buttonText}>Start Race</Text>
            </TouchableOpacity>
          )}

          {race.status === 'active' && hasJoined && !isRacing && (
            <TouchableOpacity style={styles.startButton} onPress={startRacing}>
              <Ionicons name="speedometer" size={20} color="#fff" />
              <Text style={styles.buttonText}>Begin Racing</Text>
            </TouchableOpacity>
          )}

          {isRacing && (
            <TouchableOpacity style={styles.finishButton} onPress={finishRace}>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.buttonText}>Finish Race</Text>
            </TouchableOpacity>
          )}
        </View>
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
  errorText: {
    color: '#fff',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1E',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 80,
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  racingOverlay: {
    position: 'absolute',
    top: 120,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  racingStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  racingStat: {
    flex: 1,
    alignItems: 'center',
  },
  racingStatLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
  },
  racingStatValue: {
    color: '#FF3B30',
    fontSize: 24,
    fontWeight: 'bold',
  },
  mapContainer: {
    height: 250,
  },
  map: {
    flex: 1,
  },
  infoContainer: {
    flex: 1,
    padding: 16,
  },
  circuitName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  raceInfo: {
    fontSize: 14,
    color: '#999',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    padding: 24,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  leaderboardRank: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  leaderboardRankText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  leaderboardName: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  leaderboardTime: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  leaderboardStatus: {
    color: '#FF9500',
    fontSize: 14,
  },
  actionButtons: {
    gap: 12,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  finishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
