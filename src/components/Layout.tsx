import { cn } from '@/lib/utils';

const Layout = ({
  children,
  sidebarExpanded = false,
}: {
  children: React.ReactNode;
  sidebarExpanded?: boolean;
}) => {
  return (
    <main
      className={cn(
        'bg-light-primary dark:bg-dark-primary min-h-screen',
        sidebarExpanded ? 'lg:pl-64' : 'lg:pl-20',
      )}
    >
      <div className="max-w-screen-lg lg:mx-auto mx-4">{children}</div>
    </main>
  );
};

export default Layout;
