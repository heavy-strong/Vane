import path from 'node:path';
import fs from 'fs';
import { Config, ConfigModelProvider, UIConfigSections } from './types';
import { hashObj } from '../utils/hash';
import { getModelProvidersUIConfigSection } from '../models/providers';

class ConfigManager {
  configPath: string = path.join(
    process.env.DATA_DIR || process.cwd(),
    '/data/config.json',
  );
  configVersion = 1;
  currentConfig: Config = {
    version: this.configVersion,
    setupComplete: false,
    preferences: {},
    personalization: {},
    modelProviders: [],
    search: {
      searxngURL: '',
    },
  };
  uiConfigSections: UIConfigSections = {
    preferences: [
      {
        name: 'Theme',
        key: 'theme',
        type: 'select',
        options: [
          {
            name: 'Light',
            value: 'light',
          },
          {
            name: 'Dark',
            value: 'dark',
          },
        ],
        required: false,
        description: 'Choose between light and dark layouts for the app.',
        default: 'dark',
        scope: 'client',
      },
      {
        name: 'Measurement Unit',
        key: 'measureUnit',
        type: 'select',
        options: [
          {
            name: 'Imperial',
            value: 'Imperial',
          },
          {
            name: 'Metric',
            value: 'Metric',
          },
        ],
        required: false,
        description: 'Choose between Metric  and Imperial measurement unit.',
        default: 'Metric',
        scope: 'client',
      },
      {
        name: 'Auto video & image search',
        key: 'autoMediaSearch',
        type: 'switch',
        required: false,
        description: 'Automatically search for relevant images and videos.',
        default: true,
        scope: 'client',
      },
      {
        name: 'Show weather widget',
        key: 'showWeatherWidget',
        type: 'switch',
        required: false,
        description: 'Display the weather card on the home screen.',
        default: true,
        scope: 'client',
      },
      {
        name: 'Show news widget',
        key: 'showNewsWidget',
        type: 'switch',
        required: false,
        description: 'Display the recent news card on the home screen.',
        default: true,
        scope: 'client',
      },
      {
        name: 'Decode citation URLs',
        key: 'decodeCitationUrls',
        type: 'switch',
        required: false,
        description:
          'Show citation URLs decoded (e.g. Korean characters instead of %EC%95%88...) when copying or viewing them.',
        default: true,
        scope: 'client',
      },
    ],
    shortcuts: [
      {
        name: 'New question',
        key: 'newQuestionShortcut',
        type: 'shortcut',
        required: false,
        description:
          'Open a fresh chat from anywhere in Vane. Click the shortcut and press the key combination you want to use.',
        default: 'Ctrl+Alt+N',
        scope: 'client',
      },
    ],
    personalization: [
      {
        name: 'System Instructions',
        key: 'systemInstructions',
        type: 'textarea',
        required: false,
        description: 'Add custom behavior or tone for the model.',
        placeholder:
          'e.g., "Respond in a friendly and concise tone" or "Use British English and format answers as bullet points."',
        scope: 'client',
      },
    ],
    modelProviders: [],
    search: [
      {
        name: 'SearXNG URL',
        key: 'searxngURL',
        type: 'string',
        required: false,
        description: 'The URL of your SearXNG instance',
        placeholder: 'http://localhost:4000',
        default: '',
        scope: 'server',
        env: 'SEARXNG_API_URL',
      },
      {
        name: 'Web search engines',
        key: 'webEngines',
        type: 'engines',
        category: 'general',
        required: false,
        description:
          'Engines used for web searches. Leave everything unchecked to use the engines enabled by default in SearXNG.',
        default: [],
        scope: 'server',
      },
      {
        name: 'Image search engines',
        key: 'imageEngines',
        type: 'engines',
        category: 'images',
        required: false,
        description: 'Engines used when searching for images.',
        default: ['bing images', 'google images'],
        scope: 'server',
      },
      {
        name: 'Video search engines',
        key: 'videoEngines',
        type: 'engines',
        category: 'videos',
        required: false,
        description:
          'Engines used when searching for videos. Only videos with an embeddable player (e.g. YouTube) can be played inline.',
        default: ['youtube'],
        scope: 'server',
      },
      {
        name: 'Boost Korean queries',
        key: 'koreanBoost',
        type: 'switch',
        required: false,
        description:
          'When a query contains Hangul, add the Korean engines below and search with language set to Korean.',
        default: true,
        scope: 'server',
      },
      {
        name: 'Korean web engines',
        key: 'koreanEngines',
        type: 'engines',
        category: 'general',
        required: false,
        description:
          'Extra engines added to web searches for Korean queries when "Boost Korean queries" is on.',
        default: ['naver'],
        scope: 'server',
      },
    ],
  };

  constructor() {
    this.initialize();
  }

  private initialize() {
    this.initializeConfig();
    this.initializeFromEnv();
  }

  private saveConfig() {
    fs.writeFileSync(
      this.configPath,
      JSON.stringify(this.currentConfig, null, 2),
    );
  }

  private initializeConfig() {
    const exists = fs.existsSync(this.configPath);
    if (!exists) {
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.currentConfig, null, 2),
      );
    } else {
      try {
        this.currentConfig = JSON.parse(
          fs.readFileSync(this.configPath, 'utf-8'),
        );
      } catch (err) {
        if (err instanceof SyntaxError) {
          console.error(
            `Error parsing config file at ${this.configPath}:`,
            err,
          );
          console.log(
            'Loading default config and overwriting the existing file.',
          );
          fs.writeFileSync(
            this.configPath,
            JSON.stringify(this.currentConfig, null, 2),
          );
          return;
        } else {
          console.log('Unknown error reading config file:', err);
        }
      }

      this.currentConfig = this.migrateConfig(this.currentConfig);
    }
  }

  private migrateConfig(config: Config): Config {
    config.modelProviders = Array.isArray(config.modelProviders)
      ? config.modelProviders
      : [];
    config.search = config.search ?? {};

    const uniqueModels = (models: ConfigModelProvider['chatModels']) => [
      ...new Map(
        (Array.isArray(models) ? models : [])
          .filter((model) => model?.key && model?.name)
          .map((model) => [model.key, model]),
      ).values(),
    ];

    config.modelProviders.forEach((provider) => {
      provider.config = provider.config ?? {};
      provider.chatModels = uniqueModels(provider.chatModels);
      provider.embeddingModels = uniqueModels(provider.embeddingModels);
      provider.disabledChatModelKeys = [
        ...new Set(provider.disabledChatModelKeys ?? []),
      ];
      provider.disabledEmbeddingModelKeys = [
        ...new Set(provider.disabledEmbeddingModelKeys ?? []),
      ];
      provider.hash = hashObj(provider.config);
    });

    return config;
  }

  private initializeFromEnv() {
    /* providers section*/
    const providerConfigSections = getModelProvidersUIConfigSection();

    this.uiConfigSections.modelProviders = providerConfigSections;

    const newProviders: ConfigModelProvider[] = [];

    providerConfigSections.forEach((provider) => {
      const newProvider: ConfigModelProvider & { required?: string[] } = {
        id: crypto.randomUUID(),
        name: `${provider.name}`,
        type: provider.key,
        chatModels: [],
        embeddingModels: [],
        config: {},
        required: [],
        hash: '',
      };

      provider.fields.forEach((field) => {
        newProvider.config[field.key] =
          process.env[field.env!] ||
          field.default ||
          ''; /* Env var must exist for providers */

        if (field.required) newProvider.required?.push(field.key);
      });

      let configured = true;

      newProvider.required?.forEach((r) => {
        if (!newProvider.config[r]) {
          configured = false;
        }
      });

      if (configured) {
        const hash = hashObj(newProvider.config);
        newProvider.hash = hash;
        delete newProvider.required;

        const exists = this.currentConfig.modelProviders.find(
          (p) => p.hash === hash,
        );

        if (!exists) {
          newProviders.push(newProvider);
        }
      }
    });

    this.currentConfig.modelProviders.push(...newProviders);

    /* search section */
    this.uiConfigSections.search.forEach((f) => {
      if (f.env && !this.currentConfig.search[f.key]) {
        this.currentConfig.search[f.key] =
          process.env[f.env] ?? f.default ?? '';
      }
    });

    this.saveConfig();
  }

  public getConfig(key: string, defaultValue?: any): any {
    const nested = key.split('.');
    let obj: any = this.currentConfig;

    for (let i = 0; i < nested.length; i++) {
      const part = nested[i];
      if (obj == null) return defaultValue;

      obj = obj[part];
    }

    return obj === undefined ? defaultValue : obj;
  }

  public updateConfig(key: string, val: any) {
    const parts = key.split('.');
    if (parts.length === 0) return;

    let target: any = this.currentConfig;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (target[part] === null || typeof target[part] !== 'object') {
        target[part] = {};
      }

      target = target[part];
    }

    const finalKey = parts[parts.length - 1];
    target[finalKey] = val;

    this.saveConfig();
  }

  public addModelProvider(type: string, name: string, config: any) {
    const newModelProvider: ConfigModelProvider = {
      id: crypto.randomUUID(),
      name,
      type,
      config,
      chatModels: [],
      embeddingModels: [],
      hash: hashObj(config),
    };

    this.currentConfig.modelProviders.push(newModelProvider);
    this.saveConfig();

    return newModelProvider;
  }

  public removeModelProvider(id: string) {
    const index = this.currentConfig.modelProviders.findIndex(
      (p) => p.id === id,
    );

    if (index === -1) throw new Error('Provider not found');

    this.currentConfig.modelProviders =
      this.currentConfig.modelProviders.filter((p) => p.id !== id);

    this.saveConfig();
  }

  public async updateModelProvider(id: string, name: string, config: any) {
    const provider = this.currentConfig.modelProviders.find((p) => {
      return p.id === id;
    });

    if (!provider) throw new Error('Provider not found');

    provider.name = name;
    provider.config = config;
    provider.hash = hashObj(config);

    this.saveConfig();

    return provider;
  }

  public addProviderModel(
    providerId: string,
    type: 'embedding' | 'chat',
    model: any,
  ) {
    const provider = this.currentConfig.modelProviders.find(
      (p) => p.id === providerId,
    );

    if (!provider) throw new Error('Invalid provider id');

    const modelToSave = { ...model };
    delete modelToSave.type;

    const models =
      type === 'chat' ? provider.chatModels : provider.embeddingModels;
    if (models.some((existingModel) => existingModel.key === modelToSave.key)) {
      throw new Error(`Model already exists: ${modelToSave.key}`);
    }

    models.push(modelToSave);
    const disabledKey =
      type === 'chat' ? 'disabledChatModelKeys' : 'disabledEmbeddingModelKeys';
    provider[disabledKey] = (provider[disabledKey] ?? []).filter(
      (key) => key !== modelToSave.key,
    );

    this.saveConfig();

    return modelToSave;
  }

  public removeProviderModel(
    providerId: string,
    type: 'embedding' | 'chat',
    modelKey: string,
  ) {
    const provider = this.currentConfig.modelProviders.find(
      (p) => p.id === providerId,
    );

    if (!provider) throw new Error('Invalid provider id');

    const models =
      type === 'chat' ? provider.chatModels : provider.embeddingModels;
    if (!models.some((model) => model.key === modelKey)) {
      throw new Error(`Model not found: ${modelKey}`);
    }

    if (type === 'chat') {
      provider.chatModels = provider.chatModels.filter(
        (m) => m.key !== modelKey,
      );
      provider.disabledChatModelKeys = [
        ...new Set([...(provider.disabledChatModelKeys ?? []), modelKey]),
      ];
    } else {
      provider.embeddingModels = provider.embeddingModels.filter(
        (m) => m.key != modelKey,
      );
      provider.disabledEmbeddingModelKeys = [
        ...new Set([...(provider.disabledEmbeddingModelKeys ?? []), modelKey]),
      ];
    }

    this.saveConfig();
  }

  public isSetupComplete() {
    return this.currentConfig.setupComplete;
  }

  public markSetupComplete() {
    if (!this.currentConfig.setupComplete) {
      this.currentConfig.setupComplete = true;
    }

    this.saveConfig();
  }

  public getUIConfigSections(): UIConfigSections {
    return this.uiConfigSections;
  }

  public getCurrentConfig(): Config {
    return JSON.parse(JSON.stringify(this.currentConfig));
  }
}

const configManager = new ConfigManager();

export default configManager;
