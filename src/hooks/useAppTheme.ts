import { useColorScheme } from 'react-native';

import { darkTheme, lightTheme } from '../config/theme';

export const useAppTheme = () => {
  const scheme = useColorScheme();

  return scheme === 'dark' ? darkTheme : lightTheme;
};
