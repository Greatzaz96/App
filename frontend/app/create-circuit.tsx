import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function CreateCircuit() {
  const { token } = useAuth();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);

  const [region, setRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const [coordinates, setCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [circuitName, setCircuitName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermission(true);
        const location = await Location.getCurrentPositionAsync({});
        setRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } else {
        Alert.alert('Permission Denied', 'Location permission is required to create circuits');
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
    }
  };

  const handleMapPress = (event: any) => {
    const { coordinate } = event.nativeEvent;
    setCoordinates([...coordinates, coordinate]);
  };

  const undoLastPoint = () => {
    if (coordinates.length > 0) {
      setCoordinates(coordinates.slice(0, -1));
    }
  };

  const clearCircuit = () => {
    Alert.alert('Clear Circuit', 'Are you sure you want to clear all points?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => setCoordinates([]),
      },
    ]);
  };

  const calculateDistance = () => {
    if (coordinates.length < 2) return 0;

    let distance = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
      const lat1 = coordinates[i].latitude;
      const lon1 = coordinates[i].longitude;
      const lat2 = coordinates[i + 1].latitude;
      const lon2 = coordinates[i + 1].longitude;

      // Haversine formula
      const R = 6371; // Earth's radius in km
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
          Math.cos(lat2 * (Math.PI / 180)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      distance += R * c;
    }

    return distance;
  };

  const saveCircuit = async () => {
    if (!circuitName.trim()) {
      Alert.alert('Error', 'Please enter a circuit name');
      return;
    }

    if (coordinates.length < 2) {
      Alert.alert('Error', 'Please add at least 2 points to create a circuit');
      return;
    }

    setSaving(true);
    try {
      await axios.post(
        `${API_URL}/api/circuits`,
        {
          name: circuitName,
          coordinates: coordinates,
          distance: calculateDistance(),
          is_public: isPublic,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      Alert.alert('Success', 'Circuit created successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create circuit');
    } finally {
      setSaving(false);
    }
  };

  const distance = calculateDistance();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Circuit</Text>
        <TouchableOpacity onPress={saveCircuit} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#FF3B30" />
          ) : (
            <Ionicons name="checkmark" size={28} color="#FF3B30" />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={styles.map}
          initialRegion={region}
          onPress={handleMapPress}
          showsUserLocation={locationPermission}
          showsMyLocationButton={true}
        >
          {coordinates.map((coord, index) => (
            <Marker
              key={index}
              coordinate={coord}
              pinColor={index === 0 ? 'green' : index === coordinates.length - 1 ? 'red' : '#FF3B30'}
            >
              <View style={styles.markerContainer}>
                <Text style={styles.markerText}>{index + 1}</Text>
              </View>
            </Marker>
          ))}
          {coordinates.length > 1 && (
            <Polyline
              coordinates={coordinates}
              strokeColor="#FF3B30"
              strokeWidth={4}
            />
          )}
        </MapView>

        <View style={styles.mapOverlay}>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              {coordinates.length} points • {distance.toFixed(2)} km
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Circuit Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter circuit name"
            placeholderTextColor="#666"
            value={circuitName}
            onChangeText={setCircuitName}
          />
        </View>

        <View style={styles.switchGroup}>
          <View>
            <Text style={styles.label}>Make Public</Text>
            <Text style={styles.switchSubtext}>
              {isPublic ? 'Everyone can see and race' : 'Only you can see this circuit'}
            </Text>
          </View>
          <Switch
            value={isPublic}
            onValueChange={setIsPublic}
            trackColor={{ false: '#3e3e3e', true: '#FF3B30' }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.undoButton]}
            onPress={undoLastPoint}
            disabled={coordinates.length === 0}
          >
            <Ionicons name="arrow-undo" size={20} color="#fff" />
            <Text style={styles.buttonText}>Undo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.clearButton]}
            onPress={clearCircuit}
            disabled={coordinates.length === 0}
          >
            <Ionicons name="trash-outline" size={20} color="#fff" />
            <Text style={styles.buttonText}>Clear</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.helpText}>
          Tap on the map to add waypoints for your circuit
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
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
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  mapOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
  },
  infoCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  infoText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  markerContainer: {
    backgroundColor: '#FF3B30',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  formContainer: {
    backgroundColor: '#000',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1C1C1E',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  switchSubtext: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  undoButton: {
    backgroundColor: '#007AFF',
  },
  clearButton: {
    backgroundColor: '#FF453A',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  helpText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
  },
});
