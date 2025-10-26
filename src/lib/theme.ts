import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1a1a1a',
    },
    text: {
      primary: '#111111',
      secondary: '#5f5f5f',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    divider: '#e0e0e0',
  },
  typography: {
    fontFamily: '"Roboto", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 500,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontSize: '1.5rem',
      fontWeight: 500,
      letterSpacing: '-0.01em',
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
  },
  shape: {
    borderRadius: 18,
  },
  components: {
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          textTransform: 'capitalize',
          fontWeight: 500,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 24,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          ':hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 16px 32px rgba(0, 0, 0, 0.12)',
          },
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: '#717171',
          textDecorationColor: '#717171',
          transition: 'color 0.2s ease, text-decoration-color 0.2s ease',
          '&:hover': {
            color: '#000000',
            textDecorationColor: '#000000',
          },
        },
      },
    },
  },
});
