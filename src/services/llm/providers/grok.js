// xAI Grok provider (OpenAI-compatible API)
export async function chatGrok({ model, messages, systemPrompt, apiKey, thinking, temperature }) {
    const msgs = [];

    if (systemPrompt) {
        msgs.push({ role: 'system', content: systemPrompt });
    }

    msgs.push(...messages.map((m) => ({ role: m.role, content: m.content })));

    const body = {
        model,
        messages: msgs,
        temperature: temperature ?? 0.7,
    };

    const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Grok API error (${res.status}): ${err}`);
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
