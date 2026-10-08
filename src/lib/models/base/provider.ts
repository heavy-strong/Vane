import { GenerateOptions, ModelList, ProviderMetadata } from '../types';
import { UIConfigField } from '@/lib/config/types';
import BaseLLM from './llm';
import BaseEmbedding from './embedding';

abstract class BaseModelProvider<CONFIG> {
  constructor(
    protected id: string,
    protected name: string,
    protected config: CONFIG,
  ) {}
  abstract getDefaultModels(): Promise<ModelList>;
  abstract getModelList(): Promise<ModelList>;
  getModelCatalog?(): Promise<ModelList>;
  abstract loadChatModel(
    modelName: string,
    options?: GenerateOptions,
  ): Promise<BaseLLM<any>>;
  abstract loadEmbeddingModel(modelName: string): Promise<BaseEmbedding<any>>;
  static getProviderConfigFields(): UIConfigField[] {
    throw new Error('Method not implemented.');
  }
  static getProviderMetadata(): ProviderMetadata {
    throw new Error('Method not Implemented.');
  }
  static parseAndValidate(raw: any): any {
    /* Static methods can't access class type parameters */
    throw new Error('Method not Implemented.');
  }
}

export type ProviderConstructor<CONFIG> = {
  new (id: string, name: string, config: CONFIG): BaseModelProvider<CONFIG>;
  parseAndValidate(raw: any): CONFIG;
  getProviderConfigFields: () => UIConfigField[];
  getProviderMetadata: () => ProviderMetadata;
};

const DEFAULT_MODELS_TTL_MS = 60 * 1000;

/* Providers are created for every request, and most fetch their model list
   from a remote API, which a single question would otherwise do several
   times (loading the model, its display name, suggestions, media search).
   Failed lookups are not kept. */
const defaultModelsCache = new Map<
  string,
  { expiresAt: number; models: Promise<ModelList> }
>();

const cachedDefaultModels = (
  key: string,
  load: () => Promise<ModelList>,
): Promise<ModelList> => {
  const cached = defaultModelsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.models;

  const models = load();
  defaultModelsCache.set(key, {
    expiresAt: Date.now() + DEFAULT_MODELS_TTL_MS,
    models,
  });
  models.catch(() => {
    if (defaultModelsCache.get(key)?.models === models) {
      defaultModelsCache.delete(key);
    }
  });

  return models;
};

export const createProviderInstance = <P extends ProviderConstructor<any>>(
  Provider: P,
  id: string,
  name: string,
  rawConfig: unknown,
): InstanceType<P> => {
  const cfg = Provider.parseAndValidate(rawConfig);
  const instance = new Provider(id, name, cfg) as InstanceType<P>;

  // Keyed by the config too, so editing a provider takes effect right away.
  const cacheKey = `${id}:${JSON.stringify(cfg)}`;
  const loadDefaultModels = instance.getDefaultModels.bind(instance);
  instance.getDefaultModels = () =>
    cachedDefaultModels(cacheKey, loadDefaultModels);

  return instance;
};

export default BaseModelProvider;
