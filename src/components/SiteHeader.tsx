'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import MenuIcon from '@mui/icons-material/Menu';

import type { Additive } from '../lib/additives';
import { HeaderSearch } from './HeaderSearch';
import logo2x from '../../img/logo/logo_2x.png';

interface SiteHeaderProps {
  additives: Additive[];
}

export function SiteHeader({ additives }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 601px)');

    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setMenuOpen(false);
      }
    };

    if (mediaQuery.matches) {
      setMenuOpen(false);
    }

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);

      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }

    mediaQuery.addListener(handleChange);

    return () => {
      mediaQuery.removeListener(handleChange);
    };
  }, []);

  const toggleMenu = () => {
    setMenuOpen((previous) => !previous);
  };

  return (
    <header className="site-header">
      <div className="content-shell header-shell">
        <div className="header-content">
          <div className="header-bar">
            <div className="header-brand">
              <Link href="/" aria-label="Food Additives home" className="header-logo">
                <Image
                  src={logo2x}
                  alt="Food Additives logo"
                  width={41}
                  height={50}
                  priority
                />
              </Link>
              <Link href="/" className="header-title-link">
                Food additives
              </Link>
            </div>
            <button
              type="button"
              className="header-toggle"
              aria-expanded={menuOpen}
              aria-controls="site-header-nav"
              onClick={toggleMenu}
            >
              <MenuIcon fontSize="large" />
              <span className="sr-only">Toggle menu</span>
            </button>
          </div>
          <nav
            id="site-header-nav"
            className="header-nav"
            data-open={menuOpen}
            aria-label="Main"
          >
            <HeaderSearch additives={additives} />
            <Link href="/compare" className="header-link">
              Compare
            </Link>
            <Link href="/about" className="header-link header-about-link">
              <span className="header-about-icon" aria-hidden="true">
                <InfoOutlinedIcon fontSize="small" />
              </span>
              <span className="header-about-text">About</span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
