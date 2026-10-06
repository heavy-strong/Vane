import { useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { tableToMarkdown } from './MathTex';
import { cn } from '@/lib/utils';

/** Rendered markdown table with a hover button that copies it as a GFM table. */
const TableBlock = ({ children, ...props }: React.ComponentProps<'table'>) => {
  const tableRef = useRef<HTMLTableElement>(null);
  const [copied, setCopied] = useState(false);

  const copyTable = () => {
    if (!tableRef.current) return;
    navigator.clipboard.writeText(tableToMarkdown(tableRef.current));
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  return (
    <div className="group relative not-prose my-5">
      <div className="overflow-x-auto rounded-xl border border-light-200 dark:border-dark-200">
        <table
          ref={tableRef}
          {...props}
          className={cn(
            'w-full border-collapse text-sm text-black dark:text-white',
            '[&_thead]:bg-light-secondary dark:[&_thead]:bg-dark-secondary',
            '[&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-semibold [&_th]:whitespace-nowrap',
            '[&_th]:border-b-2 [&_th]:border-light-200 dark:[&_th]:border-dark-200',
            '[&_td]:px-4 [&_td]:py-2.5 [&_td]:align-top [&_td]:leading-relaxed',
            '[&_tbody_tr]:border-b [&_tbody_tr]:border-light-200 dark:[&_tbody_tr]:border-dark-200 [&_tbody_tr:last-child]:border-0',
            '[&_th:not(:last-child)]:border-r [&_td:not(:last-child)]:border-r',
            '[&_th]:border-light-200 dark:[&_th]:border-dark-200 [&_td]:border-light-200 dark:[&_td]:border-dark-200',
            '[&_tbody_tr:nth-child(even)]:bg-light-secondary/40 dark:[&_tbody_tr:nth-child(even)]:bg-dark-secondary/40',
            '[&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-light-secondary/50 dark:[&_tbody_tr:hover]:bg-dark-secondary/50',
            props.className,
          )}
        >
          {children}
        </table>
      </div>
      <button
        type="button"
        onClick={copyTable}
        title="Copy table as Markdown"
        className="absolute top-1.5 right-1.5 p-1.5 rounded-md select-none opacity-0 group-hover:opacity-100 focus:opacity-100 transition duration-200 bg-light-primary/80 dark:bg-dark-primary/80 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-light-secondary dark:hover:bg-dark-secondary"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
};

export default TableBlock;
