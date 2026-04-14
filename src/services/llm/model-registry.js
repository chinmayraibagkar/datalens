// Central registry of all LLM models with metadata and pricing
// Pricing is in INR per 1 million tokens (at ~₹83/USD)

const INR_PER_USD = 83;

export const MODEL_PROVIDERS = {
  gemini: { name: 'Google Gemini', icon: '✦', color: '#4285F4' },
  anthropic: { name: 'Anthropic Claude', icon: '◈', color: '#D97706' },
  openai: { name: 'OpenAI', icon: '◉', color: '#10A37F' },
  grok: { name: 'xAI Grok', icon: '⚡', color: '#1DA1F2' },
  openrouter: { name: 'OpenRouter', icon: '🌐', color: '#FF6B35' },
  ollama: { name: 'Ollama (Local)', icon: '🦙', color: '#808080' },
  'local-server': { name: 'Local Server', icon: '🖥️', color: '#9333EA' },
};

export const MODELS = [
  // --- Gemini ---
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    provider: 'gemini',
    contextWindow: 2000000,
    inputPricePerMillion_INR: 207.50,
    outputPricePerMillion_INR: 1245.00,
    supportsThinking: true,
    isLocal: false,
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash',
    provider: 'gemini',
    contextWindow: 1000000,
    inputPricePerMillion_INR: 49.80,
    outputPricePerMillion_INR: 299.00,
    supportsThinking: true,
    isLocal: false,
  },
  // --- Anthropic ---
  {
    id: 'claude-opus-4',
    name: 'Claude Opus 4',
    provider: 'anthropic',
    contextWindow: 200000,
    inputPricePerMillion_INR: 415.00,
    outputPricePerMillion_INR: 2075.00,
    supportsThinking: true,
    isLocal: false,
  },
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    contextWindow: 200000,
    inputPricePerMillion_INR: 249.00,
    outputPricePerMillion_INR: 1245.00,
    supportsThinking: true,
    isLocal: false,
  },
  {
    id: 'claude-haiku-3.5',
    name: 'Claude Haiku 3.5',
    provider: 'anthropic',
    contextWindow: 200000,
    inputPricePerMillion_INR: 83.00,
    outputPricePerMillion_INR: 415.00,
    supportsThinking: false,
    isLocal: false,
  },
  // --- OpenAI ---
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    contextWindow: 128000,
    inputPricePerMillion_INR: 207.50,
    outputPricePerMillion_INR: 830.00,
    supportsThinking: false,
    isLocal: false,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    contextWindow: 128000,
    inputPricePerMillion_INR: 12.45,
    outputPricePerMillion_INR: 49.80,
    supportsThinking: false,
    isLocal: false,
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    contextWindow: 128000,
    inputPricePerMillion_INR: 830.00,
    outputPricePerMillion_INR: 2490.00,
    supportsThinking: false,
    isLocal: false,
  },
  {
    id: 'o1',
    name: 'o1',
    provider: 'openai',
    contextWindow: 200000,
    inputPricePerMillion_INR: 1245.00,
    outputPricePerMillion_INR: 4980.00,
    supportsThinking: true,
    isLocal: false,
  },
  {
    id: 'o1-mini',
    name: 'o1 Mini',
    provider: 'openai',
    contextWindow: 128000,
    inputPricePerMillion_INR: 249.00,
    outputPricePerMillion_INR: 996.00,
    supportsThinking: true,
    isLocal: false,
  },
  // --- xAI Grok ---
  {
    id: 'grok-3',
    name: 'Grok 3',
    provider: 'grok',
    contextWindow: 131072,
    inputPricePerMillion_INR: 249.00,
    outputPricePerMillion_INR: 1245.00,
    supportsThinking: false,
    isLocal: false,
  },
  {
    id: 'grok-3-mini',
    name: 'Grok 3 Mini',
    provider: 'grok',
    contextWindow: 131072,
    inputPricePerMillion_INR: 24.90,
    outputPricePerMillion_INR: 41.50,
    supportsThinking: true,
    isLocal: false,
  },
  {
    id: 'grok-4',
    name: 'Grok 4',
    provider: 'grok',
    contextWindow: 262144,
    inputPricePerMillion_INR: 249.00,
    outputPricePerMillion_INR: 1245.00,
    supportsThinking: true,
    isLocal: false,
  },
  {
    id: 'grok-4-fast',
    name: 'Grok 4 Fast',
    provider: 'grok',
    contextWindow: 2000000,
    inputPricePerMillion_INR: 16.60,
    outputPricePerMillion_INR: 41.50,
    supportsThinking: false,
    isLocal: false,
  },
  // --- Local Server ---
  {
    id: 'claude-opus-4-6-thinking',
    name: 'Claude Opus 4.6 (Thinking)',
    provider: 'local-server',
    contextWindow: null,
    inputPricePerMillion_INR: 0,
    outputPricePerMillion_INR: 0,
    supportsThinking: true,
    isLocal: true,
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'local-server',
    contextWindow: null,
    inputPricePerMillion_INR: 0,
    outputPricePerMillion_INR: 0,
    supportsThinking: false,
    isLocal: true,
  },
  {
    id: 'gemini-3.1-pro-low',
    name: 'Gemini 3.1 Pro Low',
    provider: 'local-server',
    contextWindow: null,
    inputPricePerMillion_INR: 0,
    outputPricePerMillion_INR: 0,
    supportsThinking: true,
    isLocal: true,
  },
  {
    id: 'gemini-3.1-pro-high',
    name: 'Gemini 3.1 Pro High',
    provider: 'local-server',
    contextWindow: null,
    inputPricePerMillion_INR: 0,
    outputPricePerMillion_INR: 0,
    supportsThinking: true,
    isLocal: true,
  },
  {
    id: 'gemini-3-flash',
    name: 'Gemini 3 Flash (Local)',
    provider: 'local-server',
    contextWindow: null,
    inputPricePerMillion_INR: 0,
    outputPricePerMillion_INR: 0,
    supportsThinking: true,
    isLocal: true,
  },
];

// Helper functions
export function getModelById(id, extraModels = []) {
  return MODELS.find((m) => m.id === id) || extraModels.find((m) => m.id === id);
}

export function getModelsByProvider(provider) {
  return MODELS.filter((m) => m.provider === provider);
}

export function calculateCost(modelId, inputTokens, outputTokens, extraModels = []) {
  const model = getModelById(modelId, extraModels);
  if (!model || model.isLocal) return 0;
  const inputCost = (inputTokens / 1_000_000) * model.inputPricePerMillion_INR;
  const outputCost = (outputTokens / 1_000_000) * model.outputPricePerMillion_INR;
  return inputCost + outputCost;
}

export function formatINR(amount) {
  if (amount === 0) return '—';
  if (amount < 0.01) return `₹${amount.toFixed(6)}`;
  if (amount < 1) return `₹${amount.toFixed(4)}`;
  return `₹${amount.toFixed(2)}`;
}

export function formatTokens(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
