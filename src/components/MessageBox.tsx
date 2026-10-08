'use client';

/* eslint-disable @next/next/no-img-element */
import React, { MutableRefObject, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  BookCopy,
  Disc3,
  Volume2,
  StopCircle,
  CornerDownRight,
  Cpu,
  Clock,
} from 'lucide-react';
import Markdown, { MarkdownToJSX, RuleType } from 'markdown-to-jsx';
import Copy from './MessageActions/Copy';
import Rewrite from './MessageActions/Rewrite';
import MessageSources from './MessageSources';
import SearchImages from './SearchImages';
import SearchVideos from './SearchVideos';
import { useSpeech } from 'react-text-to-speech';
import ThinkBox from './ThinkBox';
import { useChat, Section } from '@/lib/hooks/useChat';
import Citation from './MessageRenderer/Citation';
import AssistantSteps from './AssistantSteps';
import { ResearchBlock } from '@/lib/types';
import { splitModelName } from '@/lib/models/display';
import Renderer from './Widgets/Renderer';
import CodeBlock from './MessageRenderer/CodeBlock';
import TableBlock from './MessageRenderer/TableBlock';
import MathTex, { preprocessMath } from './MessageRenderer/MathTex';
import SelectionPopover from './SelectionPopover';
import MessageQuestion from './MessageQuestion';

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
};

const ThinkTagProcessor = ({
  children,
  thinkingEnded,
}: {
  children: React.ReactNode;
  thinkingEnded: boolean;
}) => {
  return (
    <ThinkBox content={children as string} thinkingEnded={thinkingEnded} />
  );
};

const MessageBox = ({
  section,
  sectionIndex,
  dividerRef,
  isLast,
}: {
  section: Section;
  sectionIndex: number;
  dividerRef?: MutableRefObject<HTMLDivElement | null>;
  isLast: boolean;
}) => {
  const {
    loading,
    sendMessage,
    rewrite,
    messages,
    researchEnded,
    chatHistory,
  } = useChat();

  const parsedMessage = section.parsedTextBlocks.join('\n\n');
  const speechMessage = section.speechMessage || '';
  const thinkingEnded = section.thinkingEnded;

  const sourceBlocks = section.message.responseBlocks.filter(
    (block): block is typeof block & { type: 'source' } =>
      block.type === 'source',
  );

  const sources = sourceBlocks.flatMap((block) => block.data);

  const hasContent = section.parsedTextBlocks.length > 0;

  const answerRef = useRef<HTMLDivElement | null>(null);

  const { speechStatus, start, stop } = useSpeech({ text: speechMessage });

  const markdownOverrides = useMemo<MarkdownToJSX.Options>(
    () => ({
      renderRule(next, node, renderChildren, state) {
        if (node.type === RuleType.codeInline) {
          return `\`${node.text}\``;
        }

        if (node.type === RuleType.codeBlock) {
          return (
            <CodeBlock key={state.key} language={node.lang || ''}>
              {node.text}
            </CodeBlock>
          );
        }

        return next();
      },
      overrides: {
        think: {
          component: ThinkTagProcessor,
          props: {
            thinkingEnded: thinkingEnded,
          },
        },
        citation: {
          component: Citation,
        },
        mathtex: {
          component: MathTex,
        },
        table: {
          component: TableBlock,
        },
      },
    }),
    [thinkingEnded],
  );

  // Parsing the whole answer is the costliest part of rendering a message;
  // keeping the element lets React skip it while other state changes, such
  // as another message streaming in.
  const renderedMarkdown = useMemo(
    () => (
      <Markdown
        className={cn(
          'prose prose-h1:mb-3 prose-h2:mb-2 prose-h2:mt-6 prose-h2:font-[800] prose-h3:mt-4 prose-h3:mb-1.5 prose-h3:font-[600] dark:prose-invert prose-p:leading-relaxed prose-pre:p-0 font-[400]',
          'max-w-none break-words text-black dark:text-white',
        )}
        options={markdownOverrides}
      >
        {preprocessMath(parsedMessage)}
      </Markdown>
    ),
    [markdownOverrides, parsedMessage],
  );

  return (
    <div className="space-y-6">
      <MessageQuestion message={section.message} />

      <div className="flex flex-col space-y-9 lg:space-y-0 lg:flex-row lg:justify-between lg:space-x-9">
        <div
          ref={dividerRef}
          className="flex flex-col space-y-6 w-full lg:w-9/12"
        >
          {sources.length > 0 && (
            <div className="flex flex-col space-y-2">
              <div className="flex flex-row items-center space-x-2">
                <BookCopy className="text-black dark:text-white" size={20} />
                <h3 className="text-black dark:text-white font-medium text-xl">
                  Sources
                </h3>
              </div>
              <MessageSources sources={sources} />
            </div>
          )}

          {section.message.responseBlocks
            .filter(
              (block): block is ResearchBlock =>
                block.type === 'research' && block.data.subSteps.length > 0,
            )
            .map((researchBlock) => (
              <div key={researchBlock.id} className="flex flex-col space-y-2">
                <AssistantSteps
                  block={researchBlock}
                  status={section.message.status}
                  isLast={isLast}
                />
              </div>
            ))}

          {isLast &&
            loading &&
            !researchEnded &&
            !section.message.responseBlocks.some(
              (b) => b.type === 'research' && b.data.subSteps.length > 0,
            ) && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200">
                <Disc3 className="w-4 h-4 text-black dark:text-white animate-spin" />
                <span className="text-sm text-black/70 dark:text-white/70">
                  Brainstorming...
                </span>
              </div>
            )}

          {section.widgets.length > 0 && <Renderer widgets={section.widgets} />}

          <div className="flex flex-col space-y-2">
            {!hasContent &&
              section.message.status === 'completed' &&
              !(loading && isLast) && (
                <div className="flex flex-row items-center justify-between w-full text-black dark:text-white py-2">
                  <span className="text-sm text-black/50 dark:text-white/50">
                    Answer stopped before any text was generated.
                  </span>
                  <Rewrite
                    rewrite={rewrite}
                    messageId={section.message.messageId}
                  />
                </div>
              )}

            {sources.length > 0 && (
              <div className="flex flex-row items-center space-x-2">
                <Disc3
                  className={cn(
                    'text-black dark:text-white',
                    isLast && loading ? 'animate-spin' : 'animate-none',
                  )}
                  size={20}
                />
                <h3 className="text-black dark:text-white font-medium text-xl">
                  Answer
                </h3>
              </div>
            )}

            {hasContent && (
              <>
                <SelectionPopover containerRef={answerRef} />
                <div ref={answerRef}>{renderedMarkdown}</div>

                {loading && isLast ? null : (
                  <div className="flex flex-row items-center justify-between w-full text-black dark:text-white py-4">
                    <div className="flex flex-row items-center -ml-2 gap-1">
                      <Rewrite
                        rewrite={rewrite}
                        messageId={section.message.messageId}
                      />
                      {section.message.modelName && (
                        <div
                          className="flex flex-row items-center gap-1 px-2 py-1 text-xs text-black/50 dark:text-white/50"
                          title={
                            section.message.modelProvider
                              ? `${section.message.modelName} · ${section.message.modelProvider}`
                              : section.message.modelName
                          }
                        >
                          <Cpu size={13} className="shrink-0" />
                          <span className="truncate max-w-[11rem] text-black/70 dark:text-white/70 sm:max-w-[16rem]">
                            {splitModelName(section.message.modelName).label}
                          </span>
                          {section.message.modelProvider && (
                            <span className="hidden truncate max-w-[8rem] text-black/35 dark:text-white/35 sm:inline">
                              · {section.message.modelProvider}
                            </span>
                          )}
                        </div>
                      )}
                      {typeof section.message.durationMs === 'number' && (
                        <div
                          className="flex flex-row items-center gap-1 px-2 py-1 text-xs text-black/50 dark:text-white/50"
                          title={`Answered in ${(section.message.durationMs / 1000).toFixed(2)}s`}
                        >
                          <Clock size={13} className="shrink-0" />
                          <span>
                            {formatDuration(section.message.durationMs)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-row items-center -mr-2">
                      <Copy initialMessage={parsedMessage} section={section} />
                      <button
                        onClick={() => {
                          if (speechStatus === 'started') {
                            stop();
                          } else {
                            start();
                          }
                        }}
                        className="p-2 text-black/70 dark:text-white/70 rounded-full hover:bg-light-secondary dark:hover:bg-dark-secondary transition duration-200 hover:text-black dark:hover:text-white"
                      >
                        {speechStatus === 'started' ? (
                          <StopCircle size={16} />
                        ) : (
                          <Volume2 size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {isLast &&
                  hasContent &&
                  !loading &&
                  (section.suggestionsLoading ||
                    (section.suggestions?.length ?? 0) > 0) && (
                    <div className="mt-4 pt-3 border-t border-light-200/60 dark:border-dark-200/60">
                      {section.suggestionsLoading ? (
                        <div className="flex flex-col animate-pulse">
                          {[0, 1, 2].map((i) => (
                            <div
                              key={i}
                              className="flex flex-row items-center gap-3 px-2 py-2.5"
                            >
                              <div className="h-3.5 w-3.5 rounded bg-light-secondary dark:bg-dark-secondary flex-shrink-0" />
                              <div
                                className={cn(
                                  'h-3.5 rounded-full bg-light-secondary dark:bg-dark-secondary',
                                  i === 1 ? 'w-1/3' : 'w-1/2',
                                )}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          {section.suggestions!.map(
                            (suggestion: string, i: number) => (
                              <button
                                key={i}
                                onClick={() => sendMessage(suggestion)}
                                className="group flex flex-row items-start gap-3 px-2 py-2.5 rounded-lg text-left hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors duration-200"
                              >
                                <CornerDownRight
                                  size={15}
                                  className="mt-0.5 text-black/50 dark:text-white/50 group-hover:text-black dark:group-hover:text-white transition-colors duration-200 flex-shrink-0"
                                />
                                <span className="text-sm text-black/70 dark:text-white/70 group-hover:text-black dark:group-hover:text-white transition-colors duration-200 leading-snug">
                                  {suggestion}
                                </span>
                              </button>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  )}
              </>
            )}
          </div>
        </div>

        {hasContent && (
          <div className="lg:sticky lg:top-20 flex flex-col items-center space-y-3 w-full lg:w-3/12 z-30 h-full pb-4">
            <SearchImages
              query={section.message.query}
              chatHistory={chatHistory}
              messageId={section.message.messageId}
            />
            <SearchVideos
              chatHistory={chatHistory}
              query={section.message.query}
              messageId={section.message.messageId}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBox;
