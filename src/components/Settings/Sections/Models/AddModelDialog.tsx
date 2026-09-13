import { Dialog, DialogPanel } from '@headlessui/react';
import { Loader2, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ConfigModelProvider } from '@/lib/config/types';
import { Model } from '@/lib/models/types';
import { toast } from 'sonner';

const AddModel = ({
  providerId,
  providerType,
  existingModels,
  setProviders,
  type,
}: {
  providerId: string;
  providerType: string;
  existingModels: Model[];
  setProviders: React.Dispatch<React.SetStateAction<ConfigModelProvider[]>>;
  type: 'chat' | 'embedding';
}) => {
  const isOpenRouter = providerType === 'openrouter';
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [selected, setSelected] = useState<Model>();
  const [catalog, setCatalog] = useState<Model[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredCatalog = useMemo(() => {
    const query = search.trim().toLowerCase();
    const available = catalog.filter(
      (model) => !existingModels.some((existing) => existing.key === model.key),
    );
    return query
      ? available.filter(
          (model) =>
            model.name.toLowerCase().includes(query) ||
            model.key.toLowerCase().includes(query),
        )
      : available;
  }, [catalog, existingModels, search]);

  const openDialog = async () => {
    setOpen(true);
    if (!isOpenRouter || catalog.length) return;

    setCatalogLoading(true);
    try {
      const res = await fetch(
        `/api/providers/${providerId}/models?type=${type}`,
      );
      if (!res.ok) throw new Error('Failed to fetch OpenRouter models');
      setCatalog(((await res.json()) as { models: Model[] }).models ?? []);
    } catch (error) {
      console.error('Error loading OpenRouter model catalog:', error);
      toast.error('Failed to load the OpenRouter model catalog.');
    } finally {
      setCatalogLoading(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const model = selected ?? { name, key };
    if (!model.name || !model.key) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/providers/${providerId}/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...model, type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add model');
      const savedModel = (data.model ?? model) as Model;

      setProviders((providers) =>
        providers.map((provider) =>
          provider.id !== providerId
            ? provider
            : {
                ...provider,
                chatModels:
                  data.provider?.chatModels ??
                  (type === 'chat'
                    ? [...provider.chatModels, savedModel]
                    : provider.chatModels),
                embeddingModels:
                  data.provider?.embeddingModels ??
                  (type === 'embedding'
                    ? [...provider.embeddingModels, savedModel]
                    : provider.embeddingModels),
              },
        ),
      );
      window.dispatchEvent(new Event('providers-changed'));
      toast.success('Model added successfully.');
      setName('');
      setKey('');
      setSelected(undefined);
      setOpen(false);
    } catch (error) {
      console.error('Error adding model:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to add model.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={openDialog}
        className="text-xs text-black/70 dark:text-white/70 hover:text-black hover:dark:text-white flex flex-row items-center space-x-1 active:scale-95 transition duration-200"
      >
        <Plus size={12} />
        <span>Add</span>
      </button>
      <AnimatePresence>
        {open && (
          <Dialog
            static
            open={open}
            onClose={() => setOpen(false)}
            className="relative z-[60]"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 flex w-screen items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
            >
              <DialogPanel className="w-full mx-4 lg:w-[600px] max-h-[85vh] flex flex-col border bg-light-primary dark:bg-dark-primary border-light-secondary dark:border-dark-secondary rounded-lg">
                <div className="px-6 pt-6 pb-4">
                  <h3 className="text-black/90 dark:text-white/90 font-medium text-sm">
                    Add new {type === 'chat' ? 'chat' : 'embedding'} model
                  </h3>
                </div>
                <div className="border-t border-light-200 dark:border-dark-200" />
                <form
                  onSubmit={submit}
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <div className="flex-1 overflow-y-auto px-6 py-4">
                    {isOpenRouter ? (
                      <div className="flex flex-col gap-3">
                        <div className="relative">
                          <Search
                            size={15}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40"
                          />
                          <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search OpenRouter models..."
                            className="w-full rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary py-2 pl-8 pr-3 text-xs text-black dark:text-white focus:outline-none"
                          />
                        </div>
                        {catalogLoading ? (
                          <div className="flex justify-center py-10">
                            <Loader2 className="animate-spin" size={20} />
                          </div>
                        ) : (
                          <div className="max-h-[420px] overflow-y-auto rounded-lg border border-light-200 dark:border-dark-200 p-1">
                            {filteredCatalog.map((model) => (
                              <button
                                key={model.key}
                                type="button"
                                onClick={() => setSelected(model)}
                                className={`w-full rounded-md px-3 py-2 text-left text-xs transition ${selected?.key === model.key ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400' : 'hover:bg-light-secondary dark:hover:bg-dark-secondary text-black/75 dark:text-white/75'}`}
                              >
                                <div className="font-medium">{model.name}</div>
                                <div className="mt-0.5 truncate text-[10px] opacity-60">
                                  {model.key}
                                </div>
                              </button>
                            ))}
                            {!filteredCatalog.length && (
                              <p className="py-10 text-center text-xs text-black/50 dark:text-white/50">
                                No matching models found.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col space-y-4">
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Model name"
                          className="w-full rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary px-4 py-3 text-sm"
                          required
                        />
                        <input
                          value={key}
                          onChange={(e) => setKey(e.target.value)}
                          placeholder="Model key"
                          className="w-full rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary px-4 py-3 text-sm"
                          required
                        />
                      </div>
                    )}
                  </div>
                  <div className="border-t border-light-200 dark:border-dark-200 px-6 py-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={saving || (isOpenRouter && !selected)}
                      className="px-4 py-2 rounded-lg text-[13px] bg-sky-500 text-white font-medium disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        'Add Model'
                      )}
                    </button>
                  </div>
                </form>
              </DialogPanel>
            </motion.div>
          </Dialog>
        )}
      </AnimatePresence>
    </>
  );
};

export default AddModel;
