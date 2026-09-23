// Polyfills first: viem's crypto reads globalThis.crypto when it loads, and expo-router loads
// route modules before the root layout runs.
import 'react-native-get-random-values'
import 'expo-router/entry'
