'use client';

/* eslint-disable @next/next/no-img-element */
import React, {
  MutableRefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';
import {
  BookCopy,
  Disc3,
  Volume2,
  StopCircle,
  CornerDownRight,
  Cpu,
  Clock,
  ImagesIcon,
  VideoIcon,
} from 'lucide-react';
import Markdown, { MarkdownToJSX, RuleType } from 'markdown-to-jsx';
import ExternalAnchor from './ExternalAnchor';
import Copy from './MessageActions/Copy';
import Rewrite from './MessageActions/Rewrite';
import MessageSources from './MessageSources';
import SearchImages, { SearchImage } from './SearchImages';
import SearchVideos, { SearchVideo } from './SearchVideos';
import SourcesPanel from './SourcesPanel';
import { SourcesProvider } from './SourcesContext';
import MessageTabs, { MessageTab } from './MessageTabs';
import { useMediaSearch, MediaStatus } from '@/lib/hooks/useMediaSearch';
import { AUTO_MEDIA_SEARCH_EVENT } from '@/lib/hooks/useChat';
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

type TabId = 'answer' | 'sources' | 'images' | 'videos';

// Height of the sticky chat navbar the tab bar sits under.
const NAVBAR_HEIGHT = 65;

const mediaCount = (status: MediaStatus, count: number) =>
  status === 'done' ? count : undefined;

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

  const [tab, setTab] = useState<TabId>('answer');
  const tabsAnchorRef = useRef<HTMLDivElement | null>(null);

  const images = useMediaSearch<SearchImage>(
    'images',
    section.message.query,
    chatHistory,
  );
  const videos = useMediaSearch<SearchVideo>(
    'videos',
    section.message.query,
    chatHistory,
  );

  const { messageId } = section.message;
  const loadImages = images.load;
  const loadVideos = videos.load;

  useEffect(() => {
    const handleAutoMediaSearch = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== messageId) return;
      loadImages();
      loadVideos();
    };

    window.addEventListener(AUTO_MEDIA_SEARCH_EVENT, handleAutoMediaSearch);
    return () =>
      window.removeEventListener(
        AUTO_MEDIA_SEARCH_EVENT,
        handleAutoMediaSearch,
      );
  }, [messageId, loadImages, loadVideos]);

  const selectTab = (id: TabId) => {
    setTab(id);
    if (id === 'images') loadImages();
    if (id === 'videos') loadVideos();

    // When the tab bar is stuck under the navbar, the new tab would otherwise
    // open part-way down (or past the end of) its content.
    const anchor = tabsAnchorRef.current;
    if (anchor && anchor.getBoundingClientRect().top < NAVBAR_HEIGHT) {
      window.scrollTo({
        top:
          window.scrollY + anchor.getBoundingClientRect().top - NAVBAR_HEIGHT,
      });
    }
  };

  const answering = isLast && loading;

  const tabs: MessageTab[] = [
    { id: 'answer', label: 'Answer', icon: Disc3, busy: answering },
    ...(sources.length > 0
      ? [
          {
            id: 'sources',
            label: 'Sources',
            icon: BookCopy,
            count: sources.length,
          },
        ]
      : []),
    ...(hasContent
      ? [
          {
            id: 'images',
            label: 'Images',
            icon: ImagesIcon,
            count: mediaCount(images.status, images.items.length),
          },
          {
            id: 'videos',
            label: 'Videos',
            icon: VideoIcon,
            count: mediaCount(videos.status, videos.items.length),
          },
        ]
      : []),
  ];

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
        a: {
          component: ExternalAnchor,
        },
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

      <SourcesProvider sources={sources}>
        <div className="flex flex-col lg:flex-row lg:justify-between lg:space-x-9">
          <div ref={dividerRef} className="flex flex-col w-full lg:w-9/12">
            <div ref={tabsAnchorRef} />
            <MessageTabs
              tabs={tabs}
              active={tab}
              onChange={(id) => selectTab(id as TabId)}
              idPrefix={messageId}
            />

            {tab === 'sources' && (
              <div
                role="tabpanel"
                id={`${messageId}-panel-sources`}
                aria-labelledby={`${messageId}-tab-sources`}
                className="pt-2"
              >
                <MessageSources sources={sources} />
              </div>
            )}

            {tab === 'images' && (
              <div
                role="tabpanel"
                id={`${messageId}-panel-images`}
                aria-labelledby={`${messageId}-tab-images`}
                className="pt-5"
              >
                <SearchImages
                  images={images.items}
                  status={images.status}
                  onRetry={loadImages}
                />
              </div>
            )}

            {tab === 'videos' && (
              <div
                role="tabpanel"
                id={`${messageId}-panel-videos`}
                aria-labelledby={`${messageId}-tab-videos`}
                className="pt-5"
              >
                <SearchVideos
                  videos={videos.items}
                  status={videos.status}
                  onRetry={loadVideos}
                />
              </div>
            )}

            {/* Hidden rather than unmounted, so coming back to the answer does
              not parse its markdown again. */}
            <div
              role="tabpanel"
              id={`${messageId}-panel-answer`}
              aria-labelledby={`${messageId}-tab-answer`}
              className={cn(
                'flex flex-col space-y-6 pt-6',
                tab !== 'answer' && 'hidden',
              )}
            >
              {section.message.responseBlocks
                .filter(
                  (block): block is ResearchBlock =>
                    block.type === 'research' && block.data.subSteps.length > 0,
                )
                .map((researchBlock) => (
                  <div
                    key={researchBlock.id}
                    className="flex flex-col space-y-2"
                  >
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

              {section.widgets.length > 0 && (
                <Renderer widgets={section.widgets} />
              )}

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
                                {
                                  splitModelName(section.message.modelName)
                                    .label
                                }
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
                          <Copy
                            initialMessage={parsedMessage}
                            section={section}
                          />
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
          </div>

          <div className="hidden lg:block lg:w-3/12">
            {tab === 'answer' && sources.length > 0 && (
              <div className="sticky top-20 pb-4">
                <SourcesPanel
                  sources={sources}
                  onShowAll={() => selectTab('sources')}
                />
              </div>
            )}
          </div>
        </div>
      </SourcesProvider>
    </div>
  );
};

export default MessageBox;
