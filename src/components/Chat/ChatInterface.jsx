'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useAppStore } from '@/store/app-store';
import { MODELS, getModelById, getModelsByProvider, MODEL_PROVIDERS, formatINR, formatTokens } from '@/services/llm/model-registry';
import { HiOutlinePaperAirplane, HiOutlineTableCells } from 'react-icons/hi2';
import MessageBubble from './MessageBubble';
import TableSelector from './TableSelector';
import AdsAccountSelector from './AdsAccountSelector';
import AgentProgress from './AgentProgress';

export default function ChatInterface() {
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [tablePanelOpen, setTablePanelOpen] = useState(false);
    const [adsPanelOpen, setAdsPanelOpen] = useState(false);
    const [agentSteps, setAgentSteps] = useState([]);
    const [agentCurrentStatus, setAgentCurrentStatus] = useState('');
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const { data: session } = useSession();

    const {
        selectedModel,
        selectedProvider,
        setSelectedModel,
        thinkingEnabled,
        setThinkingEnabled,
        apiKeys,
        systemPromptEnabled,
        systemPrompt,
        temperature,
        ollamaBaseUrl,
        localServerUrl,
        ollamaModels,
        bqProjectId,
        selectedTables,
        tableSchemas,
        googleAdsConfig,
        metaAdsConfig,
        selectedGoogleAdsAccounts,
        selectedMetaAdsAccounts,
        activeConversationId,
        createConversation,
        addMessage,
        updateMessage,
        getActiveConversation,
        addUsageEntry,
    } = useAppStore();

    const conv = getActiveConversation();
    const currentModel = getModelById(selectedModel, ollamaModels);

    const availableModels = useCallback(() => {
        const models = [];
        if (apiKeys.gemini) models.push(...getModelsByProvider('gemini'));
        if (apiKeys.anthropic) models.push(...getModelsByProvider('anthropic'));
        if (apiKeys.openai) models.push(...getModelsByProvider('openai'));
        if (apiKeys.grok) models.push(...getModelsByProvider('grok'));
        if (ollamaModels.length > 0) models.push(...ollamaModels);
        models.push(...getModelsByProvider('local-server'));
        return models;
    }, [apiKeys, ollamaModels]);

    // Auto-correct selected model if it doesn't exist in available models
    // This fixes the visual desync where the dropdown shows one model but the
    // store holds a different (unavailable) model/provider
    useEffect(() => {
        const models = availableModels();
        if (models.length === 0) return;
        const found = models.find((m) => m.id === selectedModel);
        if (!found) {
            // Current selection is not in the available list — pick the first available
            const first = models[0];
            console.log(`[Auto-correct] Model "${selectedModel}" not found in available models. Switching to "${first.id}" (${first.provider})`);
            setSelectedModel(first.id, first.provider);
        }
    }, [selectedModel, availableModels, setSelectedModel]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [conv?.messages, agentSteps, agentCurrentStatus]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
        }
    }, [input]);

    // Parse SSE stream from the chat API
    const consumeSSEStream = async (response, convId) => {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let receivedResult = false;
        let prevStatusMsg = ''; // Track outside the read loop to persist across chunks
        let currentEvent = '';  // Track outside the read loop to persist across chunk boundaries

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim();
                    } else if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6);
                        try {
                            const data = JSON.parse(dataStr);

                            if (currentEvent === 'status') {
                                // Only process if the message is genuinely new
                                if (data.message !== prevStatusMsg) {
                                    // Move the old status to completed steps
                                    if (prevStatusMsg) {
                                        const completedMsg = prevStatusMsg;
                                        setAgentSteps(prev => {
                                            // Guard against duplicates in the steps array
                                            if (prev.length > 0 && prev[prev.length - 1].message === completedMsg) return prev;
                                            return [...prev, { message: completedMsg, timestamp: Date.now() }];
                                        });
                                    }
                                    prevStatusMsg = data.message;
                                    setAgentCurrentStatus(data.message);
                                }
                            } else if (currentEvent === 'result') {
                                receivedResult = true;
                                // Final result received
                                const assistantMessage = {
                                    role: 'assistant',
                                    content: data.text || '',
                                    sql: data.sql || null,
                                    sqlResult: data.sqlResult || null,
                                    sqlError: data.sqlError || null,
                                    visualization: data.visualization || null,
                                    thinking: data.thinking || null,
                                    toolCalls: data.toolCalls || [],
                                    adsResults: data.adsResults || null,
                                    model: selectedModel,
                                    provider: selectedProvider,
                                    usage: data.usage || { inputTokens: 0, outputTokens: 0 },
                                    timestamp: new Date().toISOString(),
                                };
                                addMessage(convId, assistantMessage);

                                if (data.usage) {
                                    addUsageEntry({
                                        model: selectedModel,
                                        provider: selectedProvider,
                                        inputTokens: data.usage.inputTokens,
                                        outputTokens: data.usage.outputTokens,
                                        conversationId: convId,
                                    });
                                }
                            } else if (currentEvent === 'error') {
                                receivedResult = true;
                                addMessage(convId, {
                                    role: 'assistant',
                                    content: `**Error:** ${data.message}`,
                                    isError: true,
                                    model: selectedModel,
                                    provider: selectedProvider,
                                    usage: { inputTokens: 0, outputTokens: 0 },
                                    timestamp: new Date().toISOString(),
                                });
                            } else if (currentEvent === 'done') {
                                // Stream ended
                            }
                        } catch (parseErr) {
                            console.error('SSE JSON parse error:', parseErr.message, 'Raw failing string:', dataStr.substring(0, 200) + '...');
                        }
                        currentEvent = '';
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        // If the stream ended without ever sending a result or error, show a fallback message
        if (!receivedResult) {
            addMessage(convId, {
                role: 'assistant',
                content: '**Error:** The agent stream ended unexpectedly without returning a result. This may be caused by a tool execution timeout or a server-side error. Please try again.',
                isError: true,
                model: selectedModel,
                provider: selectedProvider,
                usage: { inputTokens: 0, outputTokens: 0 },
                timestamp: new Date().toISOString(),
            });
        }
    };

    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed || loading) return;

        let convId = activeConversationId;
        if (!convId) {
            convId = createConversation();
        }

        const userMessage = {
            role: 'user',
            content: trimmed,
            timestamp: new Date().toISOString(),
        };
        addMessage(convId, userMessage);
        setInput('');
        setLoading(true);
        setAgentSteps([]);
        setAgentCurrentStatus('');

        try {
            const currentConv = useAppStore.getState().conversations.find((c) => c.id === convId);
            const messageHistory = (currentConv?.messages || []).map((m) => ({
                role: m.role,
                content: m.content,
            }));

            const tablesWithSchema = selectedTables.map((t) => {
                const key = `${t.project}.${t.dataset}.${t.table}`;
                return { ...t, schema: tableSchemas[key] || [] };
            });

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: messageHistory,
                    model: selectedModel,
                    provider: selectedProvider,
                    apiKey: apiKeys[selectedProvider] || '',
                    systemPromptEnabled,
                    systemPrompt,
                    selectedTables: tablesWithSchema,
                    thinkingEnabled,
                    temperature,
                    ollamaBaseUrl,
                    localServerUrl,
                    bqAccessToken: session?.accessToken || '',
                    bqProjectId,
                    googleAdsConfig,
                    metaAdsConfig,
                    selectedGoogleAdsAccounts,
                    selectedMetaAdsAccounts,
                }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Request failed: ${res.status}`);
            }

            // Consume SSE stream
            await consumeSSEStream(res, convId);
        } catch (err) {
            addMessage(convId, {
                role: 'assistant',
                content: `**Error:** ${err.message}`,
                isError: true,
                model: selectedModel,
                provider: selectedProvider,
                usage: { inputTokens: 0, outputTokens: 0 },
                timestamp: new Date().toISOString(),
            });
        } finally {
            setLoading(false);
            setAgentSteps([]);
            setAgentCurrentStatus('');
        }
    };

    const handleVizRetry = async (msgIndex, error) => {
        const convId = activeConversationId;
        if (!convId) return;

        const currentConv = useAppStore.getState().conversations.find((c) => c.id === convId);
        const msg = currentConv?.messages?.[msgIndex];
        if (!msg) return;

        const retryCount = msg.vizRetries || 0;
        if (retryCount >= 3) return;

        setLoading(true);
        setAgentSteps([]);
        setAgentCurrentStatus('🎨 Regenerating visualization...');

        try {
            const messageHistory = (currentConv.messages || [])
                .slice(0, msgIndex + 1)
                .map((m) => ({ role: m.role, content: m.content }));

            messageHistory.push({
                role: 'user',
                content: `The visualization code failed to render with this error: ${error}\nPlease fix the visualization code. This is retry attempt ${retryCount + 1}.`,
            });

            const tablesWithSchema = selectedTables.map((t) => {
                const key = `${t.project}.${t.dataset}.${t.table}`;
                return { ...t, schema: tableSchemas[key] || [] };
            });

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: messageHistory,
                    model: msg.model || selectedModel,
                    provider: msg.provider || selectedProvider,
                    apiKey: apiKeys[msg.provider || selectedProvider] || '',
                    systemPromptEnabled,
                    systemPrompt,
                    selectedTables: tablesWithSchema,
                    thinkingEnabled: false,
                    temperature,
                    ollamaBaseUrl,
                    localServerUrl,
                    bqAccessToken: session?.accessToken || '',
                    bqProjectId,
                    googleAdsConfig,
                    metaAdsConfig,
                    selectedGoogleAdsAccounts,
                    selectedMetaAdsAccounts,
                }),
            });

            // For viz retry, consume the SSE stream manually to extract viz data
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let resultData = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                let currentEvent = '';
                for (const line of lines) {
                    if (line.startsWith('event: ')) currentEvent = line.slice(7).trim();
                    else if (line.startsWith('data: ') && currentEvent === 'result') {
                        try { resultData = JSON.parse(line.slice(6)); } catch {}
                        currentEvent = '';
                    }
                }
            }
            reader.releaseLock();

            if (resultData?.visualization) {
                updateMessage(convId, msgIndex, {
                    visualization: resultData.visualization,
                    vizRetries: retryCount + 1,
                    vizError: null,
                });
            }
            if (resultData?.usage) {
                addUsageEntry({
                    model: msg.model || selectedModel,
                    provider: msg.provider || selectedProvider,
                    inputTokens: resultData.usage.inputTokens,
                    outputTokens: resultData.usage.outputTokens,
                    conversationId: convId,
                });
            }
        } catch (err) {
            updateMessage(convId, msgIndex, {
                vizError: err.message,
                vizRetries: retryCount + 1,
            });
        } finally {
            setLoading(false);
            setAgentSteps([]);
            setAgentCurrentStatus('');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const models = availableModels();
    const hasAdsConfigured = googleAdsConfig?.enabled || metaAdsConfig?.enabled;
    const adsCount = selectedGoogleAdsAccounts.length + selectedMetaAdsAccounts.length;

    return (
        <div className="chat-wrapper">
            <div className="chat-main">
                {/* Messages */}
                <div className="chat-messages">
                    {(!conv || conv.messages.length === 0) && (
                        <div className="chat-empty">
                            <div className="chat-empty-icon">◈</div>
                            <h2>DataLens AI</h2>
                            <p>
                                Your AI-powered data analyst. Connect BigQuery, Google Ads, Meta Ads, select tables, and ask
                                questions about your data. I&apos;ll write SQL, run queries, and create
                                visualizations for you.
                            </p>
                            {!session && (
                                <p style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--accent-warning)' }}>
                                    💡 Connect your Google account in Settings to query BigQuery
                                </p>
                            )}
                            {models.length === 0 && (
                                <p style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--accent-warning)' }}>
                                    ⚙️ Add API keys in Settings to get started
                                </p>
                            )}
                        </div>
                    )}

                    {conv?.messages.map((msg, i) => (
                        <MessageBubble
                            key={i}
                            message={msg}
                            index={i}
                            onVizRetry={(error) => handleVizRetry(i, error)}
                        />
                    ))}

                    {/* Agent Progress - streaming status */}
                    {loading && (
                        <AgentProgress
                            steps={agentSteps}
                            currentStatus={agentCurrentStatus}
                            isActive={loading}
                        />
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="chat-input-area">
                    <div className="chat-input-wrapper">
                        <textarea
                            ref={textareaRef}
                            className="chat-input"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask about your data..."
                            rows={1}
                            disabled={loading}
                        />
                        <button
                            className="chat-send-btn"
                            onClick={handleSend}
                            disabled={loading || !input.trim()}
                            title="Send message"
                        >
                            <HiOutlinePaperAirplane />
                        </button>
                    </div>
                    <div className="chat-input-controls">
                        <select
                            className="model-select"
                            value={selectedModel}
                            onChange={(e) => {
                                const m = getModelById(e.target.value) || models.find((x) => x.id === e.target.value);
                                if (m) setSelectedModel(m.id, m.provider);
                            }}
                        >
                            {Object.entries(MODEL_PROVIDERS).map(([key, prov]) => {
                                const provModels =
                                    key === 'ollama'
                                        ? ollamaModels
                                        : models.filter((m) => m.provider === key);
                                if (provModels.length === 0) return null;
                                return (
                                    <optgroup key={key} label={`${prov.icon} ${prov.name}`}>
                                        {provModels.map((m) => (
                                            <option key={m.id} value={m.id}>
                                                {m.name}
                                            </option>
                                        ))}
                                    </optgroup>
                                );
                            })}
                        </select>

                        {currentModel?.supportsThinking && (
                            <label className="thinking-toggle">
                                <input
                                    type="checkbox"
                                    checked={thinkingEnabled}
                                    onChange={(e) => setThinkingEnabled(e.target.checked)}
                                />
                                🧠 Thinking
                            </label>
                        )}

                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                            {hasAdsConfigured && (
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setAdsPanelOpen(!adsPanelOpen)}
                                >
                                    📈 Ads {adsCount > 0 && `(${adsCount})`}
                                </button>
                            )}
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setTablePanelOpen(!tablePanelOpen)}
                            >
                                <HiOutlineTableCells size={14} />
                                Tables {selectedTables.length > 0 && `(${selectedTables.length})`}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table Selector Panel */}
            <TableSelector open={tablePanelOpen} onClose={() => setTablePanelOpen(false)} />

            {/* Ads Account Selector Panel */}
            <AdsAccountSelector open={adsPanelOpen} onClose={() => setAdsPanelOpen(false)} />
        </div>
    );
}
