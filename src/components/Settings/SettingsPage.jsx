'use client';

import { useState, useMemo } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useAppStore } from '@/store/app-store';
import { MODEL_PROVIDERS, formatINR, formatTokens } from '@/services/llm/model-registry';
import { signOutUser } from '@/services/firebase';
import { fetchOpenRouterModels } from '@/services/llm/providers/openrouter';
import { listLMStudioModels, loadLMStudioModel, unloadLMStudioModel } from '@/services/llm/providers/lmstudio';
import toast from 'react-hot-toast';

const TABS = [
    { id: 'apikeys', label: '🔑 API Keys' },
    { id: 'local', label: '🖥️ Local Models' },
    { id: 'openrouter', label: '🌐 OpenRouter' },
    { id: 'bigquery', label: '☁️ BigQuery' },
    { id: 'ads', label: '📈 Ad Platforms' },
    { id: 'prompt', label: '📝 System Prompt' },
    { id: 'account', label: '👤 Account' },
];

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('apikeys');
    const { data: session } = useSession();
    const [orSearch, setOrSearch] = useState('');
    const [orLoading, setOrLoading] = useState(false);
    const [localDocsOpen, setLocalDocsOpen] = useState(false);
    const [lmsLoading, setLmsLoading] = useState(false);
    const [lmsLoadingModel, setLmsLoadingModel] = useState(null);
    const [lmsUnloadingModel, setLmsUnloadingModel] = useState(null);

    const {
        apiKeys,
        setApiKey,
        ollamaBaseUrl,
        setOllamaBaseUrl,
        ollamaModels,
        setOllamaModels,
        localServerUrl,
        setLocalServerUrl,
        bqProjectId,
        setBqProjectId,
        systemPromptEnabled,
        setSystemPromptEnabled,
        systemPrompt,
        setSystemPrompt,
        temperature,
        setTemperature,
        googleAdsConfig,
        setGoogleAdsConfig,
        metaAdsConfig,
        setMetaAdsConfig,
        openRouterModels,
        setOpenRouterModels,
        openRouterAllModels,
        setOpenRouterAllModels,
        lmStudioBaseUrl,
        setLmStudioBaseUrl,
        lmStudioModels,
        setLmStudioModels,
        firebaseUser,
    } = useAppStore();

    const testApiKey = async (provider) => {
        const key = apiKeys[provider];
        if (!key) {
            toast.error('Please enter an API key first');
            return;
        }

        try {
            switch (provider) {
                case 'gemini': {
                    const testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
                    const gRes = await fetch(testUrl);
                    if (gRes.ok) {
                        toast.success('Gemini API key is valid! ✓');
                    } else {
                        toast.error('Invalid Gemini API key');
                    }
                    return;
                }
                case 'anthropic':
                    toast.success('Anthropic key saved. It will be validated on first use.');
                    return;
                case 'openai': {
                    const oRes = await fetch('https://api.openai.com/v1/models', {
                        headers: { Authorization: `Bearer ${key}` },
                    });
                    if (oRes.ok) {
                        toast.success('OpenAI API key is valid! ✓');
                    } else {
                        toast.error('Invalid OpenAI API key');
                    }
                    return;
                }
                case 'grok':
                    toast.success('Grok key saved. It will be validated on first use.');
                    return;
                case 'openrouter': {
                    const orRes = await fetch('https://openrouter.ai/api/v1/models', {
                        headers: { Authorization: `Bearer ${key}` },
                    });
                    if (orRes.ok) {
                        toast.success('OpenRouter API key is valid! ✓');
                    } else {
                        toast.error('Invalid OpenRouter API key');
                    }
                    return;
                }
            }
        } catch (err) {
            toast.error(`Connection failed: ${err.message}`);
        }
    };

    const fetchOllamaModels = async () => {
        try {
            const res = await fetch(`${ollamaBaseUrl}/api/tags`);
            if (!res.ok) throw new Error('Failed to connect to Ollama');
            const data = await res.json();
            const models = (data.models || []).map((m) => ({
                id: m.name,
                name: m.name,
                provider: 'ollama',
                contextWindow: null,
                inputPricePerMillion_INR: 0,
                outputPricePerMillion_INR: 0,
                supportsThinking: false,
                isLocal: true,
            }));
            setOllamaModels(models);
            toast.success(`Found ${models.length} Ollama models`);
        } catch (err) {
            toast.error(`Ollama connection failed: ${err.message}`);
        }
    };

    // ─── LM Studio model management ───
    const handleFetchLMStudioModels = async () => {
        setLmsLoading(true);
        try {
            const models = await listLMStudioModels(lmStudioBaseUrl);
            setLmStudioModels(models);
            const loadedCount = models.filter(m => m.isLoaded).length;
            toast.success(`Found ${models.length} LM Studio models (${loadedCount} loaded)`);
        } catch (err) {
            toast.error(`LM Studio connection failed: ${err.message}`);
        } finally {
            setLmsLoading(false);
        }
    };

    const handleLoadLMStudioModel = async (model) => {
        setLmsLoadingModel(model.id);
        try {
            await loadLMStudioModel(lmStudioBaseUrl, model.id);
            toast.success(`Loaded "${model.name}" successfully`);
            // Refresh model list to update loaded state
            const models = await listLMStudioModels(lmStudioBaseUrl);
            setLmStudioModels(models);
        } catch (err) {
            toast.error(`Failed to load model: ${err.message}`);
        } finally {
            setLmsLoadingModel(null);
        }
    };

    const handleUnloadLMStudioModel = async (model) => {
        setLmsUnloadingModel(model.id);
        try {
            const instanceId = model.loadedInstanceId || model.id;
            await unloadLMStudioModel(lmStudioBaseUrl, instanceId);
            toast.success(`Ejected "${model.name}" — RAM freed`);
            // Refresh model list to update loaded state
            const models = await listLMStudioModels(lmStudioBaseUrl);
            setLmStudioModels(models);
        } catch (err) {
            toast.error(`Failed to eject model: ${err.message}`);
        } finally {
            setLmsUnloadingModel(null);
        }
    };

    // ─── OpenRouter model fetching ───
    const handleFetchOpenRouterModels = async () => {
        const key = apiKeys.openrouter;
        if (!key) {
            toast.error('Please enter your OpenRouter API key first');
            return;
        }
        setOrLoading(true);
        try {
            const models = await fetchOpenRouterModels(key);
            setOpenRouterAllModels(models);
            toast.success(`Found ${models.length} OpenRouter models`);
        } catch (err) {
            toast.error(`Failed to fetch models: ${err.message}`);
        } finally {
            setOrLoading(false);
        }
    };

    const toggleOpenRouterModel = (model) => {
        const exists = openRouterModels.find((m) => m.id === model.id);
        if (exists) {
            setOpenRouterModels(openRouterModels.filter((m) => m.id !== model.id));
        } else {
            setOpenRouterModels([...openRouterModels, model]);
        }
    };

    const filteredORModels = useMemo(() => {
        if (!orSearch.trim()) return openRouterAllModels;
        const q = orSearch.toLowerCase();
        return openRouterAllModels.filter(
            (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
        );
    }, [openRouterAllModels, orSearch]);

    const selectedORIds = useMemo(
        () => new Set(openRouterModels.map((m) => m.id)),
        [openRouterModels]
    );

    const testGoogleAdsConnection = async () => {
        try {
            const res = await fetch('/api/ads/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'test', config: googleAdsConfig }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Google Ads connected! Found ${data.customerCount || 0} account(s)`);
            } else {
                toast.error(data.error || 'Connection failed');
            }
        } catch (err) {
            toast.error(`Google Ads connection failed: ${err.message}`);
        }
    };

    const testMetaAdsConnection = async () => {
        try {
            const res = await fetch('/api/ads/meta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'test', config: metaAdsConfig }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Meta Ads connected! Found ${data.accountCount || 0} account(s)`);
            } else {
                toast.error(data.error || 'Connection failed');
            }
        } catch (err) {
            toast.error(`Meta Ads connection failed: ${err.message}`);
        }
    };

    const handleSignOut = async () => {
        try {
            await signOutUser();
            toast.success('Signed out successfully');
        } catch (err) {
            toast.error(`Sign out failed: ${err.message}`);
        }
    };

    const TEMP_LABELS = [
        { val: 0, label: 'Precise' },
        { val: 0.3, label: 'Analytical' },
        { val: 0.5, label: 'Balanced' },
        { val: 0.7, label: 'Creative' },
        { val: 1.0, label: 'Experimental' },
    ];

    return (
        <div className="settings-page">
            <h1>⚙️ Settings <span style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--accent-primary)', verticalAlign: 'middle' }}>v0.6</span></h1>

            <div className="settings-tabs">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* API Keys Tab */}
            {activeTab === 'apikeys' && (
                <>
                    {[
                        { key: 'gemini', label: 'Google Gemini', icon: MODEL_PROVIDERS.gemini.icon, color: MODEL_PROVIDERS.gemini.color },
                        { key: 'anthropic', label: 'Anthropic Claude', icon: MODEL_PROVIDERS.anthropic.icon, color: MODEL_PROVIDERS.anthropic.color },
                        { key: 'openai', label: 'OpenAI', icon: MODEL_PROVIDERS.openai.icon, color: MODEL_PROVIDERS.openai.color },
                        { key: 'grok', label: 'xAI Grok', icon: MODEL_PROVIDERS.grok.icon, color: MODEL_PROVIDERS.grok.color },
                        { key: 'openrouter', label: 'OpenRouter', icon: MODEL_PROVIDERS.openrouter.icon, color: MODEL_PROVIDERS.openrouter.color },
                    ].map((provider) => (
                        <div key={provider.key} className="provider-card">
                            <div className="provider-card-header">
                                <div className="provider-icon" style={{ background: provider.color + '20', color: provider.color }}>
                                    {provider.icon}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{provider.label}</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                        {apiKeys[provider.key] ? '✓ Key configured' : 'Not configured'}
                                    </div>
                                </div>
                            </div>
                            <div className="form-input-group">
                                <input
                                    type="password"
                                    className="form-input"
                                    placeholder={`Enter ${provider.label} API Key`}
                                    value={apiKeys[provider.key] || ''}
                                    onChange={(e) => setApiKey(provider.key, e.target.value)}
                                />
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => testApiKey(provider.key)}
                                    disabled={!apiKeys[provider.key]}
                                >
                                    Test
                                </button>
                            </div>
                            {provider.key === 'openrouter' && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                                    Get your key at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}>openrouter.ai/keys</a> — After adding the key, go to the <strong>OpenRouter</strong> tab to select models.
                                </div>
                            )}
                        </div>
                    ))}
                </>
            )}

            {/* Local Models Tab */}
            {activeTab === 'local' && (
                <>
                    <div className="settings-section">
                        <h2>🦙 Ollama</h2>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                            Connect to your local Ollama instance for running open-source models.
                        </p>
                        <div className="form-group">
                            <label className="form-label">Base URL</label>
                            <div className="form-input-group">
                                <input
                                    type="text"
                                    className="form-input"
                                    value={ollamaBaseUrl}
                                    onChange={(e) => setOllamaBaseUrl(e.target.value)}
                                    placeholder="http://localhost:11434"
                                />
                                <button className="btn btn-primary" onClick={fetchOllamaModels}>
                                    Fetch Models
                                </button>
                            </div>
                        </div>
                        {ollamaModels.length > 0 && (
                            <div style={{ marginTop: '12px' }}>
                                <label className="form-label">Discovered Models ({ollamaModels.length})</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {ollamaModels.map((m) => (
                                        <span key={m.id} className="status-badge success">
                                            {m.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ─── LM Studio Section ─── */}
                    <div className="settings-section">
                        <h2>🧪 LM Studio</h2>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                            Connect to your local LM Studio instance. Load, unload, and switch between models to manage RAM.
                        </p>
                        <div className="form-group">
                            <label className="form-label">Base URL</label>
                            <div className="form-input-group">
                                <input
                                    type="text"
                                    className="form-input"
                                    value={lmStudioBaseUrl}
                                    onChange={(e) => setLmStudioBaseUrl(e.target.value)}
                                    placeholder="http://localhost:1234"
                                />
                                <button
                                    className="btn btn-primary"
                                    onClick={handleFetchLMStudioModels}
                                    disabled={lmsLoading}
                                >
                                    {lmsLoading ? '⏳ Fetching...' : 'Fetch Models'}
                                </button>
                            </div>
                        </div>
                        {lmStudioModels.length > 0 && (
                            <div style={{ marginTop: '16px' }}>
                                <label className="form-label">Available Models ({lmStudioModels.length})</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {lmStudioModels.map((m) => (
                                        <div
                                            key={m.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '10px 14px',
                                                borderRadius: 'var(--radius-md)',
                                                border: `1px solid ${m.isLoaded ? 'rgba(0, 212, 170, 0.3)' : 'var(--border-color)'}`,
                                                background: m.isLoaded ? 'rgba(0, 212, 170, 0.06)' : 'var(--bg-card)',
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{m.name}</span>
                                                    {m.isLoaded && (
                                                        <span style={{
                                                            fontSize: '0.65rem',
                                                            padding: '2px 8px',
                                                            borderRadius: '4px',
                                                            background: 'rgba(0, 212, 170, 0.15)',
                                                            color: '#00D4AA',
                                                            fontWeight: 600,
                                                        }}>
                                                            ● LOADED
                                                        </span>
                                                    )}
                                                    {m.supportsTools && (
                                                        <span style={{
                                                            fontSize: '0.65rem',
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            background: 'rgba(16,185,129,0.15)',
                                                            color: '#10b981',
                                                        }}>🔧 Tools</span>
                                                    )}
                                                    {m.hasVision && (
                                                        <span style={{
                                                            fontSize: '0.65rem',
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            background: 'rgba(99,102,241,0.15)',
                                                            color: '#6366f1',
                                                        }}>👁️ Vision</span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                    {m.publisher && <span>{m.publisher}</span>}
                                                    {m.paramsString && <span>{m.paramsString} params</span>}
                                                    {m.quantization && <span>{m.quantization}</span>}
                                                    {m.contextWindow && <span>{formatTokens(m.contextWindow)} ctx</span>}
                                                    {m.isLoaded && m.loadedContextLength && (
                                                        <span style={{ color: '#00D4AA' }}>Active: {formatTokens(m.loadedContextLength)} ctx</span>
                                                    )}
                                                    {m.sizeBytes > 0 && (
                                                        <span>{(m.sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '12px' }}>
                                                {m.isLoaded ? (
                                                    <button
                                                        className="btn btn-danger btn-sm"
                                                        onClick={() => handleUnloadLMStudioModel(m)}
                                                        disabled={lmsUnloadingModel === m.id}
                                                        style={{ fontSize: '0.75rem' }}
                                                    >
                                                        {lmsUnloadingModel === m.id ? '⏳ Ejecting...' : '⏏️ Eject'}
                                                    </button>
                                                ) : (
                                                    <button
                                                        className="btn btn-primary btn-sm"
                                                        onClick={() => handleLoadLMStudioModel(m)}
                                                        disabled={lmsLoadingModel === m.id}
                                                        style={{ fontSize: '0.75rem' }}
                                                    >
                                                        {lmsLoadingModel === m.id ? '⏳ Loading...' : '▶️ Load'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="settings-section">
                        <h2>🖥️ Custom Local Server</h2>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                            Connect to your custom model server with Anthropic-style API.
                        </p>
                        <div className="form-group">
                            <label className="form-label">Endpoint URL</label>
                            <input
                                type="text"
                                className="form-input"
                                value={localServerUrl}
                                onChange={(e) => setLocalServerUrl(e.target.value)}
                                placeholder="http://localhost:8080/v1/messages"
                            />
                        </div>
                        <div style={{ marginTop: '12px' }}>
                            <label className="form-label">Available Models</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {['claude-opus-4-6-thinking', 'claude-sonnet-4-6', 'gemini-3.1-pro-low', 'gemini-3.1-pro-high', 'gemini-3-flash'].map((m) => (
                                    <span key={m} className="status-badge success">{m}</span>
                                ))}
                            </div>
                        </div>

                        {/* Documentation */}
                        <div style={{ marginTop: '16px' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setLocalDocsOpen(!localDocsOpen)}
                                style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                📖 {localDocsOpen ? 'Hide' : 'Show'} Server Setup Guide
                            </button>
                        </div>

                        {localDocsOpen && (
                            <div className="local-server-docs" style={{ marginTop: '16px', padding: '20px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.82rem', lineHeight: 1.7 }}>
                                <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: 'var(--accent-primary)' }}>🖥️ Local Server Setup Guide</h3>
                                
                                <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                    DataLens connects to your local server using the <strong>Anthropic Messages API</strong> format. 
                                    Your server must expose a single <code>POST</code> endpoint that accepts and returns JSON in the schema below.
                                </p>

                                <h4 style={{ fontSize: '0.9rem', marginTop: '16px', marginBottom: '8px' }}>📡 Endpoint</h4>
                                <pre style={{ padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: '8px', overflow: 'auto', marginBottom: '12px' }}>
                                    <code>{`POST ${localServerUrl || 'http://localhost:8080/v1/messages'}
Content-Type: application/json`}</code>
                                </pre>

                                <h4 style={{ fontSize: '0.9rem', marginTop: '16px', marginBottom: '8px' }}>📥 Request Body</h4>
                                <pre style={{ padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: '8px', overflow: 'auto', marginBottom: '12px' }}>
                                    <code>{`{
  "model": "claude-opus-4-6-thinking",   // Model identifier string
  "max_tokens": 65536,                   // Max output tokens
  "system": "You are a helpful...",      // Optional system prompt
  "messages": [                          // Conversation messages
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi there!" },
    { "role": "user", "content": "Analyze my data" }
  ],
  "tools": [                             // Optional: tool definitions
    {
      "name": "execute_sql",
      "description": "Run a SQL query",
      "input_schema": {
        "type": "object",
        "properties": {
          "sql": { "type": "string" }
        },
        "required": ["sql"]
      }
    }
  ]
}`}</code>
                                </pre>

                                <h4 style={{ fontSize: '0.9rem', marginTop: '16px', marginBottom: '8px' }}>📤 Response Body</h4>
                                <pre style={{ padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: '8px', overflow: 'auto', marginBottom: '12px' }}>
                                    <code>{`{
  "content": [
    {
      "type": "thinking",               // Optional: thinking/reasoning
      "thinking": "Let me analyze..."
    },
    {
      "type": "text",                    // Text response
      "text": "Here is my analysis..."
    },
    {
      "type": "tool_use",               // Optional: tool call request
      "id": "toolu_abc123",
      "name": "execute_sql",
      "input": { "sql": "SELECT * FROM ..." }
    }
  ],
  "usage": {                             // Token usage (optional)
    "input_tokens": 1234,
    "output_tokens": 567
  }
}`}</code>
                                </pre>

                                <h4 style={{ fontSize: '0.9rem', marginTop: '16px', marginBottom: '8px' }}>⚡ Quick Start — Python (Flask)</h4>
                                <pre style={{ padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: '8px', overflow: 'auto', marginBottom: '12px' }}>
                                    <code>{`from flask import Flask, request, jsonify
import anthropic  # or any LLM SDK

app = Flask(__name__)
client = anthropic.Anthropic(api_key="your-key")

@app.route("/v1/messages", methods=["POST"])
def messages():
    body = request.json
    response = client.messages.create(
        model=body.get("model", "claude-sonnet-4-20250514"),
        max_tokens=body.get("max_tokens", 8192),
        system=body.get("system", ""),
        messages=body["messages"],
        tools=body.get("tools", []),
    )
    return jsonify(response.model_dump())

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)`}</code>
                                </pre>

                                <h4 style={{ fontSize: '0.9rem', marginTop: '16px', marginBottom: '8px' }}>⚡ Quick Start — Node.js (Express)</h4>
                                <pre style={{ padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: '8px', overflow: 'auto', marginBottom: '12px' }}>
                                    <code>{`const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(express.json({ limit: '10mb' }));

const client = new Anthropic({ apiKey: 'your-key' });

app.post('/v1/messages', async (req, res) => {
  const { model, max_tokens, system, messages, tools } = req.body;
  const response = await client.messages.create({
    model: model || 'claude-sonnet-4-20250514',
    max_tokens: max_tokens || 8192,
    system: system || undefined,
    messages,
    tools: tools || undefined,
  });
  res.json(response);
});

app.listen(8080, () => console.log('Server on :8080'));`}</code>
                                </pre>

                                <h4 style={{ fontSize: '0.9rem', marginTop: '16px', marginBottom: '8px' }}>💡 Key Notes</h4>
                                <ul style={{ paddingLeft: '18px', color: 'var(--text-secondary)' }}>
                                    <li>The <code>model</code> field is the ID passed from the model selector — your server can route to different models or ignore it.</li>
                                    <li><code>thinking</code> blocks in the response are displayed in a collapsible section in the UI.</li>
                                    <li>For <strong>tool calling</strong>, your server must return <code>tool_use</code> blocks. DataLens will execute the tools and send results back as <code>tool_result</code> messages.</li>
                                    <li>If your server returns a plain string for <code>content</code> instead of an array, DataLens handles that too.</li>
                                    <li>CORS: If running on a different port, ensure your server returns <code>Access-Control-Allow-Origin: *</code> headers.</li>
                                </ul>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* OpenRouter Tab */}
            {activeTab === 'openrouter' && (
                <div className="settings-section">
                    <h2>🌐 OpenRouter Models</h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                        OpenRouter provides access to 300+ models from every major provider through a single API.
                        {!apiKeys.openrouter && (
                            <span style={{ color: 'var(--accent-warning)', display: 'block', marginTop: '8px' }}>
                                ⚠️ Add your OpenRouter API key in the <strong>API Keys</strong> tab first.
                            </span>
                        )}
                    </p>

                    {apiKeys.openrouter && (
                        <>
                            <button
                                className="btn btn-primary"
                                onClick={handleFetchOpenRouterModels}
                                disabled={orLoading}
                                style={{ marginBottom: '16px' }}
                            >
                                {orLoading ? '⏳ Fetching...' : '🔄 Fetch Available Models'}
                            </button>

                            {openRouterAllModels.length > 0 && (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="Search models... (e.g. claude, gpt, llama, gemini)"
                                            value={orSearch}
                                            onChange={(e) => setOrSearch(e.target.value)}
                                            style={{ flex: 1, minWidth: '200px' }}
                                        />
                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                            {filteredORModels.length} models · {openRouterModels.length} selected
                                        </span>
                                    </div>

                                    {/* Selected models summary */}
                                    {openRouterModels.length > 0 && (
                                        <div style={{ marginBottom: '12px' }}>
                                            <label className="form-label">Selected Models ({openRouterModels.length})</label>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {openRouterModels.map((m) => (
                                                    <span
                                                        key={m.id}
                                                        className="status-badge success"
                                                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                        onClick={() => toggleOpenRouterModel(m)}
                                                        title="Click to remove"
                                                    >
                                                        {m.name} ✕
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Model list with checkboxes */}
                                    <div className="or-model-list" style={{ maxHeight: '480px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                                        {filteredORModels.map((model) => (
                                            <label
                                                key={model.id}
                                                className="or-model-item"
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    padding: '10px 14px',
                                                    borderBottom: '1px solid var(--border-light)',
                                                    cursor: 'pointer',
                                                    transition: 'background 0.15s',
                                                    background: selectedORIds.has(model.id) ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.background = selectedORIds.has(model.id) ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-card)'}
                                                onMouseOut={(e) => e.currentTarget.style.background = selectedORIds.has(model.id) ? 'rgba(99, 102, 241, 0.08)' : 'transparent'}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedORIds.has(model.id)}
                                                    onChange={() => toggleOpenRouterModel(model)}
                                                    style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px', flexShrink: 0 }}
                                                />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 500, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {model.name}
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                                        {model.id}
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginBottom: '2px' }}>
                                                        {model.supportsTools && (
                                                            <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>🔧 Tools</span>
                                                        )}
                                                        {model.contextWindow && (
                                                            <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                                                                {formatTokens(model.contextWindow)} ctx
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                        {model.inputPricePerMillion_INR > 0
                                                            ? `₹${model.inputPricePerMillion_INR.toFixed(1)} / ₹${model.outputPricePerMillion_INR.toFixed(1)} per 1M`
                                                            : 'Free'}
                                                    </div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* BigQuery Tab */}
            {activeTab === 'bigquery' && (
                <div className="settings-section">
                    <h2>☁️ Google BigQuery</h2>

                    {session ? (
                        <>
                            <div className="connected-account">
                                <div className="connected-account-info">
                                    {session.user?.image && (
                                        <img src={session.user.image} alt="" />
                                    )}
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                            {session.user?.name}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            {session.user?.email}
                                        </div>
                                    </div>
                                </div>
                                <button className="btn btn-danger btn-sm" onClick={() => signOut()}>
                                    Disconnect
                                </button>
                            </div>

                            <div className="form-group" style={{ marginTop: '16px' }}>
                                <label className="form-label">BigQuery Project ID</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={bqProjectId}
                                    onChange={(e) => setBqProjectId(e.target.value)}
                                    placeholder="your-gcp-project-id"
                                />
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                                    Enter the Google Cloud Project ID that contains your BigQuery datasets.
                                </span>
                            </div>
                        </>
                    ) : (
                        <div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                Connect your Google account to access BigQuery datasets and run queries.
                            </p>
                            <button
                                className="btn btn-google"
                                onClick={() => signIn('google')}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Connect with Google
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Ad Platforms Tab */}
            {activeTab === 'ads' && (
                <>
                    {/* Google Ads */}
                    <div className="settings-section">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <h2>📈 Google Ads</h2>
                            <button
                                className={`toggle-switch ${googleAdsConfig.enabled ? 'active' : ''}`}
                                onClick={() => setGoogleAdsConfig({ enabled: !googleAdsConfig.enabled })}
                            >
                                <div className="toggle-switch-knob" />
                            </button>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                            Connect your Google Ads account to query campaign performance, keywords, and ad metrics directly from DataLens.
                        </p>

                        {googleAdsConfig.enabled && (
                            <>
                                {[
                                    { key: 'clientId', label: 'Client ID', placeholder: 'OAuth Client ID' },
                                    { key: 'clientSecret', label: 'Client Secret', placeholder: 'OAuth Client Secret', type: 'password' },
                                    { key: 'refreshToken', label: 'Refresh Token', placeholder: 'OAuth Refresh Token', type: 'password' },
                                    { key: 'developerToken', label: 'Developer Token', placeholder: 'Google Ads API Developer Token', type: 'password' },
                                    { key: 'loginCustomerId', label: 'Login Customer ID', placeholder: 'MCC Account ID (without dashes)' },
                                    { key: 'customerId', label: 'Customer ID', placeholder: 'Target Account ID (without dashes)' },
                                ].map((field) => (
                                    <div key={field.key} className="form-group" style={{ marginBottom: '10px' }}>
                                        <label className="form-label">{field.label}</label>
                                        <input
                                            type={field.type || 'text'}
                                            className="form-input"
                                            value={googleAdsConfig[field.key] || ''}
                                            onChange={(e) => setGoogleAdsConfig({ [field.key]: e.target.value })}
                                            placeholder={field.placeholder}
                                        />
                                    </div>
                                ))}
                                <button
                                    className="btn btn-primary"
                                    onClick={testGoogleAdsConnection}
                                    style={{ marginTop: '8px' }}
                                >
                                    Test Connection
                                </button>
                            </>
                        )}
                    </div>

                    {/* Meta Ads */}
                    <div className="settings-section">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <h2>📘 Meta Ads</h2>
                            <button
                                className={`toggle-switch ${metaAdsConfig.enabled ? 'active' : ''}`}
                                onClick={() => setMetaAdsConfig({ enabled: !metaAdsConfig.enabled })}
                            >
                                <div className="toggle-switch-knob" />
                            </button>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                            Connect your Meta/Facebook Ads account to analyze campaign performance, audiences, and creative metrics.
                        </p>

                        {metaAdsConfig.enabled && (
                            <>
                                {[
                                    { key: 'accessToken', label: 'Access Token', placeholder: 'Meta Marketing API Access Token', type: 'password' },
                                    { key: 'appId', label: 'App ID (optional)', placeholder: 'Facebook App ID' },
                                    { key: 'appSecret', label: 'App Secret (optional)', placeholder: 'Facebook App Secret', type: 'password' },
                                ].map((field) => (
                                    <div key={field.key} className="form-group" style={{ marginBottom: '10px' }}>
                                        <label className="form-label">{field.label}</label>
                                        <input
                                            type={field.type || 'text'}
                                            className="form-input"
                                            value={metaAdsConfig[field.key] || ''}
                                            onChange={(e) => setMetaAdsConfig({ [field.key]: e.target.value })}
                                            placeholder={field.placeholder}
                                        />
                                    </div>
                                ))}
                                <button
                                    className="btn btn-primary"
                                    onClick={testMetaAdsConnection}
                                    style={{ marginTop: '8px' }}
                                >
                                    Test Connection
                                </button>
                            </>
                        )}
                    </div>
                </>
            )}

            {/* System Prompt Tab */}
            {activeTab === 'prompt' && (
                <div className="settings-section">
                    <h2>📝 System Prompt</h2>

                    {/* Temperature Slider */}
                    <div className="settings-subsection" style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <label className="form-label" style={{ margin: 0 }}>🌡️ Temperature: {temperature.toFixed(1)}</label>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '4px', background: 'var(--bg-tertiary)' }}>
                                {temperature <= 0.2 ? 'Precise' : temperature <= 0.4 ? 'Analytical' : temperature <= 0.6 ? 'Balanced' : temperature <= 0.8 ? 'Creative' : 'Experimental'}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={temperature}
                            onChange={(e) => setTemperature(parseFloat(e.target.value))}
                            className="temperature-slider"
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            <span>Precise (0.0)</span>
                            <span>Creative (1.0)</span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                            Lower values produce more factual, deterministic responses — ideal for data analysis. Higher values encourage creativity — great for brainstorming ad copies and strategies.
                        </p>
                    </div>

                    <div className="toggle-row">
                        <div>
                            <div className="toggle-label">Digital Marketing & CRM Context</div>
                            <div className="toggle-desc">
                                Include specialized knowledge for campaign analytics, CRM, and marketing metrics
                            </div>
                        </div>
                        <button
                            className={`toggle-switch ${systemPromptEnabled ? 'active' : ''}`}
                            onClick={() => setSystemPromptEnabled(!systemPromptEnabled)}
                        >
                            <div className="toggle-switch-knob" />
                        </button>
                    </div>

                    <div className="form-group" style={{ marginTop: '16px' }}>
                        <label className="form-label">System Prompt (editable)</label>
                        <textarea
                            className="form-textarea"
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            rows={10}
                        />
                    </div>

                    <button
                        className="btn btn-secondary"
                        onClick={() => {
                            const DEFAULT_PROMPT = `You are a senior data analyst specializing in digital marketing campaigns and CRM analytics. You help analyze campaign performance, customer segmentation, attribution modeling, ROAS (Return on Ad Spend), CAC (Customer Acquisition Cost), LTV (Lifetime Value), funnel metrics, cohort analysis, retention curves, and more.

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
                            setSystemPrompt(DEFAULT_PROMPT);
                            toast.success('Prompt restored to default');
                        }}
                    >
                        Reset to Default
                    </button>
                </div>
            )}

            {/* Account Tab */}
            {activeTab === 'account' && (
                <div className="settings-section">
                    <h2>👤 Account</h2>

                    {firebaseUser ? (
                        <div className="provider-card">
                            <div className="provider-card-header">
                                <div className="provider-icon" style={{ background: 'var(--accent-primary)' + '20', color: 'var(--accent-primary)', fontSize: '1.2rem' }}>
                                    {firebaseUser.photoURL ? (
                                        <img
                                            src={firebaseUser.photoURL}
                                            alt=""
                                            style={{ width: '100%', height: '100%', borderRadius: '50%' }}
                                        />
                                    ) : (
                                        '👤'
                                    )}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{firebaseUser.displayName || 'User'}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{firebaseUser.email}</div>
                                </div>
                            </div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '12px 0' }}>
                                Your settings, conversations, and usage data are synced to the cloud and available across devices.
                            </p>
                            <button className="btn btn-danger" onClick={handleSignOut}>
                                Sign Out
                            </button>
                        </div>
                    ) : (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            Not signed in. Please refresh the page.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
