import { ConfigModelProvider } from '../config/types';
import BaseModelProvider, { createProviderInstance } from './base/provider';
import { getConfiguredModelProviders } from '../config/serverRegistry';
import { providers } from './providers';
import { GenerateOptions, MinimalProvider, ModelList } from './types';
import configManager from '../config';

class ModelRegistry {
  activeProviders: (ConfigModelProvider & {
    provider: BaseModelProvider<any>;
  })[] = [];

  constructor() {
    this.initializeActiveProviders();
  }

  private initializeActiveProviders() {
    const configuredProviders = getConfiguredModelProviders();

    configuredProviders.forEach((p) => {
      try {
        const provider = providers[p.type];
        if (!provider) throw new Error('Invalid provider type');

        this.activeProviders.push({
          ...p,
          provider: createProviderInstance(provider, p.id, p.name, p.config),
        });
      } catch (err) {
        console.error(
          `Failed to initialize provider. Type: ${p.type}, ID: ${p.id}, Config: ${JSON.stringify(p.config)}, Error: ${err}`,
        );
      }
    });
  }

  async getActiveProviders() {
    return Promise.all(
      this.activeProviders.map(async (p): Promise<MinimalProvider> => {
        let m: ModelList = { chat: [], embedding: [] };

        try {
          m = await p.provider.getModelList();
        } catch (err: any) {
          console.error(
            `Failed to get model list. Type: ${p.type}, ID: ${p.id}, Error: ${err.message}`,
          );

          m = {
            chat: [
              {
                key: 'error',
                name: err.message,
              },
            ],
            embedding: [],
          };
        }

        const uniqueModels = (models: ModelList['chat']) => [
          ...new Map(models.map((model) => [model.key, model])).values(),
        ];

        return {
          id: p.id,
          name: p.name,
          type: p.type,
          chatModels: uniqueModels(m.chat),
          embeddingModels: uniqueModels(m.embedding),
        };
      }),
    );
  }

  async loadChatModel(
    providerId: string,
    modelName: string,
    options?: GenerateOptions,
  ) {
    const provider = this.activeProviders.find((p) => p.id === providerId);

    if (!provider) throw new Error('Invalid provider id');

    const model = await provider.provider.loadChatModel(modelName, options);

    return model;
  }

  async getChatModelDisplayInfo(providerId: string, key: string) {
    const provider = this.activeProviders.find((p) => p.id === providerId);

    if (!provider) {
      return { providerName: providerId, modelName: key };
    }

    try {
      const modelList = await provider.provider.getModelList();
      const model = modelList.chat.find((m) => m.key === key);

      return {
        providerName: provider.name,
        modelName: model?.name ?? key,
      };
    } catch (err) {
      return { providerName: provider.name, modelName: key };
    }
  }

  async loadEmbeddingModel(providerId: string, modelName: string) {
    const provider = this.activeProviders.find((p) => p.id === providerId);

    if (!provider) throw new Error('Invalid provider id');

    const model = await provider.provider.loadEmbeddingModel(modelName);

    return model;
  }

  async getProviderModelCatalog(providerId: string): Promise<ModelList> {
    const provider = this.activeProviders.find((p) => p.id === providerId);
    if (!provider) throw new Error('Invalid provider id');
    if (!provider.provider.getModelCatalog) {
      throw new Error('This provider does not expose a model catalog');
    }

    return provider.provider.getModelCatalog();
  }

  async addProvider(
    type: string,
    name: string,
    config: Record<string, any>,
  ): Promise<ConfigModelProvider> {
    const provider = providers[type];
    if (!provider) throw new Error('Invalid provider type');

    const newProvider = configManager.addModelProvider(type, name, config);

    const instance = createProviderInstance(
      provider,
      newProvider.id,
      newProvider.name,
      newProvider.config,
    );

    let m: ModelList = { chat: [], embedding: [] };

    try {
      m = await instance.getModelList();
    } catch (err: any) {
      console.error(
        `Failed to get model list for newly added provider. Type: ${type}, ID: ${newProvider.id}, Error: ${err.message}`,
      );

      m = {
        chat: [
          {
            key: 'error',
            name: err.message,
          },
        ],
        embedding: [],
      };
    }

    this.activeProviders.push({
      ...newProvider,
      provider: instance,
    });

    return {
      ...newProvider,
      chatModels: m.chat || [],
      embeddingModels: m.embedding || [],
    };
  }

  async removeProvider(providerId: string): Promise<void> {
    configManager.removeModelProvider(providerId);
    this.activeProviders = this.activeProviders.filter(
      (p) => p.id !== providerId,
    );

    return;
  }

  async updateProvider(
    providerId: string,
    name: string,
    config: any,
  ): Promise<ConfigModelProvider> {
    const updated = await configManager.updateModelProvider(
      providerId,
      name,
      config,
    );
    const instance = createProviderInstance(
      providers[updated.type],
      providerId,
      name,
      config,
    );

    let m: ModelList = { chat: [], embedding: [] };

    try {
      m = await instance.getModelList();
    } catch (err: any) {
      console.error(
        `Failed to get model list for updated provider. Type: ${updated.type}, ID: ${updated.id}, Error: ${err.message}`,
      );

      m = {
        chat: [
          {
            key: 'error',
            name: err.message,
          },
        ],
        embedding: [],
      };
    }

    this.activeProviders = this.activeProviders.filter(
      (provider) => provider.id !== providerId,
    );
    this.activeProviders.push({
      ...updated,
      provider: instance,
    });

    return {
      ...updated,
      chatModels: m.chat || [],
      embeddingModels: m.embedding || [],
    };
  }

  async addProviderModel(
    providerId: string,
    type: 'embedding' | 'chat',
    model: any,
  ): Promise<any> {
    const provider = this.activeProviders.find((p) => p.id === providerId);
    if (!provider) throw new Error('Invalid provider id');

    let modelToSave = model;
    if (provider.provider.getModelCatalog) {
      const catalog = await provider.provider.getModelCatalog();
      const catalogModel = catalog[type].find(
        (candidate) => candidate.key === model.key,
      );
      if (!catalogModel) throw new Error(`Invalid model key: ${model.key}`);
      modelToSave = catalogModel;
    }

    const addedModel = configManager.addProviderModel(
      providerId,
      type,
      modelToSave,
    );
    return addedModel;
  }

  async removeProviderModel(
    providerId: string,
    type: 'embedding' | 'chat',
    modelKey: string,
  ): Promise<void> {
    configManager.removeProviderModel(providerId, type, modelKey);
    return;
  }
}

export default ModelRegistry;
