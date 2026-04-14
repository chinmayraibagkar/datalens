// Ollama local provider
export async function chatOllama({ model, messages, systemPrompt, baseUrl }) {
    const ollamaMessages = [];

    if (systemPrompt) {
        ollamaMessages.push({ role: 'system', content: systemPrompt });
    }

    ollamaMessages.push(
        ...messages.map((m) => ({ role: m.role, content: m.content }))
    );

    const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            messages: ollamaMessages,
            stream: false,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Ollama error (${res.status}): ${err}`);
    }

    const data = await res.json();

    return {
        content: data.message?.content || '',
        thinking: null,
        usage: {
            inputTokens: data.prompt_eval_count || 0,
            outputTokens: data.eval_count || 0,
        },
    };
}

export async function listOllamaModels(baseUrl) {
    try {
        const res = await fetch(`${baseUrl}/api/tags`);
        if (!res.ok) throw new Error('Failed to fetch Ollama models');
        const data = await res.json();
        return (data.models || []).map((m) => ({
            id: m.name,
            name: m.name,
            provider: 'ollama',
            contextWindow: null,
            inputPricePerMillion_INR: 0,
            outputPricePerMillion_INR: 0,
            supportsThinking: false,
            isLocal: true,
        }));
    } catch (e) {
        console.error('Error fetching Ollama models:', e);
        return [];
    }
}

// Ollama tool-use variant
export async function chatOllamaWithTools({ model, messages, systemPrompt, tools, baseUrl }) {
    const ollamaMessages = [];

    if (systemPrompt) {
        ollamaMessages.push({ role: 'system', content: systemPrompt });
    }

    for (const m of messages) {
        if (m.role === 'user') {
            ollamaMessages.push({ role: 'user', content: m.content });
        } else if (m.role === 'assistant') {
            if (m.toolCalls && m.toolCalls.length > 0) {
                ollamaMessages.push({
                    role: 'assistant',
                    content: m.content || '',
                    tool_calls: m.toolCalls.map(tc => ({
                        function: {
                            name: tc.name,
                            arguments: tc.arguments,
                        },
                    })),
                });
            } else {
                ollamaMessages.push({ role: 'assistant', content: m.content });
            }
        } else if (m.role === 'tool') {
            ollamaMessages.push({
                role: 'tool',
                content: m.content,
            });
        }
    }

    // Convert tools to Ollama format
    const ollamaTools = tools.map(t => ({
        type: 'function',
        function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
        },
    }));

    const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            messages: ollamaMessages,
            tools: ollamaTools.length > 0 ? ollamaTools : undefined,
            stream: false,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Ollama error (${res.status}): ${err}`);
    }

    const data = await res.json();

    // Parse tool calls from response
    const responseToolCalls = [];
    if (data.message?.tool_calls && Array.isArray(data.message.tool_calls)) {
        for (const tc of data.message.tool_calls) {
            responseToolCalls.push({
                id: `ollama_tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                name: tc.function?.name,
                arguments: typeof tc.function?.arguments === 'string'
                    ? JSON.parse(tc.function.arguments)
                    : tc.function?.arguments || {},
            });
        }
    }

    return {
        content: data.message?.content || '',
        toolCalls: responseToolCalls.length > 0 ? responseToolCalls : null,
        thinking: null,
        usage: {
            inputTokens: data.prompt_eval_count || 0,
            outputTokens: data.eval_count || 0,
        },
    };
}

