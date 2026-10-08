import { KeyboardEvent, useRef } from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MessageTab = {
  id: string;
  label: string;
  icon: LucideIcon;
  count?: number;
  busy?: boolean;
};

const MessageTabs = ({
  tabs,
  active,
  onChange,
  idPrefix,
}: {
  tabs: MessageTab[];
  active: string;
  onChange: (id: string) => void;
  idPrefix: string;
}) => {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (event: KeyboardEvent, index: number) => {
    const step =
      event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;

    event.preventDefault();
    const next = (index + step + tabs.length) % tabs.length;
    refs.current[next]?.focus();
    onChange(tabs[next].id);
  };

  return (
    <div
      role="tablist"
      className="sticky top-[65px] z-30 -mx-1 flex items-center gap-1 overflow-x-auto bg-light-primary dark:bg-dark-primary px-1 py-2 border-b border-light-200/70 dark:border-dark-200/70 [scrollbar-width:none]"
    >
      {tabs.map((tab, i) => {
        const selected = tab.id === active;

        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`${idPrefix}-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors duration-150',
              selected
                ? 'bg-light-secondary dark:bg-dark-secondary text-black dark:text-white font-medium'
                : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-light-secondary/60 dark:hover:bg-dark-secondary/60',
            )}
          >
            <tab.icon size={15} className={cn(tab.busy && 'animate-spin')} />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="text-xs font-normal tabular-nums text-black/40 dark:text-white/40">
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default MessageTabs;
