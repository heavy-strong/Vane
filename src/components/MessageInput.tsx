import { ArrowRight, Quote, Square, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import Sources from './MessageInputActions/Sources';
import Optimization from './MessageInputActions/Optimization';
import Attach from './MessageInputActions/Attach';
import { useChat } from '@/lib/hooks/useChat';
import ModelSelector from './MessageInputActions/ChatModelSelector';
import { buildQuotedMessage } from '@/lib/quote';

const MessageInput = ({
  placeholder = 'Ask a follow-up',
  autoFocus = false,
}: {
  placeholder?: string;
  autoFocus?: boolean;
}) => {
  const { loading, sendMessage, stopMessage, quotedText, setQuotedText } =
    useChat();

  const [message, setMessage] = useState('');

  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;

      const isInputFocused =
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        activeElement?.hasAttribute('contenteditable');

      if (e.key === '/' && !isInputFocused) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    if (autoFocus) inputRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [autoFocus]);

  useEffect(() => {
    if (quotedText) inputRef.current?.focus();
  }, [quotedText]);

  const submit = () => {
    if (loading || message.trim().length === 0) return;
    sendMessage(
      quotedText ? buildQuotedMessage(quotedText, message.trim()) : message,
    );
    setMessage('');
    setQuotedText('');
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          submit();
        }
      }}
      className="relative w-full"
    >
      <div className="flex flex-col bg-light-secondary dark:bg-dark-secondary px-3 pt-5 pb-3 rounded-2xl w-full border border-light-200 dark:border-dark-200 shadow-sm shadow-light-200/10 dark:shadow-black/20 transition-all duration-200 focus-within:border-light-300 dark:focus-within:border-dark-300">
        {quotedText && (
          <div className="flex flex-row items-start gap-2 mx-2 -mt-2 mb-3 px-3 py-2 rounded-lg bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200">
            <Quote
              size={14}
              className="shrink-0 mt-0.5 text-black/40 dark:text-white/40"
            />
            <p className="flex-1 text-xs text-black/70 dark:text-white/70 line-clamp-2 whitespace-pre-line">
              {quotedText}
            </p>
            <button
              type="button"
              onClick={() => setQuotedText('')}
              aria-label="Remove quote"
              className="shrink-0 p-0.5 rounded text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors duration-150"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <TextareaAutosize
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          minRows={2}
          className="px-2 bg-transparent placeholder:text-[15px] placeholder:text-black/50 dark:placeholder:text-white/50 text-sm text-black dark:text-white resize-none focus:outline-none w-full max-h-24 lg:max-h-36 xl:max-h-48"
          placeholder={quotedText ? 'Ask about the selected text' : placeholder}
        />
        <div className="flex flex-row items-center justify-between mt-4">
          <Optimization />
          <div className="flex flex-row items-center space-x-2">
            <div className="flex flex-row items-center space-x-1">
              <Sources />
              <ModelSelector />
              <Attach />
            </div>
            {loading ? (
              <button
                type="button"
                onClick={stopMessage}
                aria-label="Stop answering"
                title="Stop answering"
                className="bg-black dark:bg-white text-white dark:text-black hover:bg-opacity-85 transition duration-100 rounded-full p-2"
              >
                <Square size={17} className="fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={message.trim().length === 0}
                aria-label="Send message"
                className="bg-sky-500 text-white disabled:text-black/50 dark:disabled:text-white/50 disabled:bg-[#e0e0dc] dark:disabled:bg-[#ececec21] hover:bg-opacity-85 transition duration-100 rounded-full p-2"
              >
                <ArrowRight className="bg-background" size={17} />
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
};

export default MessageInput;
