'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
    saveUserSettings,
    loadUserSettings,
    saveConversation,
    loadConversations,
    deleteConversationFromFirestore,
    saveUsageEntry as saveUsageToFirestore,
    loadUsageData,
} from '@/services/firebase';

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

// Debounce helper
let settingsSaveTimer = null;
function debouncedSaveSettings(uid, settings) {
    if (settingsSaveTimer) clearTimeout(settingsSaveTimer);
    settingsSaveTimer = setTimeout(() => {
        saveUserSettings(uid, settings).catch((err) =>
            console.error('Failed to save settings to Firestore:', err)
        );
    }, 2000);
}

let convSaveTimer = null;
function debouncedSaveConversation(uid, conversation) {
    if (convSaveTimer) clearTimeout(convSaveTimer);
    convSaveTimer = setTimeout(() => {
        saveConversation(uid, conversation).catch((err) =>
            console.error('Failed to save conversation to Firestore:', err)
        );
    }, 1500);
}

export const useAppStore = create(
    persist(
        (set, get) => ({
            // Firebase user
            firebaseUser: null,
            setFirebaseUser: (user) => set({ firebaseUser: user }),

            // Theme
            theme: 'dark',
            setTheme: (theme) => set({ theme }),
            toggleTheme: () => {
                const newTheme = get().theme === 'dark' ? 'light' : 'dark';
                set({ theme: newTheme });
                get()._syncSettings();
            },

            // API Keys
            apiKeys: {
                gemini: '',
                anthropic: '',
                openai: '',
                grok: '',
                openrouter: '',
            },
            setApiKey: (provider, key) => {
                set((s) => ({ apiKeys: { ...s.apiKeys, [provider]: key } }));
                get()._syncSettings();
            },

            // Model selection
            selectedModel: 'gemini-3-flash-preview',
            selectedProvider: 'gemini',
            thinkingEnabled: false,
            setSelectedModel: (modelId, provider) => {
                set({ selectedModel: modelId, selectedProvider: provider });
                get()._syncSettings();
            },
            setThinkingEnabled: (enabled) => set({ thinkingEnabled: enabled }),

            // Temperature
            temperature: 0.7,
            setTemperature: (temp) => {
                set({ temperature: temp });
                get()._syncSettings();
            },

            // System prompt
            systemPromptEnabled: true,
            systemPrompt: DEFAULT_SYSTEM_PROMPT,
            setSystemPromptEnabled: (enabled) => {
                set({ systemPromptEnabled: enabled });
                get()._syncSettings();
            },
            setSystemPrompt: (prompt) => {
                set({ systemPrompt: prompt });
                get()._syncSettings();
            },

            // Ollama config
            ollamaBaseUrl: 'http://localhost:11434',
            ollamaModels: [],
            setOllamaBaseUrl: (url) => {
                set({ ollamaBaseUrl: url });
                get()._syncSettings();
            },
            setOllamaModels: (models) => set({ ollamaModels: models }),

            // Local server config
            localServerUrl: 'http://localhost:8080/v1/messages',
            setLocalServerUrl: (url) => {
                set({ localServerUrl: url });
                get()._syncSettings();
            },

            // OpenRouter config
            openRouterModels: [],        // user-selected models
            openRouterAllModels: [],      // full list fetched from API (cached)
            setOpenRouterModels: (models) => {
                set({ openRouterModels: models });
                get()._syncSettings();
            },
            setOpenRouterAllModels: (models) => set({ openRouterAllModels: models }),

            // BigQuery
            bqProjectId: '',
            selectedTables: [],
            tableSchemas: {},
            setBqProjectId: (projectId) => {
                set({ bqProjectId: projectId });
                get()._syncSettings();
            },
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
            setGoogleAdsConfig: (config) => {
                set((s) => ({ googleAdsConfig: { ...s.googleAdsConfig, ...config } }));
                get()._syncSettings();
            },

            // Meta Ads
            metaAdsConfig: {
                enabled: false,
                accessToken: '',
                appId: '',
                appSecret: '',
            },
            setMetaAdsConfig: (config) => {
                set((s) => ({ metaAdsConfig: { ...s.metaAdsConfig, ...config } }));
                get()._syncSettings();
            },

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
                // Save to Firestore
                const uid = get().firebaseUser?.uid;
                if (uid) {
                    saveConversation(uid, conv).catch(console.error);
                }
                return id;
            },

            setActiveConversation: (id) => set({ activeConversationId: id }),

            addMessage: (convId, message) => {
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
                }));
                // Debounced save to Firestore
                const uid = get().firebaseUser?.uid;
                const conv = get().conversations.find((c) => c.id === convId);
                if (uid && conv) {
                    debouncedSaveConversation(uid, conv);
                }
            },

            updateMessage: (convId, messageIndex, updates) => {
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
                }));
                // Debounced save to Firestore
                const uid = get().firebaseUser?.uid;
                const conv = get().conversations.find((c) => c.id === convId);
                if (uid && conv) {
                    debouncedSaveConversation(uid, conv);
                }
            },

            deleteConversation: (id) => {
                set((s) => ({
                    conversations: s.conversations.filter((c) => c.id !== id),
                    activeConversationId:
                        s.activeConversationId === id ? null : s.activeConversationId,
                }));
                // Delete from Firestore
                const uid = get().firebaseUser?.uid;
                if (uid) {
                    deleteConversationFromFirestore(uid, id).catch(console.error);
                }
            },

            getActiveConversation: () => {
                const s = get();
                return s.conversations.find((c) => c.id === s.activeConversationId) || null;
            },

            // Usage tracking
            usageData: [],
            addUsageEntry: (entry) => {
                const fullEntry = { ...entry, timestamp: new Date().toISOString() };
                set((s) => ({
                    usageData: [...s.usageData, fullEntry],
                }));
                // Save to Firestore
                const uid = get().firebaseUser?.uid;
                if (uid) {
                    saveUsageToFirestore(uid, fullEntry).catch(console.error);
                }
            },

            // ─── Firestore Sync ──────────────────────────────────
            _syncSettings: () => {
                const state = get();
                const uid = state.firebaseUser?.uid;
                if (!uid) return;

                const settings = {
                    theme: state.theme,
                    apiKeys: state.apiKeys,
                    selectedModel: state.selectedModel,
                    selectedProvider: state.selectedProvider,
                    systemPromptEnabled: state.systemPromptEnabled,
                    systemPrompt: state.systemPrompt,
                    temperature: state.temperature,
                    ollamaBaseUrl: state.ollamaBaseUrl,
                    localServerUrl: state.localServerUrl,
                    bqProjectId: state.bqProjectId,
                    googleAdsConfig: state.googleAdsConfig,
                    metaAdsConfig: state.metaAdsConfig,
                    openRouterModels: state.openRouterModels,
                };
                debouncedSaveSettings(uid, settings);
            },

            loadFromFirestore: async (uid) => {
                try {
                    // Load settings
                    const settings = await loadUserSettings(uid);
                    if (settings) {
                        const updates = {};
                        if (settings.theme) updates.theme = settings.theme;
                        if (settings.apiKeys) updates.apiKeys = { ...get().apiKeys, ...settings.apiKeys };
                        if (settings.selectedModel) updates.selectedModel = settings.selectedModel;
                        if (settings.selectedProvider) updates.selectedProvider = settings.selectedProvider;
                        if (settings.systemPromptEnabled !== undefined) updates.systemPromptEnabled = settings.systemPromptEnabled;
                        if (settings.systemPrompt) updates.systemPrompt = settings.systemPrompt;
                        if (settings.temperature !== undefined) updates.temperature = settings.temperature;
                        if (settings.ollamaBaseUrl) updates.ollamaBaseUrl = settings.ollamaBaseUrl;
                        if (settings.localServerUrl) updates.localServerUrl = settings.localServerUrl;
                        if (settings.bqProjectId) updates.bqProjectId = settings.bqProjectId;
                        if (settings.googleAdsConfig) updates.googleAdsConfig = { ...get().googleAdsConfig, ...settings.googleAdsConfig };
                        if (settings.metaAdsConfig) updates.metaAdsConfig = { ...get().metaAdsConfig, ...settings.metaAdsConfig };
                        if (settings.openRouterModels) updates.openRouterModels = settings.openRouterModels;
                        set(updates);
                    }

                    // Load conversations
                    const conversations = await loadConversations(uid);
                    if (conversations.length > 0) {
                        // Convert Firestore timestamps to ISO strings
                        const normalized = conversations.map((c) => ({
                            ...c,
                            updatedAt: c.updatedAt?.toDate?.()?.toISOString?.() || c.updatedAt || new Date().toISOString(),
                            createdAt: c.createdAt?.toDate?.()?.toISOString?.() || c.createdAt || new Date().toISOString(),
                        }));
                        set({ conversations: normalized });
                    }

                    // Load usage data
                    const usage = await loadUsageData(uid);
                    if (usage.length > 0) {
                        const normalized = usage.map((u) => ({
                            ...u,
                            timestamp: u.createdAt?.toDate?.()?.toISOString?.() || u.timestamp || new Date().toISOString(),
                        }));
                        set({ usageData: normalized });
                    }
                } catch (err) {
                    console.error('Error loading from Firestore:', err);
                }
            },
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
                openRouterModels: state.openRouterModels,
            }),
        }
    )
);
