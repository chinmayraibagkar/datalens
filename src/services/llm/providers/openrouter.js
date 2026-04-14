// OpenRouter provider — OpenAI-compatible API
// Docs: https://openrouter.ai/docs

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Basic chat completion via OpenRouter
 */
export async function chatOpenRouter({ model, messages, systemPrompt, apiKey, thinking, temperature }) {
    const msgs = [];

    if (systemPrompt) {
        msgs.push({ role: 'system', content: systemPrompt });
    }

    // Filter out tool-related messages for non-tool chat (fallback compatibility)
    for (const m of messages) {
        if (m.role === 'tool') continue; // skip tool results
        if (m.role === 'assistant' && m.toolCalls) {
            // For assistant messages with tool calls, only keep the text content
            if (m.content) msgs.push({ role: 'assistant', content: m.content });
            continue;
        }
        msgs.push({ role: m.role, content: m.content || '' });
    }

    const body = {
        model,
        messages: msgs,
        temperature: temperature ?? 0.7,
    };

    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://datalens.ai',
            'X-Title': 'DataLens AI',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenRouter API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];

    return {
        content: choice?.message?.content || '',
        thinking: null,
        usage: {
            inputTokens: data.usage?.prompt_tokens || 0,
            outputTokens: data.usage?.completion_tokens || 0,
        },
    };
}

/**
 * Tool-use chat completion via OpenRouter (OpenAI function calling format)
 * Falls back to non-tool chat if the model doesn't support tools.
 */
export async function chatOpenRouterWithTools({ model, messages, systemPrompt, apiKey, thinking, tools, temperature }) {
    // First, try with tools. If the model doesn't support them, fall back.
    const openaiTools = tools.map((t) => ({
        type: 'function',
        function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
        },
    }));

    const openaiMessages = [];
    if (systemPrompt) openaiMessages.push({ role: 'system', content: systemPrompt });

    for (const m of messages) {
        if (m.role === 'user') {
            openaiMessages.push({ role: 'user', content: m.content });
        } else if (m.role === 'assistant') {
            if (m.toolCalls && m.toolCalls.length > 0) {
                openaiMessages.push({
                    role: 'assistant',
                    content: m.content || null,
                    tool_calls: m.toolCalls.map((tc) => ({
                        id: tc.id,
                        type: 'function',
                        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
                    })),
                });
            } else {
                openaiMessages.push({ role: 'assistant', content: m.content });
            }
        } else if (m.role === 'tool') {
            openaiMessages.push({
                role: 'tool',
                tool_call_id: m.toolCallId,
                content: m.content,
            });
        }
    }

    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://datalens.ai',
            'X-Title': 'DataLens AI',
        },
        body: JSON.stringify({
            model,
            messages: openaiMessages,
            tools: openaiTools,
            temperature: temperature ?? 0.7,
        }),
    });

    if (!res.ok) {
        const errText = await res.text();
        let errMsg;
        try {
            const errObj = JSON.parse(errText);
            errMsg = errObj.error?.message || errObj.error || errText;
        } catch {
            errMsg = errText;
        }
        console.error(`[OpenRouter] Error ${res.status}: ${errMsg}`);

        // If the model doesn't support tools, retry WITHOUT tools
        // OpenRouter's upstream providers (especially free endpoints) often return 429 or opaque "Provider returned error" instead of 400 when they fail to parse a tool schema.
        const errorString = String(errMsg).toLowerCase();
        if (
            res.status === 400 || 
            res.status === 422 || 
            res.status === 429 || 
            errorString.includes('tool') || 
            errorString.includes('unsupported parameter') ||
            errorString.includes('provider returned error')
        ) {
            console.log('[OpenRouter] Falling back to non-tool chat...');
            return chatOpenRouter({ model, messages, systemPrompt, apiKey, thinking, temperature });
        }

        throw new Error(`OpenRouter error (${res.status}): ${errMsg}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const msg = choice?.message;

    const responseToolCalls = (msg?.tool_calls || []).map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments || '{}'),
    }));

    return {
        content: msg?.content || '',
        toolCalls: responseToolCalls.length > 0 ? responseToolCalls : null,
        usage: {
            inputTokens: data.usage?.prompt_tokens || 0,
            outputTokens: data.usage?.completion_tokens || 0,
        },
    };
}

/**
 * Fetch all available models from OpenRouter
 */
export async function fetchOpenRouterModels(apiKey) {
    const res = await fetch(`${OPENROUTER_BASE_URL}/models`, {
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://datalens.ai',
            'X-Title': 'DataLens AI',
        },
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch OpenRouter models: ${res.status}`);
    }

    const data = await res.json();
    const INR_PER_USD = 83;

    return (data.data || []).map((m) => ({
        id: m.id,
        name: m.name || m.id,
        provider: 'openrouter',
        contextWindow: m.context_length || null,
        inputPricePerMillion_INR: parseFloat(m.pricing?.prompt || '0') * 1_000_000 * INR_PER_USD,
        outputPricePerMillion_INR: parseFloat(m.pricing?.completion || '0') * 1_000_000 * INR_PER_USD,
        supportsThinking: false,
        supportsTools: (m.supported_parameters || []).includes('tools'),
        isLocal: false,
        // Extra metadata for UI
        _description: m.description || '',
        _architecture: m.architecture || {},
    }));
}
