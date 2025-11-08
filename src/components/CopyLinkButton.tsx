'use client';

import { useState } from 'react';
import { Button, Snackbar, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';

interface CopyLinkButtonProps {
  url?: string;
  variant?: 'text' | 'outlined' | 'contained';
  size?: 'small' | 'medium' | 'large';
}

export function CopyLinkButton({ url, variant = 'outlined', size = 'small' }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);
  const [showSnackbar, setShowSnackbar] = useState(false);

  const handleCopy = async () => {
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
      <Tooltip title={copied ? 'Copied!' : 'Copy link'} arrow>
        <Button
          variant={variant}
          size={size}
          onClick={handleCopy}
          startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            borderColor: copied ? 'success.main' : undefined,
            color: copied ? 'success.main' : undefined,
            '&:hover': {
              borderColor: copied ? 'success.dark' : undefined,
            },
          }}
        >
          {copied ? 'Link copied' : 'Copy link'}
        </Button>
      </Tooltip>

      <Snackbar
        open={showSnackbar}
        autoHideDuration={2000}
        onClose={handleCloseSnackbar}
        message="Link copied to clipboard"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}
