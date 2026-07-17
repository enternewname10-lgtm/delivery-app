import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ParsedAddress } from './utils/addressParser';
import ReceiptScanner from './screens/ReceiptScanner';
import RouteView from './screens/RouteView';

export default function App() {
  const [screen, setScreen] = useState<'scanner' | 'route'>('scanner');
  const [routeAddresses, setRouteAddresses] = useState<ParsedAddress[]>([]);

  function startRoute(addresses: ParsedAddress[]) {
    setRouteAddresses(addresses);
    setScreen('route');
  }

  return (
    <>
      <StatusBar style="dark" />
      {screen === 'scanner' ? (
        <ReceiptScanner onStartRoute={startRoute} />
      ) : (
        <RouteView addresses={routeAddresses} onBack={() => setScreen('scanner')} />
      )}
    </>
  );
}
