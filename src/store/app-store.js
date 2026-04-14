'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DEFAULT_SYSTEM_PROMPT = `You are a senior data analyst specializing in digital marketing campaigns and CRM analytics. You help analyze campaign performance, customer segmentation, attribution modeling, ROAS (Return on Ad Spend), CAC (Customer Acquisition Cost), LTV (Lifetime Value), funnel metrics, cohort analysis, retention curves, and more.

When writing SQL queries:
- Use BigQuery Standard SQL syntax
- Write optimized, production-quality queries
- Use proper aggregations and window functions when needed
- Always alias columns with readable names
- Add comments for complex logic

When generating visualizations:
- Use Plotly.js for interactive charts
- Choose the most appropriate chart type for the data
- Use professional color schemes
- Add proper titles, axis labels, and legends
- Make charts responsive`;

export const useAppStore = create(
    persist(
        (set, get) => ({
            // Theme
            theme: 'dark',
            setTheme: (theme) => set({ theme }),
            toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

            // API Keys
            apiKeys: {
                gemini: '',
                anthropic: '',
                openai: '',
                grok: '',
            },
            setApiKey: (provider, key) =>
                set((s) => ({ apiKeys: { ...s.apiKeys, [provider]: key } })),

            // Model selection
            selectedModel: 'gemini-3-flash-preview',
            selectedProvider: 'gemini',
            thinkingEnabled: false,
            setSelectedModel: (modelId, provider) =>
                set({ selectedModel: modelId, selectedProvider: provider }),
            setThinkingEnabled: (enabled) => set({ thinkingEnabled: enabled }),

            // Temperature
            temperature: 0.7,
            setTemperature: (temp) => set({ temperature: temp }),

            // System prompt
            systemPromptEnabled: true,
            systemPrompt: DEFAULT_SYSTEM_PROMPT,
            setSystemPromptEnabled: (enabled) => set({ systemPromptEnabled: enabled }),
            setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),

            // Ollama config
            ollamaBaseUrl: 'http://localhost:11434',
            ollamaModels: [],
            setOllamaBaseUrl: (url) => set({ ollamaBaseUrl: url }),
            setOllamaModels: (models) => set({ ollamaModels: models }),

            // Local server config
            localServerUrl: 'http://localhost:8080/v1/messages',
            setLocalServerUrl: (url) => set({ localServerUrl: url }),

            // BigQuery
            bqProjectId: '',
            selectedTables: [],
            tableSchemas: {},
            setBqProjectId: (projectId) => set({ bqProjectId: projectId }),
            setSelectedTables: (tables) => set({ selectedTables: tables }),
            addTableSchema: (key, schema) =>
                set((s) => ({ tableSchemas: { ...s.tableSchemas, [key]: schema } })),

            // Google Ads
            googleAdsConfig: {
                enabled: false,
                clientId: '',
                clientSecret: '',
                refreshToken: '',
                developerToken: '',
                loginCustomerId: '',
                customerId: '',
                execPath: '',
            },
            setGoogleAdsConfig: (config) =>
                set((s) => ({ googleAdsConfig: { ...s.googleAdsConfig, ...config } })),

            // Meta Ads
            metaAdsConfig: {
                enabled: false,
                accessToken: '',
                appId: '',
                appSecret: '',
            },
            setMetaAdsConfig: (config) =>
                set((s) => ({ metaAdsConfig: { ...s.metaAdsConfig, ...config } })),

            // Selected ad accounts for chat context
            selectedGoogleAdsAccounts: [],
            selectedMetaAdsAccounts: [],
            setSelectedGoogleAdsAccounts: (accounts) => set({ selectedGoogleAdsAccounts: accounts }),
            setSelectedMetaAdsAccounts: (accounts) => set({ selectedMetaAdsAccounts: accounts }),

            // Conversations
            conversations: [],
            activeConversationId: null,

            createConversation: () => {
                const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                const conv = {
                    id,
                    title: 'New Chat',
                    messages: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                set((s) => ({
                    conversations: [conv, ...s.conversations],
                    activeConversationId: id,
                }));
                return id;
            },

            setActiveConversation: (id) => set({ activeConversationId: id }),

            addMessage: (convId, message) =>
                set((s) => ({
                    conversations: s.conversations.map((c) =>
                        c.id === convId
                            ? {
                                ...c,
                                messages: [...c.messages, message],
                                updatedAt: new Date().toISOString(),
                                title:
                                    c.messages.length === 0 && message.role === 'user'
                                        ? message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '')
                                        : c.title,
                            }
                            : c
                    ),
                })),

            updateMessage: (convId, messageIndex, updates) =>
                set((s) => ({
                    conversations: s.conversations.map((c) =>
                        c.id === convId
                            ? {
                                ...c,
                                messages: c.messages.map((m, i) =>
                                    i === messageIndex ? { ...m, ...updates } : m
                                ),
                            }
                            : c
                    ),
                })),

            deleteConversation: (id) =>
                set((s) => ({
                    conversations: s.conversations.filter((c) => c.id !== id),
                    activeConversationId:
                        s.activeConversationId === id ? null : s.activeConversationId,
                })),

            getActiveConversation: () => {
                const s = get();
                return s.conversations.find((c) => c.id === s.activeConversationId) || null;
            },

            // Usage tracking
            usageData: [],
            addUsageEntry: (entry) =>
                set((s) => ({
                    usageData: [
                        ...s.usageData,
                        {
                            ...entry,
                            timestamp: new Date().toISOString(),
                        },
                    ],
                })),
        }),
        {
            name: 'datalens-v2-storage',
            partialize: (state) => ({
                theme: state.theme,
                apiKeys: state.apiKeys,
                selectedModel: state.selectedModel,
                selectedProvider: state.selectedProvider,
                systemPromptEnabled: state.systemPromptEnabled,
                systemPrompt: state.systemPrompt,
                temperature: state.temperature,
                ollamaBaseUrl: state.ollamaBaseUrl,
                ollamaModels: state.ollamaModels,
                localServerUrl: state.localServerUrl,
                bqProjectId: state.bqProjectId,
                googleAdsConfig: state.googleAdsConfig,
                metaAdsConfig: state.metaAdsConfig,
                conversations: state.conversations,
                usageData: state.usageData,
            }),
        }
    )
);
