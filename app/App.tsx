import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ParsedAddress } from './utils/addressParser';
import HomeScreen from './screens/HomeScreen';
import ReceiptScanner from './screens/ReceiptScanner';
import RouteView from './screens/RouteView';

export default function App() {
  const [screen, setScreen] = useState<'home' | 'scanner' | 'route'>('home');
  const [routeAddresses, setRouteAddresses] = useState<ParsedAddress[]>([]);

  function startRoute(addresses: ParsedAddress[]) {
    setRouteAddresses(addresses);
    setScreen('route');
  }

  return (
    <>
      <StatusBar style="light" />
      {screen === 'home' && <HomeScreen onStart={() => setScreen('scanner')} />}
      {screen === 'scanner' && <ReceiptScanner onStartRoute={startRoute} />}
      {screen === 'route' && (
        <RouteView addresses={routeAddresses} onBack={() => setScreen('scanner')} />
      )}
    </>
  );
}
