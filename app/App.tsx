import { StatusBar } from 'expo-status-bar';
import ReceiptScanner from './screens/ReceiptScanner';

export default function App() {
  return (
    <>
      <StatusBar style="dark" />
      <ReceiptScanner />
    </>
  );
}
