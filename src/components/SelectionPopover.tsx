'use client';

import { RefObject, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, MessageSquareQuote, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useChat } from '@/lib/hooks/useChat';
import { buildQuotedMessage, normalizeQuote } from '@/lib/quote';

const POPOVER_OFFSET = 8;

type PopoverState = {
  text: string;
  top: number;
  left: number;
  placement: 'above' | 'below';
};

const SelectionPopover = ({
  containerRef,
}: {
  containerRef: RefObject<HTMLElement | null>;
}) => {
  const { loading, sendMessage, setQuotedText } = useChat();
  const [popover, setPopover] = useState<PopoverState | null>(null);

  const readSelection = useCallback(() => {
    const selection = window.getSelection();
    const container = containerRef.current;

    if (
      !selection ||
      selection.isCollapsed ||
      selection.rangeCount === 0 ||
      !container
    ) {
      setPopover(null);
      return;
    }

    const range = selection.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) {
      setPopover(null);
      return;
    }

    const text = normalizeQuote(selection.toString());
    if (!text) {
      setPopover(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    const placement = rect.top > 56 ? 'above' : 'below';

    setPopover({
      text,
      top:
        placement === 'above'
          ? rect.top - POPOVER_OFFSET
          : rect.bottom + POPOVER_OFFSET,
      left: Math.min(
        Math.max(rect.left + rect.width / 2, 120),
        window.innerWidth - 120,
      ),
      placement,
    });
  }, [containerRef]);

  useEffect(() => {
    // Wait for the browser to finalize the selection before reading it.
    const handlePointerUp = () => setTimeout(readSelection, 0);

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPopover(null);
        return;
      }
      if (e.shiftKey || e.key === 'Shift') readSelection();
    };

    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) setPopover(null);
    };

    const hide = () => setPopover(null);

    document.addEventListener('mouseup', handlePointerUp);
    document.addEventListener('touchend', handlePointerUp);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('selectionchange', handleSelectionChange);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);

    return () => {
      document.removeEventListener('mouseup', handlePointerUp);
      document.removeEventListener('touchend', handlePointerUp);
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('selectionchange', handleSelectionChange);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [readSelection]);

  if (!popover) return null;

  const close = () => {
    window.getSelection()?.removeAllRanges();
    setPopover(null);
  };

  const actions = [
    {
      label: '채팅에 추가',
      icon: MessageSquareQuote,
      disabled: false,
      onClick: () => {
        setQuotedText(popover.text);
        close();
      },
    },
    {
      label: '더 자세히',
      icon: Sparkles,
      disabled: loading,
      onClick: () => {
        sendMessage(
          buildQuotedMessage(popover.text, '이 부분을 더 자세히 설명해줘.'),
        );
        close();
      },
    },
    {
      label: '복사',
      icon: Copy,
      disabled: false,
      onClick: async () => {
        try {
          await navigator.clipboard.writeText(popover.text);
          toast.success('클립보드에 복사했습니다');
        } catch {
          toast.error('복사하지 못했습니다');
        }
        close();
      },
    },
  ];

  return createPortal(
    <div
      role="toolbar"
      aria-label="선택한 텍스트 작업"
      // Keep the text selection alive while clicking an action.
      onMouseDown={(e) => e.preventDefault()}
      className="fixed z-50 flex flex-row items-center gap-0.5 p-1 rounded-xl bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 shadow-lg shadow-black/10 dark:shadow-black/40"
      style={{
        top: popover.top,
        left: popover.left,
        transform:
          popover.placement === 'above'
            ? 'translate(-50%, -100%)'
            : 'translate(-50%, 0)',
      }}
    >
      {actions.map(({ label, icon: Icon, disabled, onClick }) => (
        <button
          key={label}
          type="button"
          disabled={disabled}
          onClick={onClick}
          className="flex flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap text-black/80 dark:text-white/80 hover:bg-light-secondary dark:hover:bg-dark-secondary hover:text-black dark:hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-colors duration-150"
        >
          <Icon size={14} className="shrink-0" />
          {label}
        </button>
      ))}
    </div>,
    document.body,
  );
};

export default SelectionPopover;
