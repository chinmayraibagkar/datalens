'use client';

import { useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useAppStore } from '@/store/app-store';
import { MODEL_PROVIDERS } from '@/services/llm/model-registry';
import toast from 'react-hot-toast';

const TABS = [
    { id: 'apikeys', label: '🔑 API Keys' },
    { id: 'local', label: '🖥️ Local Models' },
    { id: 'bigquery', label: '☁️ BigQuery' },
    { id: 'ads', label: '📈 Ad Platforms' },
    { id: 'prompt', label: '📝 System Prompt' },
];

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('apikeys');
    const { data: session } = useSession();

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

    const TEMP_LABELS = [
        { val: 0, label: 'Precise' },
        { val: 0.3, label: 'Analytical' },
        { val: 0.5, label: 'Balanced' },
        { val: 0.7, label: 'Creative' },
        { val: 1.0, label: 'Experimental' },
    ];

    return (
        <div className="settings-page">
            <h1>⚙️ Settings <span style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--accent-primary)', verticalAlign: 'middle' }}>v0.4</span></h1>

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
                                    value={apiKeys[provider.key]}
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
                    </div>
                </>
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
        </div>
    );
}
