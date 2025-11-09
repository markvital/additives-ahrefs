'use client';

import { useState } from 'react';
import { Link as MuiLink, Snackbar } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';

interface CopyLinkButtonProps {
  url?: string;
}

export function CopyLinkButton({ url }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);
  const [showSnackbar, setShowSnackbar] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    const linkToCopy = url ?? (typeof window !== 'undefined' ? window.location.href : '');

    try {
      await navigator.clipboard.writeText(linkToCopy);
      setCopied(true);
      setShowSnackbar(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const handleCloseSnackbar = () => {
    setShowSnackbar(false);
  };

  return (
    <>
      <MuiLink
        component="button"
        onClick={handleCopy}
        underline="hover"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.95rem',
          color: '#717171',
          cursor: 'pointer',
          border: 'none',
          background: 'none',
          padding: 0,
          '&:hover': {
            color: '#5a5a5a',
          },
        }}
      >
        {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
        {copied ? 'Link copied' : 'Copy link'}
      </MuiLink>

      <Snackbar
        open={showSnackbar}
        autoHideDuration={2000}
        onClose={handleCloseSnackbar}
        message="Additive link copied to clipboard"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}
