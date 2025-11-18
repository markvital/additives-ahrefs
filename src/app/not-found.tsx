import type { Metadata } from 'next';
import NextLink from 'next/link';
import { Box, Link as MuiLink, Typography } from '@mui/material';

export const metadata: Metadata = {
  title: '404 - Page Not Found',
};

export default function NotFoundPage() {
  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        px: 2,
        py: { xs: 8, md: 10 },
        width: '100%',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          maxWidth: 520,
          width: '100%',
        }}
      >
        <Typography component="h1" variant="h2" sx={{ fontWeight: 700 }}>
          404 - Page Not Found
        </Typography>
        <Typography variant="body1" color="text.secondary">
          The page you were looking for doesn’t exist at this address.
        </Typography>
        <Typography variant="body1" color="text.secondary">
          You can browse or search additives to discover the information you need.
        </Typography>
        <MuiLink
          component={NextLink}
          href="/"
          underline="always"
          sx={{ fontWeight: 600, fontSize: '1.05rem', alignSelf: 'center' }}
        >
          Go to homepage
        </MuiLink>
      </Box>
    </Box>
  );
}
