import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';
import BaseEmbedding from '../../base/embedding';
import BaseLLM from '../../base/llm';
import BaseModelProvider from '../../base/provider';
import {
  GenerateOptions,
  Model,
  ModelList,
  ProviderMetadata,
  ReasoningEffort,
} from '../../types';
import OpenAILLM from '../openai/openaiLLM';
import OpenAIEmbedding from '../openai/openaiEmbedding';

interface OpenRouterConfig {
  apiKey: string;
}

type OpenRouterModel = {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  architecture?: {
    output_modalities?: string[];
  };
  reasoning?: {
    supported_efforts?: ReasoningEffort[] | null;
    default_effort?: ReasoningEffort;
    default_enabled?: boolean;
    mandatory?: boolean;
    supports_max_tokens?: boolean;
  };
};

const MODEL_CACHE_TTL_MS = 5 * 60 * 1000;
let modelCache: { expiresAt: number; models: OpenRouterModel[] } | undefined;

const providerConfigFields: UIConfigField[] = [
  {
    type: 'password',
    name: 'API Key',
    key: 'apiKey',
    description: 'Your OpenRouter API key',
    required: true,
    placeholder: 'OpenRouter API Key',
    env: 'OPENROUTER_API_KEY',
    scope: 'server',
  },
];

class OpenRouterProvider extends BaseModelProvider<OpenRouterConfig> {
  async getDefaultModels(): Promise<ModelList> {
    let models = modelCache?.models;

    if (!models || modelCache!.expiresAt <= Date.now()) {
      const response = await fetch(
        'https://openrouter.ai/api/v1/models?output_modalities=all',
        {
          headers: { Authorization: `Bearer ${this.config.apiKey}` },
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (!response.ok) {
        throw new Error(
          `OpenRouter model list request failed (${response.status})`,
        );
      }

      const payload = (await response.json()) as { data?: OpenRouterModel[] };
      models = payload.data ?? [];
      modelCache = { models, expiresAt: Date.now() + MODEL_CACHE_TTL_MS };
    }

    const toModel = (model: OpenRouterModel): Model => ({
      key: model.id,
      name: model.name || model.id,
      description: model.description,
      contextLength: model.context_length,
      pricing: model.pricing,
      reasoning: model.reasoning
        ? {
            supportedEfforts: model.reasoning.supported_efforts,
            defaultEffort: model.reasoning.default_effort,
            defaultEnabled: model.reasoning.default_enabled,
            mandatory: model.reasoning.mandatory,
            supportsMaxTokens: model.reasoning.supports_max_tokens,
          }
        : undefined,
    });
    const chat = models
      .filter((model) =>
        model.architecture?.output_modalities?.includes('text'),
      )
      .map(toModel);
    const embedding = models
      .filter((model) =>
        model.architecture?.output_modalities?.includes('embeddings'),
      )
      .map(toModel);

    return { chat, embedding };
  }

  async getModelList(): Promise<ModelList> {
    const configured = getConfiguredModelProviderById(this.id)!;
    return {
      chat: configured.chatModels.filter(
        (model) => !configured.disabledChatModelKeys?.includes(model.key),
      ),
      embedding: configured.embeddingModels.filter(
        (model) => !configured.disabledEmbeddingModelKeys?.includes(model.key),
      ),
    };
  }

  async getModelCatalog(): Promise<ModelList> {
    return this.getDefaultModels();
  }

  async loadChatModel(
    key: string,
    options?: GenerateOptions,
  ): Promise<BaseLLM<any>> {
    const modelList = await this.getModelList();
    if (!modelList.chat.some((model) => model.key === key)) {
      throw new Error(
        'Error Loading OpenRouter Chat Model. Invalid Model Selected',
      );
    }

    // NOTE: measured directly against OpenRouter (see conversation) -
    // leaving `reasoning` unset already performs the same as (or better
    // than) forcing an explicit effort for google/gemini-3.8-flash, and the
    // model's own declared `defaultEffort` ("medium") is measurably slower
    // than sending nothing. So: no synthesized default here on purpose.
    return new OpenAILLM({
      apiKey: this.config.apiKey,
      model: key,
      baseURL: 'https://openrouter.ai/api/v1',
      options,
    });
  }

  async loadEmbeddingModel(key: string): Promise<BaseEmbedding<any>> {
    const modelList = await this.getModelList();
    if (!modelList.embedding.some((model) => model.key === key)) {
      throw new Error(
        'Error Loading OpenRouter Embedding Model. Invalid Model Selected',
      );
    }

    return new OpenAIEmbedding({
      apiKey: this.config.apiKey,
      model: key,
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }

  static parseAndValidate(raw: any): OpenRouterConfig {
    if (!raw || typeof raw !== 'object' || !raw.apiKey) {
      throw new Error(
        'Invalid config provided. OpenRouter API key must be provided',
      );
    }
    return { apiKey: String(raw.apiKey) };
  }

  static getProviderConfigFields(): UIConfigField[] {
    return providerConfigFields;
  }

  static getProviderMetadata(): ProviderMetadata {
    return { key: 'openrouter', name: 'OpenRouter' };
  }
}

export default OpenRouterProvider;
