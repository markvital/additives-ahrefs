'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import MenuIcon from '@mui/icons-material/Menu';

import type { Additive } from '../lib/additives';
import { HeaderSearch } from './HeaderSearch';

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

  const closeMenu = () => {
    setMenuOpen(false);
  };

  return (
    <header className="site-header">
      <div className="content-shell header-shell">
        <div className="header-content">
          <div className="header-bar">
            <div className="header-brand">
              <Link
                href="/"
                aria-label="Food Additives home"
                className="header-logo"
                onClick={closeMenu}
              >
                <span className="header-logo-mobile">
                  <Image
                    src="/img/logo_square.svg"
                    alt=""
                    width={82}
                    height={99}
                    priority
                    sizes="(max-width: 900px) 48px, 0px"
                  />
                </span>
                <span className="header-logo-desktop">
                  <Image
                    src="/img/logo_wide.svg"
                    alt=""
                    width={647}
                    height={99}
                    priority
                    sizes="(max-width: 900px) 0px, 340px"
                  />
                </span>
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
            <Link
              href="/about"
              className="header-link header-about-link"
              onClick={closeMenu}
            >
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
