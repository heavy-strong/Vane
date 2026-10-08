import { AnchorHTMLAttributes, forwardRef, MouseEvent } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { isDesktop } from '@/lib/desktop';

/** A link to an outside page that opens in a new tab, or in the default
 * browser on desktop. */
const ExternalAnchor = forwardRef<
  HTMLAnchorElement,
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
>(({ href, onClick, ...props }, ref) => {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);

    // A Tauri WebView does not create a browser tab for `target="_blank"`.
    // Hand the link to the OS so it opens in the user's default browser.
    if (event.defaultPrevented || !isDesktop()) return;

    event.preventDefault();
    void openUrl(href).catch((error: unknown) => {
      console.error('Could not open URL', error);
    });
  };

  return (
    <a
      ref={ref}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      {...props}
    />
  );
});

ExternalAnchor.displayName = 'ExternalAnchor';

export default ExternalAnchor;
