// Global Theme Configuration
// Change these values to update the theme across the entire application

export interface ThemeColors {
  primary: string;           // Main brand color
  primaryHover: string;      // Darker variant for hover states
  accent: string;            // Complementary accent color
  accentHover: string;       // Darker accent for hover states
  success: string;           // Success/positive actions
  successHover: string;      // Darker success for hover
  warning: string;           // Warning/caution states
  warningHover: string;      // Darker warning for hover
  error: string;             // Error/danger states
  errorHover: string;        // Darker error for hover
  info: string;              // Info/neutral states
  infoHover: string;         // Darker info for hover
}

export interface Theme {
  colors: ThemeColors;
  name: string;
  description: string;
}

// Main Theme Configuration
export const theme: Theme = {
  name: 'EventChain Purple',
  description: 'Professional purple theme with complementary gold accents',
  colors: {
    // Primary brand colors
    primary: '#592DBE',           // Main purple color
    primaryHover: '#4A248A',      // Darker purple for hover states
    
    // Accent colors (complementary)
    accent: '#BE8C2D',            // Gold/orange accent color
    accentHover: '#A0741F',       // Darker gold for hover states
    
    // Semantic colors
    success: '#10B981',           // Emerald green for success
    successHover: '#059669',      // Darker emerald
    
    warning: '#F59E0B',           // Amber for warnings
    warningHover: '#D97706',      // Darker amber
    
    error: '#EF4444',             // Red for errors
    errorHover: '#DC2626',        // Darker red
    
    info: '#6366F1',              // Indigo for info (complements purple theme)
    infoHover: '#4F46E5',         // Darker indigo
  }
};

// Helper function to get color with opacity
export const getColorWithOpacity = (color: string, opacity: number): string => {
  // Convert hex to rgba
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// Helper function to generate CSS custom properties
export const generateCSSCustomProperties = (themeColors: ThemeColors): Record<string, string> => {
  return {
    '--color-primary': themeColors.primary,
    '--color-primary-hover': themeColors.primaryHover,
    '--color-accent': themeColors.accent,
    '--color-accent-hover': themeColors.accentHover,
    '--color-success': themeColors.success,
    '--color-success-hover': themeColors.successHover,
    '--color-warning': themeColors.warning,
    '--color-warning-hover': themeColors.warningHover,
    '--color-error': themeColors.error,
    '--color-error-hover': themeColors.errorHover,
    '--color-info': themeColors.info,
    '--color-info-hover': themeColors.infoHover,
  };
};

// Export default theme colors for easy access
export const colors = theme.colors;
export default theme; 