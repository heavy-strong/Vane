'use client';

import { AnchorHTMLAttributes, forwardRef, MouseEvent } from 'react';
import { toast } from 'sonner';
import { isDesktop, openDesktopLink } from '@/lib/desktop';
import { getPreference } from '@/lib/preferences/client';

/** External links use the desktop preference; relative links keep normal navigation. */
const ExternalAnchor = forwardRef<
  HTMLAnchorElement,
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
>(({ href, onClick, onAuxClick, ...props }, ref) => {
  const openLink = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.currentTarget.hasAttribute('download') ||
      !isDesktop()
    ) {
      return;
    }

    let url: URL;
    try {
      url = new URL(event.currentTarget.href);
    } catch {
      return;
    }
    if (!['http:', 'https:'].includes(url.protocol)) return;
    if (url.origin === window.location.origin) return;

    event.preventDefault();
    void openDesktopLink(
      url.href,
      getPreference('openLinksInBrowser') !== 'false',
    ).catch((error: unknown) => {
      console.error('Could not open link', error);
      toast.error('Could not open link. Please try again.');
    });
  };

  return (
    <a
      ref={ref}
      href={href}
      target={/^(?:https?:)?\/\//i.test(href) ? '_blank' : undefined}
      rel="noopener noreferrer"
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (event.button === 0) openLink(event);
      }}
      onAuxClick={(event) => {
        onAuxClick?.(event);
        if (event.button === 1) openLink(event);
      }}
    />
  );
});

ExternalAnchor.displayName = 'ExternalAnchor';

export default ExternalAnchor;
