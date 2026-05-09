// LM Studio local provider
// Uses OpenAI-compatible endpoints for chat (/v1/chat/completions)
// Uses native API for model management (/api/v1/models, /api/v1/models/load, /api/v1/models/unload)

// ─── Chat (non-tool) ───
export async function chatLMStudio({ model, messages, systemPrompt, baseUrl }) {
    const lmsMessages = [];

    if (systemPrompt) {
        lmsMessages.push({ role: 'system', content: systemPrompt });
    }

    lmsMessages.push(
        ...messages.map((m) => ({ role: m.role, content: m.content }))
    );

    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            messages: lmsMessages,
            stream: false,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`LM Studio error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const msg = choice?.message;

    return {
        content: msg?.content || '',
        thinking: null,
        usage: {
            inputTokens: data.usage?.prompt_tokens || 0,
            outputTokens: data.usage?.completion_tokens || 0,
        },
    };
}

// ─── Chat with Tools (OpenAI-compatible format) ───
export async function chatLMStudioWithTools({ model, messages, systemPrompt, tools, baseUrl }) {
    const lmsMessages = [];

    if (systemPrompt) {
        lmsMessages.push({ role: 'system', content: systemPrompt });
    }

    for (const m of messages) {
        if (m.role === 'user') {
            lmsMessages.push({ role: 'user', content: m.content });
        } else if (m.role === 'assistant') {
            if (m.toolCalls && m.toolCalls.length > 0) {
                lmsMessages.push({
                    role: 'assistant',
                    content: m.content || null,
                    tool_calls: m.toolCalls.map(tc => ({
                        id: tc.id,
                        type: 'function',
                        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
                    })),
                });
            } else {
                lmsMessages.push({ role: 'assistant', content: m.content });
            }
        } else if (m.role === 'tool') {
            lmsMessages.push({
                role: 'tool',
                tool_call_id: m.toolCallId,
                content: m.content,
            });
        }
    }

    // Convert tools to OpenAI format
    const openaiTools = tools.map(t => ({
        type: 'function',
        function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
        },
    }));

    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            messages: lmsMessages,
            tools: openaiTools.length > 0 ? openaiTools : undefined,
            stream: false,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`LM Studio error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const msg = choice?.message;

    const responseToolCalls = (msg?.tool_calls || []).map(tc => ({
        id: tc.id || `lms_tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: tc.function.name,
        arguments: typeof tc.function.arguments === 'string'
            ? JSON.parse(tc.function.arguments || '{}')
            : tc.function.arguments || {},
    }));

    return {
        content: msg?.content || '',
        toolCalls: responseToolCalls.length > 0 ? responseToolCalls : null,
        thinking: null,
        usage: {
            inputTokens: data.usage?.prompt_tokens || 0,
            outputTokens: data.usage?.completion_tokens || 0,
        },
    };
}

// ─── List available models (via server proxy to avoid CORS) ───
export async function listLMStudioModels(baseUrl) {
    try {
        const res = await fetch('/api/lmstudio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'list', baseUrl }),
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Failed to fetch LM Studio models (${res.status})`);
        }
        const data = await res.json();

        // Filter to LLMs only (exclude embedding models)
        return (data.models || [])
            .filter(m => m.type === 'llm')
            .map((m) => ({
                id: m.key,
                name: m.display_name || m.key,
                provider: 'lmstudio',
                contextWindow: m.max_context_length || null,
                inputPricePerMillion_INR: 0,
                outputPricePerMillion_INR: 0,
                supportsThinking: false,
                supportsTools: m.capabilities?.trained_for_tool_use || false,
                isLocal: true,
                // LM Studio specific metadata
                isLoaded: (m.loaded_instances || []).length > 0,
                loadedInstanceId: m.loaded_instances?.[0]?.id || null,
                loadedContextLength: m.loaded_instances?.[0]?.config?.context_length || null,
                architecture: m.architecture || null,
                quantization: m.quantization?.name || null,
                sizeBytes: m.size_bytes || 0,
                paramsString: m.params_string || null,
                publisher: m.publisher || null,
                hasVision: m.capabilities?.vision || false,
            }));
    } catch (e) {
        console.error('Error fetching LM Studio models:', e);
        throw e;
    }
}

// ─── Load a model into memory (via server proxy) ───
export async function loadLMStudioModel(baseUrl, modelKey) {
    const res = await fetch('/api/lmstudio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load', baseUrl, modelKey }),
    });

    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to load model (${res.status})`);
    }

    return await res.json();
}

// ─── Unload a model from memory (via server proxy) ───
export async function unloadLMStudioModel(baseUrl, instanceId) {
    const res = await fetch('/api/lmstudio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unload', baseUrl, instanceId }),
    });

    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to unload model (${res.status})`);
    }

    return await res.json();
}
