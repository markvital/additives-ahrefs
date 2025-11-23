import type { Metadata } from 'next';
import NextLink from 'next/link';
import { Box, Link as MuiLink, Typography } from '@mui/material';

export const metadata: Metadata = {
  title: '404 - Page Not Found',
};

export default function NotFoundPage() {
  return (
    <Box component="section" sx={{ width: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Box
        className="page-hero"
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: { xs: 'flex-start', sm: 'center' },
          pt: { xs: 0, sm: '50px' },
        }}
      >
        <Box
          className="page-hero-content"
          display="flex"
          flexDirection="column"
          alignItems="center"
          gap={2}
          textAlign="center"
          sx={{ width: '100%', maxWidth: 520, margin: '0 auto' }}
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
            sx={{ fontWeight: 600, fontSize: '1.05rem' }}
          >
            Go to homepage
          </MuiLink>
        </Box>
      </Box>
    </Box>
  );
}
