import type { ReactNode } from 'react';

/**
 * Isolated layout for preview pages.
 * Renders only children without header, footer, or any other layout elements.
 */
export default function PreviewLayout({ children }: { children: ReactNode }) {
  return children;
}
