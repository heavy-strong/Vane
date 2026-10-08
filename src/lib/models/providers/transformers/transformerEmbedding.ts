import { Chunk } from '@/lib/types';
import BaseEmbedding from '../../base/embedding';
import { FeatureExtractionPipeline } from '@huggingface/transformers';

type TransformerConfig = {
  model: string;
};

// A new instance is made per request, so the loaded model is shared here
// instead of being loaded from disk again for every search.
const pipelines = new Map<string, Promise<FeatureExtractionPipeline>>();

const getPipeline = (model: string) => {
  let pipelinePromise = pipelines.get(model);

  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline } = await import('@huggingface/transformers');
      const result = await pipeline('feature-extraction', model, {
        dtype: 'fp32',
      });
      return result as FeatureExtractionPipeline;
    })();
    pipelinePromise.catch(() => pipelines.delete(model));
    pipelines.set(model, pipelinePromise);
  }

  return pipelinePromise;
};

class TransformerEmbedding extends BaseEmbedding<TransformerConfig> {
  constructor(protected config: TransformerConfig) {
    super(config);
  }

  async embedText(texts: string[]): Promise<number[][]> {
    return this.embed(texts);
  }

  async embedChunks(chunks: Chunk[]): Promise<number[][]> {
    return this.embed(chunks.map((c) => c.content));
  }

  private async embed(texts: string[]) {
    const pipe = await getPipeline(this.config.model);
    const output = await pipe(texts, { pooling: 'mean', normalize: true });
    return output.tolist() as number[][];
  }
}

export default TransformerEmbedding;
