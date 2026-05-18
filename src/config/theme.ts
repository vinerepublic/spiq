export interface AppTheme {
  dark: boolean;
  colors: {
    background: string;
    backgroundAlt: string;
    surface: string;
    surfaceMuted: string;
    text: string;
    textMuted: string;
    primary: string;
    primarySoft: string;
    accent: string;
    border: string;
    danger: string;
    success: string;
    warning: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  radii: {
    sm: number;
    md: number;
    lg: number;
    pill: number;
    round: number;
  };
}

const baseTheme = {
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 20,
    xl: 28,
    xxl: 36,
  },
  radii: {
    sm: 10,
    md: 16,
    lg: 24,
    pill: 999,
    round: 999,
  },
};

export const lightTheme: AppTheme = {
  dark: false,
  colors: {
    background: '#f4f6f8',
    backgroundAlt: '#e8eef2',
    surface: '#ffffff',
    surfaceMuted: '#f3f8fb',
    text: '#10212b',
    textMuted: '#5f7381',
    primary: '#0e7a78',
    primarySoft: '#d8f0ec',
    accent: '#ef7b45',
    border: '#d6e0e5',
    danger: '#cf4a4a',
    success: '#23856a',
    warning: '#b87722',
  },
  ...baseTheme,
};

export const darkTheme: AppTheme = {
  dark: true,
  colors: {
    background: '#06131b',
    backgroundAlt: '#0d2430',
    surface: '#102734',
    surfaceMuted: '#143445',
    text: '#ecf5f7',
    textMuted: '#a8c0cb',
    primary: '#53d0c7',
    primarySoft: '#163b43',
    accent: '#ff9b68',
    border: '#1d3d4d',
    danger: '#ff8888',
    success: '#63d7aa',
    warning: '#f6bf66',
  },
  ...baseTheme,
};
