import OpenAILLM from '../openai/openaiLLM';

class GeminiLLM extends OpenAILLM {
  // Gemini's "thinking" only has two states (low/"default" and high/"on"),
  // it cannot be turned fully off. If we don't send `reasoning_effort`
  // explicitly, the API falls back to its own default, which is a
  // dynamic/high thinking budget on every single call — this is what makes
  // multi-step calls (classification, the research loop, the final answer)
  // feel much slower than the model's raw decoding benchmarks suggest.
  // Default to "low" unless the caller asked for something else.
  protected getReasoningRequestOptions(): Record<string, any> {
    const reasoning = this.config.options?.reasoning;

    // An explicit effort always wins. Otherwise: "On" -> high, everything
    // else (including "Default"/unset, and "Off" since it isn't supported)
    // -> low.
    const effort = reasoning?.effort ?? (reasoning?.enabled ? 'high' : 'low');

    return { reasoning_effort: effort };
  }
}

export default GeminiLLM;
