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
