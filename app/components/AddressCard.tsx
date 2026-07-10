import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ParsedAddress } from '../utils/addressParser';

interface Props {
  address: ParsedAddress;
  index?: number;
  onRemove?: () => void;
}

export default function AddressCard({ address, index, onRemove }: Props) {
  return (
    <View style={styles.card}>
      {index !== undefined && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{index}</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.street}>{address.street}</Text>
        <Text style={styles.cityState}>
          {address.city}, {address.state}{address.zip ? ` ${address.zip}` : ''}
        </Text>
      </View>
      {onRemove && (
        <TouchableOpacity onPress={onRemove} style={styles.removeBtn} hitSlop={8}>
          <Text style={styles.removeText}>x</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  street: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E3A5F',
  },
  cityState: {
    fontSize: 13,
    color: '#5B7A99',
    marginTop: 2,
  },
  removeBtn: {
    padding: 4,
  },
  removeText: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '600',
  },
});
