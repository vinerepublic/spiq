import { registerRootComponent } from 'expo';

import App from './App';

try {
  const { registerGlobals } = require('@livekit/react-native') as typeof import('@livekit/react-native');
  registerGlobals();
} catch {
  // Live voice requires a native dev build. Keep Expo Go and mock mode usable.
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
