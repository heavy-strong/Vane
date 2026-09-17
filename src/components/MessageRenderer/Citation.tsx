import { openUrl } from '@tauri-apps/plugin-opener';
import { isDesktop } from '@/lib/desktop';

const Citation = ({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) => {
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    // A Tauri WebView does not create a browser tab for `target="_blank"`.
    // Hand the citation to the OS so it opens in the user's default browser.
    if (!isDesktop()) return;

    event.preventDefault();
    void openUrl(href).catch((error: unknown) => {
      console.error('Could not open citation URL', error);
    });
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="bg-light-secondary dark:bg-dark-secondary px-1 rounded ml-1 no-underline text-xs text-black/70 dark:text-white/70 relative"
    >
      {children}
    </a>
  );
};

export default Citation;
