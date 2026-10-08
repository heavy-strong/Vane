'use client';

import { createContext, ReactNode, useContext, useState } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Chunk } from '@/lib/types';

const SourcesContext = createContext<Chunk[]>([]);
const ActiveSourceContext = createContext<number | null>(null);
const SetActiveSourceContext = createContext<(index: number | null) => void>(
  () => {},
);

/**
 * Shares a message's sources with its citations and links them to the
 * sources panel: hovering citation N highlights source N there. The setter
 * lives in its own context so citations don't re-render on every hover.
 */
export const SourcesProvider = ({
  sources,
  children,
}: {
  sources: Chunk[];
  children: ReactNode;
}) => {
  const [active, setActive] = useState<number | null>(null);

  return (
    <SourcesContext.Provider value={sources}>
      <SetActiveSourceContext.Provider value={setActive}>
        <ActiveSourceContext.Provider value={active}>
          <Tooltip.Provider delayDuration={150} skipDelayDuration={300}>
            {children}
          </Tooltip.Provider>
        </ActiveSourceContext.Provider>
      </SetActiveSourceContext.Provider>
    </SourcesContext.Provider>
  );
};

export const useSources = () => useContext(SourcesContext);
export const useActiveSource = () => useContext(ActiveSourceContext);
export const useSetActiveSource = () => useContext(SetActiveSourceContext);
