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
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function CircuitDetail() {
  const { id } = useLocalSearchParams();
  const { token, user } = useAuth();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);

  const [circuit, setCircuit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadCircuit();
  }, [id]);

  const loadCircuit = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/circuits/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCircuit(response.data);

      // Fit map to circuit
      if (response.data.coordinates.length > 0 && mapRef.current) {
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(response.data.coordinates, {
            edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
            animated: true,
          });
        }, 500);
      }
    } catch (error) {
      console.error('Error loading circuit:', error);
      Alert.alert('Error', 'Failed to load circuit');
    } finally {
      setLoading(false);
    }
  };

  const createRace = async () => {
    setCreating(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/races`,
        { circuit_id: id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('Success', 'Race created! Waiting for other racers to join.', [
        { text: 'OK', onPress: () => router.push(`/race/${response.data.id}`) },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create race');
    } finally {
      setCreating(false);
    }
  };

  const deleteCircuit = async () => {
    Alert.alert('Delete Circuit', 'Are you sure you want to delete this circuit?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(`${API_URL}/api/circuits/${id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            Alert.alert('Success', 'Circuit deleted', [
              { text: 'OK', onPress: () => router.back() },
            ]);
          } catch (error: any) {
            Alert.alert('Error', error.response?.data?.detail || 'Failed to delete circuit');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF3B30" />
      </View>
    );
  }

  if (!circuit) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Circuit not found</Text>
      </View>
    );
  }

  const isOwner = circuit.creator_id === user?.id;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Circuit Details</Text>
        {isOwner && (
          <TouchableOpacity onPress={deleteCircuit}>
            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        )}
      </View>

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
        >
          <Polyline
            coordinates={circuit.coordinates}
            strokeColor="#FF3B30"
            strokeWidth={4}
          />
          <Marker
            coordinate={circuit.coordinates[0]}
            pinColor="green"
            title="Start"
          />
          <Marker
            coordinate={circuit.coordinates[circuit.coordinates.length - 1]}
            pinColor="red"
            title="Finish"
          />
        </MapView>
      </View>

      <ScrollView style={styles.infoContainer}>
        <View style={styles.titleSection}>
          <View style={styles.titleRow}>
            <Text style={styles.circuitName}>{circuit.name}</Text>
            {!circuit.is_public && (
              <View style={styles.privateBadge}>
                <Ionicons name="lock-closed" size={14} color="#fff" />
                <Text style={styles.privateBadgeText}>Private</Text>
              </View>
            )}
          </View>
          <Text style={styles.creatorText}>Created by {circuit.creator_name}</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="navigate" size={24} color="#FF3B30" />
            <Text style={styles.statValue}>{circuit.distance.toFixed(2)} km</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="location" size={24} color="#FF3B30" />
            <Text style={styles.statValue}>{circuit.coordinates.length}</Text>
            <Text style={styles.statLabel}>Waypoints</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name={circuit.is_public ? 'globe' : 'lock-closed'} size={24} color="#FF3B30" />
            <Text style={styles.statValue}>{circuit.is_public ? 'Public' : 'Private'}</Text>
            <Text style={styles.statLabel}>Visibility</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.createRaceButton, creating && styles.buttonDisabled]}
          onPress={createRace}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="flag" size={24} color="#fff" />
              <Text style={styles.createRaceButtonText}>Create Race on This Circuit</Text>
            </>
          )}
        </TouchableOpacity>
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
  mapContainer: {
    height: 300,
  },
  map: {
    flex: 1,
  },
  infoContainer: {
    flex: 1,
    padding: 16,
  },
  titleSection: {
    marginBottom: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  circuitName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#666',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  privateBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  creatorText: {
    fontSize: 14,
    color: '#999',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  createRaceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  createRaceButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
