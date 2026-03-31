/**
 * DietaAI — palette from diet_ai_full_mockup.html + dark variant + chat/menu tokens.
 */
export type AppColors = {
  primary: string;
  primaryLight: string;
  primaryMuted: string;
  primaryDark: string;
  primaryDarkLabel: string;

  bgPrimary: string;
  bgSecondary: string;
  bgCard: string;
  bgDark: string;

  greenPill: string;
  greenPillBorder: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textHint: string;
  textOnPrimary: string;

  border: string;
  borderStrong: string;

  suggestionBg: string;
  suggestionBorder: string;
  suggestionText: string;
  suggestionLabel: string;

  amber: string;
  divider: string;
  tabBarBorder: string;

  /** Profilo menu tiles */
  menuTileBlue: string;
  menuTilePurple: string;

  /** Chat / onboarding chat shell */
  chatLine: string;
  chatScreenBg: string;
  chatShellBg: string;
  chatBubbleBorder: string;
  chatMuted: string;

  /** Markdown / misc */
  markdownLink: string;
  cardBackground: string;
  cardBorder: string;
  shadow: string;
};

export const lightColors: AppColors = {
  primary: '#1D9E75',
  primaryLight: '#5DCAA5',
  primaryMuted: '#9FE1CB',
  primaryDark: '#085041',
  primaryDarkLabel: '#0F6E56',

  bgPrimary: '#F8F7F3',
  bgSecondary: '#F1EFE8',
  bgCard: '#fff',
  bgDark: '#121212',

  greenPill: '#E1F5EE',
  greenPillBorder: '#5DCAA5',

  textPrimary: '#1a1a1a',
  textSecondary: '#888',
  textMuted: '#5F5E5A',
  textHint: '#B4B2A9',
  textOnPrimary: '#fff',

  border: 'rgba(0,0,0,0.08)',
  borderStrong: 'rgba(0,0,0,0.12)',

  suggestionBg: '#FFF9EC',
  suggestionBorder: '#FAC775',
  suggestionText: '#633806',
  suggestionLabel: '#854F0B',

  amber: '#BA7517',
  divider: 'rgba(0,0,0,0.06)',
  tabBarBorder: 'rgba(0,0,0,0.07)',

  menuTileBlue: '#EBF3FF',
  menuTilePurple: '#EDE7F6',

  chatLine: '#edf0f2',
  chatScreenBg: '#f7f8f9',
  chatShellBg: '#f5f7f8',
  chatBubbleBorder: '#f0f1f3',
  chatMuted: '#6f7782',

  markdownLink: '#1565C0',
  cardBackground: '#fff',
  cardBorder: '#f4f4f5',
  shadow: '#000',
};

export const darkColors: AppColors = {
  primary: '#3DCF9A',
  primaryLight: '#5DCAA5',
  primaryMuted: '#1E4D3F',
  primaryDark: '#9FE1CB',
  primaryDarkLabel: '#5DCAA5',

  bgPrimary: '#121212',
  bgSecondary: '#1C1C1C',
  bgCard: '#2C2C2C',
  bgDark: '#000000',

  greenPill: '#1A3D32',
  greenPillBorder: '#2A6B55',

  textPrimary: '#ECECEC',
  textSecondary: '#A0A0A0',
  textMuted: '#9A9A9A',
  textHint: '#6B6B6B',
  textOnPrimary: '#0A0A0A',

  border: 'rgba(255,255,255,0.12)',
  borderStrong: 'rgba(255,255,255,0.18)',

  suggestionBg: '#3D3420',
  suggestionBorder: '#C9A227',
  suggestionText: '#F5E6C8',
  suggestionLabel: '#E8C97A',

  amber: '#E8A838',
  divider: 'rgba(255,255,255,0.08)',
  tabBarBorder: 'rgba(255,255,255,0.1)',

  menuTileBlue: '#1E2A3A',
  menuTilePurple: '#2A2438',

  chatLine: '#3A3F45',
  chatScreenBg: '#1A1D21',
  chatShellBg: '#22262B',
  chatBubbleBorder: '#3A3F45',
  chatMuted: '#9CA3AF',

  markdownLink: '#7CB8FF',
  cardBackground: '#2C2C2C',
  cardBorder: '#3F3F46',
  shadow: '#000',
};

/** @deprecated Usare useTheme().colors */
export const colors = lightColors;
