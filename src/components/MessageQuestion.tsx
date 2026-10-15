'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Hash, Pencil, Quote } from 'lucide-react';
import { Message } from './ChatWindow';
import { useChat } from '@/lib/hooks/useChat';
import { buildQuotedMessage, parseQuotedMessage } from '@/lib/quote';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const formatTime = (date: Date | string) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const actionClass =
  'p-1.5 rounded-lg text-black/50 dark:text-white/50 hover:bg-light-secondary dark:hover:bg-dark-secondary hover:text-black dark:hover:text-white transition duration-200 disabled:opacity-40 disabled:pointer-events-none';

const MessageQuestion = ({ message }: { message: Message }) => {
  const { loading, rewrite } = useChat();

  const { quote, message: queryMessage } = parseQuotedMessage(message.query);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(queryMessage);
  const [copied, setCopied] = useState<'question' | 'id' | null>(null);
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(
    () => () => {
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
    },
    [],
  );

  useEffect(() => {
    if (!editing) return;

    const el = textareaRef.current;
    if (!el) return;

    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, editing]);

  const copy = async (target: 'question' | 'id') => {
    try {
      await navigator.clipboard.writeText(
        target === 'id' ? message.messageId : queryMessage,
      );
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
      setCopied(target);
      copyTimeout.current = setTimeout(() => setCopied(null), 1500);
    } catch (err) {
      console.error(`Failed to copy question ${target}:`, err);
      toast.error(
        target === 'id'
          ? 'Failed to copy question ID'
          : 'Failed to copy question',
      );
    }
  };

  const startEditing = () => {
    setDraft(queryMessage);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(queryMessage);
  };

  const submit = () => {
    const text = draft.trim();
    if (!text || loading) return;

    setEditing(false);

    if (text === queryMessage) return;

    rewrite(message.messageId, quote ? buildQuotedMessage(quote, text) : text);
  };

  const time = formatTime(message.createdAt);

  return (
    <div className="flex flex-col items-end w-full lg:w-9/12 pt-8">
      {quote && (
        <div className="flex flex-row items-start gap-2 mb-2 max-w-[85%] pl-3 border-l-2 border-light-300 dark:border-dark-300">
          <Quote
            size={14}
            className="shrink-0 mt-1 text-black/40 dark:text-white/40"
          />
          <p className="text-sm text-black/60 dark:text-white/60 line-clamp-3 whitespace-pre-line">
            {quote}
          </p>
        </div>
      )}

      {editing ? (
        <div className="w-full rounded-2xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary p-3">
          <textarea
            ref={textareaRef}
            value={draft}
            rows={1}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                cancel();
              } else if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                submit();
              }
            }}
            className="w-full resize-none bg-transparent text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 focus:outline-none max-h-60"
          />
          <div className="flex flex-row justify-end gap-2 mt-2">
            <button
              onClick={cancel}
              className="px-3 py-1.5 text-sm rounded-lg text-black/70 dark:text-white/70 hover:bg-light-200 dark:hover:bg-dark-200 transition duration-200"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!draft.trim() || loading}
              className="px-3 py-1.5 text-sm rounded-lg bg-black text-white dark:bg-white dark:text-black hover:opacity-85 transition duration-200 disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      ) : (
        <div className="group flex flex-col items-end w-full">
          <div className="flex flex-row items-center justify-end gap-1 w-full">
            <div
              className={cn(
                'flex flex-row items-center gap-0.5 shrink-0 transition-opacity duration-200',
                'opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100',
              )}
            >
              <button
                onClick={() => copy('question')}
                className={actionClass}
                aria-label="Copy question"
                title="Copy"
              >
                {copied === 'question' ? (
                  <Check size={15} />
                ) : (
                  <Copy size={15} />
                )}
              </button>
              <button
                onClick={startEditing}
                disabled={loading}
                className={actionClass}
                aria-label="Edit question"
                title="Edit"
              >
                <Pencil size={15} />
              </button>
            </div>
            <div className="max-w-[85%] rounded-2xl bg-light-secondary dark:bg-dark-secondary px-4 py-2.5 text-black dark:text-white whitespace-pre-wrap break-words">
              {queryMessage}
            </div>
          </div>
          <div className="mt-1 mr-1 flex items-center gap-2 text-xs text-black/40 dark:text-white/40">
            {time && <span>{time}</span>}
            <button
              type="button"
              onClick={() => copy('id')}
              className="flex items-center gap-1 rounded px-1 py-0.5 hover:text-black dark:hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-current transition-colors"
              aria-label="Copy question ID"
              title={`Copy question ID: ${message.messageId}`}
            >
              {copied === 'id' ? <Check size={12} /> : <Hash size={12} />}
              <span aria-live="polite">
                {copied === 'id' ? 'Copied' : 'ID'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageQuestion;
