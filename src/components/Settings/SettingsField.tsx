import {
  EnginesUIConfigField,
  SelectUIConfigField,
  StringUIConfigField,
  SwitchUIConfigField,
  TextareaUIConfigField,
  UIConfigField,
} from '@/lib/config/types';
import { useEffect, useState } from 'react';
import Select from '../ui/Select';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { Check, Loader2 } from 'lucide-react';
import { Switch } from '@headlessui/react';
import { cn } from '@/lib/utils';

const emitClientConfigChanged = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('client-config-changed'));
  }
};

const SettingsSelect = ({
  field,
  value,
  setValue,
  dataAdd,
}: {
  field: SelectUIConfigField;
  value?: any;
  setValue: (value: any) => void;
  dataAdd: string;
}) => {
  const [loading, setLoading] = useState(false);
  const { setTheme } = useTheme();

  const handleSave = async (newValue: any) => {
    setLoading(true);
    setValue(newValue);
    try {
      if (field.scope === 'client') {
        localStorage.setItem(field.key, newValue);
        if (field.key === 'theme') {
          setTheme(newValue);
        }
        emitClientConfigChanged();
      } else {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: `${dataAdd}.${field.key}`,
            value: newValue,
          }),
        });

        if (!res.ok) {
          console.error('Failed to save config:', await res.text());
          throw new Error('Failed to save configuration');
        }
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save configuration.');
    } finally {
      setTimeout(() => setLoading(false), 150);
    }
  };

  return (
    <section className="rounded-xl border border-light-200 bg-light-primary/80 p-4 lg:p-6 transition-colors dark:border-dark-200 dark:bg-dark-primary/80">
      <div className="space-y-3 lg:space-y-5">
        <div>
          <h4 className="text-sm lg:text-sm text-black dark:text-white">
            {field.name}
          </h4>
          <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">
            {field.description}
          </p>
        </div>
        <Select
          value={value}
          onChange={(event) => handleSave(event.target.value)}
          options={field.options.map((option) => ({
            value: option.value,
            label: option.name,
          }))}
          className="!text-xs lg:!text-sm"
          loading={loading}
          disabled={loading}
        />
      </div>
    </section>
  );
};

const SettingsInput = ({
  field,
  value,
  setValue,
  dataAdd,
}: {
  field: StringUIConfigField;
  value?: any;
  setValue: (value: any) => void;
  dataAdd: string;
}) => {
  const [loading, setLoading] = useState(false);

  const handleSave = async (newValue: any) => {
    setLoading(true);
    setValue(newValue);
    try {
      if (field.scope === 'client') {
        localStorage.setItem(field.key, newValue);
        emitClientConfigChanged();
      } else {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: `${dataAdd}.${field.key}`,
            value: newValue,
          }),
        });

        if (!res.ok) {
          console.error('Failed to save config:', await res.text());
          throw new Error('Failed to save configuration');
        }
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save configuration.');
    } finally {
      setTimeout(() => setLoading(false), 150);
    }
  };

  return (
    <section className="rounded-xl border border-light-200 bg-light-primary/80 p-4 lg:p-6 transition-colors dark:border-dark-200 dark:bg-dark-primary/80">
      <div className="space-y-3 lg:space-y-5">
        <div>
          <h4 className="text-sm lg:text-sm text-black dark:text-white">
            {field.name}
          </h4>
          <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">
            {field.description}
          </p>
        </div>
        <div className="relative">
          <input
            value={value ?? field.default ?? ''}
            onChange={(event) => setValue(event.target.value)}
            onBlur={(event) => handleSave(event.target.value)}
            data-shortcut-setting={
              field.key === 'newQuestionShortcut' ? 'new-question' : undefined
            }
            className="w-full rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary px-3 py-2 lg:px-4 lg:py-3 pr-10 !text-xs lg:!text-[13px] text-black/80 dark:text-white/80 placeholder:text-black/40 dark:placeholder:text-white/40 focus-visible:outline-none focus-visible:border-light-300 dark:focus-visible:border-dark-300 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            placeholder={field.placeholder}
            type="text"
            disabled={loading}
          />
          {loading && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40">
              <Loader2 className="h-4 w-4 animate-spin" />
            </span>
          )}
        </div>
      </div>
    </section>
  );
};

const SettingsTextarea = ({
  field,
  value,
  setValue,
  dataAdd,
}: {
  field: TextareaUIConfigField;
  value?: any;
  setValue: (value: any) => void;
  dataAdd: string;
}) => {
  const [loading, setLoading] = useState(false);

  const handleSave = async (newValue: any) => {
    setLoading(true);
    setValue(newValue);
    try {
      if (field.scope === 'client') {
        localStorage.setItem(field.key, newValue);
        emitClientConfigChanged();
      } else {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: `${dataAdd}.${field.key}`,
            value: newValue,
          }),
        });

        if (!res.ok) {
          console.error('Failed to save config:', await res.text());
          throw new Error('Failed to save configuration');
        }
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save configuration.');
    } finally {
      setTimeout(() => setLoading(false), 150);
    }
  };

  return (
    <section className="rounded-xl border border-light-200 bg-light-primary/80 p-4 lg:p-6 transition-colors dark:border-dark-200 dark:bg-dark-primary/80">
      <div className="space-y-3 lg:space-y-5">
        <div>
          <h4 className="text-sm lg:text-sm text-black dark:text-white">
            {field.name}
          </h4>
          <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">
            {field.description}
          </p>
        </div>
        <div className="relative">
          <textarea
            value={value ?? field.default ?? ''}
            onChange={(event) => setValue(event.target.value)}
            onBlur={(event) => handleSave(event.target.value)}
            className="w-full rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary px-3 py-2 lg:px-4 lg:py-3 pr-10 !text-xs lg:!text-[13px] text-black/80 dark:text-white/80 placeholder:text-black/40 dark:placeholder:text-white/40 focus-visible:outline-none focus-visible:border-light-300 dark:focus-visible:border-dark-300 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            placeholder={field.placeholder}
            rows={4}
            disabled={loading}
          />
          {loading && (
            <span className="pointer-events-none absolute right-3 translate-y-3 text-black/40 dark:text-white/40">
              <Loader2 className="h-4 w-4 animate-spin" />
            </span>
          )}
        </div>
      </div>
    </section>
  );
};

const SettingsSwitch = ({
  field,
  value,
  setValue,
  dataAdd,
}: {
  field: SwitchUIConfigField;
  value?: any;
  setValue: (value: any) => void;
  dataAdd: string;
}) => {
  const [loading, setLoading] = useState(false);

  const handleSave = async (newValue: boolean) => {
    setLoading(true);
    setValue(newValue);
    try {
      if (field.scope === 'client') {
        localStorage.setItem(field.key, String(newValue));
        emitClientConfigChanged();
      } else {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: `${dataAdd}.${field.key}`,
            value: newValue,
          }),
        });

        if (!res.ok) {
          console.error('Failed to save config:', await res.text());
          throw new Error('Failed to save configuration');
        }
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save configuration.');
    } finally {
      setTimeout(() => setLoading(false), 150);
    }
  };

  const isChecked = value === true || value === 'true';

  return (
    <section className="rounded-xl border border-light-200 bg-light-primary/80 p-4 lg:p-6 transition-colors dark:border-dark-200 dark:bg-dark-primary/80">
      <div className="flex flex-row items-center space-x-3 lg:space-x-5 w-full justify-between">
        <div>
          <h4 className="text-sm lg:text-sm text-black dark:text-white">
            {field.name}
          </h4>
          <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">
            {field.description}
          </p>
        </div>
        <Switch
          checked={isChecked}
          onChange={handleSave}
          disabled={loading}
          className="group relative flex h-6 w-12 shrink-0 cursor-pointer rounded-full bg-light-200 dark:bg-white/10 p-1 duration-200 ease-in-out focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed data-[checked]:bg-sky-500 dark:data-[checked]:bg-sky-500"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none inline-block size-4 translate-x-0 rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out group-data-[checked]:translate-x-6"
          />
        </Switch>
      </div>
    </section>
  );
};

type EngineOption = { name: string; enabled: boolean; missing?: boolean };

const SettingsEngines = ({
  field,
  value,
  setValue,
  dataAdd,
}: {
  field: EnginesUIConfigField;
  value?: any;
  setValue: (value: any) => void;
  dataAdd: string;
}) => {
  const [loading, setLoading] = useState(false);
  const [engines, setEngines] = useState<EngineOption[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const selected: string[] = Array.isArray(value) ? value : [];

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/searxng/engines?category=${encodeURIComponent(field.category)}`,
        );
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.message ?? 'Failed to load engines');
        }

        if (!cancelled) {
          setEngines(data.engines ?? []);
          setFetchError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setEngines([]);
          setFetchError(
            err instanceof Error ? err.message : 'Failed to load engines',
          );
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [field.category]);

  const handleSave = async (newValue: string[]) => {
    setLoading(true);
    setValue(newValue);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: `${dataAdd}.${field.key}`,
          value: newValue,
        }),
      });

      if (!res.ok) {
        console.error('Failed to save config:', await res.text());
        throw new Error('Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save configuration.');
    } finally {
      setTimeout(() => setLoading(false), 150);
    }
  };

  const toggle = (name: string) => {
    const next = selected.includes(name)
      ? selected.filter((n) => n !== name)
      : [...selected, name];
    handleSave(next);
  };

  const EngineChip = ({ engine }: { engine: EngineOption }) => {
    const checked = selected.includes(engine.name);

    return (
      <button
        type="button"
        onClick={() => toggle(engine.name)}
        disabled={loading}
        title={
          engine.missing
            ? 'Selected, but no longer available on the SearXNG instance. Click to remove.'
            : engine.enabled
              ? 'Enabled by default in SearXNG'
              : 'Disabled by default in SearXNG (still usable when selected here)'
        }
        className={cn(
          'flex flex-row items-center space-x-1.5 rounded-full border px-3 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60',
          checked
            ? 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400'
            : 'border-light-200 dark:border-dark-200 text-black/70 dark:text-white/70 hover:bg-light-200 dark:hover:bg-dark-200',
          engine.missing &&
            !checked &&
            'border-dashed border-red-300 text-red-500/80 dark:border-red-900 dark:text-red-400/80',
        )}
      >
        {checked ? (
          <Check className="h-3 w-3" />
        ) : (
          <span
            className={cn(
              'h-1.5 w-1.5 shrink-0 rounded-full',
              engine.missing
                ? 'bg-red-400/70'
                : engine.enabled
                  ? 'bg-emerald-500'
                  : 'bg-black/20 dark:bg-white/20',
            )}
          />
        )}
        <span>{engine.name}</span>
      </button>
    );
  };

  /* Keep previously selected engines visible even if SearXNG no longer
   * reports them, so the user can deselect them. */
  const options: EngineOption[] = [
    ...(engines ?? []),
    ...selected
      .filter((name) => !(engines ?? []).some((e) => e.name === name))
      .map((name) => ({ name, enabled: false, missing: true })),
  ];

  /* "Enabled by default" is a SearXNG-side property, independent of whether
   * the user has selected the engine here — group by it so the two concepts
   * (default vs. selected) don't get conflated into a single visual signal. */
  const defaultEngines = options.filter((e) => e.enabled);
  const otherEngines = options.filter((e) => !e.enabled && !e.missing);
  const missingEngines = options.filter((e) => e.missing);

  return (
    <section className="rounded-xl border border-light-200 bg-light-primary/80 p-4 lg:p-6 transition-colors dark:border-dark-200 dark:bg-dark-primary/80">
      <div className="space-y-3 lg:space-y-5">
        <div className="flex flex-row items-start justify-between space-x-3">
          <div>
            <h4 className="text-sm lg:text-sm text-black dark:text-white">
              {field.name}
            </h4>
            <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">
              {field.description}
            </p>
          </div>
          {loading && (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-black/40 dark:text-white/40" />
          )}
        </div>

        {engines === null ? (
          <div className="flex flex-row items-center space-x-2 text-xs text-black/50 dark:text-white/50">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Loading engines from SearXNG…</span>
          </div>
        ) : (
          <>
            {fetchError && (
              <p className="text-[11px] lg:text-xs text-red-500">
                {fetchError}
              </p>
            )}
            {options.length === 0 ? (
              <p className="text-xs text-black/50 dark:text-white/50">
                No engines found for this category.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-row flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-black/40 dark:text-white/40">
                  <span className="flex flex-row items-center space-x-1.5">
                    <Check className="h-3 w-3 text-sky-500" />
                    <span>Selected (used for search)</span>
                  </span>
                  <span className="flex flex-row items-center space-x-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>Enabled by default in SearXNG</span>
                  </span>
                  <span className="flex flex-row items-center space-x-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-black/20 dark:bg-white/20" />
                    <span>Off by default</span>
                  </span>
                </div>

                {defaultEngines.length > 0 && (
                  <div className="space-y-1.5">
                    <h5 className="text-[11px] uppercase tracking-wide text-black/40 dark:text-white/40">
                      Enabled by default
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {defaultEngines.map((engine) => (
                        <EngineChip key={engine.name} engine={engine} />
                      ))}
                    </div>
                  </div>
                )}

                {otherEngines.length > 0 && (
                  <div className="space-y-1.5">
                    <h5 className="text-[11px] uppercase tracking-wide text-black/40 dark:text-white/40">
                      Off by default
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {otherEngines.map((engine) => (
                        <EngineChip key={engine.name} engine={engine} />
                      ))}
                    </div>
                  </div>
                )}

                {missingEngines.length > 0 && (
                  <div className="space-y-1.5">
                    <h5 className="text-[11px] uppercase tracking-wide text-red-500/70">
                      Selected, no longer available
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {missingEngines.map((engine) => (
                        <EngineChip key={engine.name} engine={engine} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

const SettingsField = ({
  field,
  value,
  dataAdd,
}: {
  field: UIConfigField;
  value: any;
  dataAdd: string;
}) => {
  const [val, setVal] = useState(value);

  switch (field.type) {
    case 'select':
      return (
        <SettingsSelect
          field={field}
          value={val}
          setValue={setVal}
          dataAdd={dataAdd}
        />
      );
    case 'string':
      return (
        <SettingsInput
          field={field}
          value={val}
          setValue={setVal}
          dataAdd={dataAdd}
        />
      );
    case 'textarea':
      return (
        <SettingsTextarea
          field={field}
          value={val}
          setValue={setVal}
          dataAdd={dataAdd}
        />
      );
    case 'switch':
      return (
        <SettingsSwitch
          field={field}
          value={val}
          setValue={setVal}
          dataAdd={dataAdd}
        />
      );
    case 'engines':
      return (
        <SettingsEngines
          field={field}
          value={val}
          setValue={setVal}
          dataAdd={dataAdd}
        />
      );
    default:
      return <div>Unsupported field type: {field.type}</div>;
  }
};

export default SettingsField;
