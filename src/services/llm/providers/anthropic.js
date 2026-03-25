// Anthropic Claude provider
export async function chatAnthropic({ model, messages, systemPrompt, apiKey, thinking, temperature }) {
    const body = {
        model,
        max_tokens: 65536,
        messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
        })),
    };

    if (systemPrompt) {
        body.system = systemPrompt;
    }

    // Extended thinking for supported models
    if (thinking) {
        body.thinking = {
            type: 'enabled',
            budget_tokens: 4096,
        };
        body.temperature = 1; // required with extended thinking
    } else {
        body.temperature = temperature ?? 0.7;
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Anthropic API error (${res.status}): ${err}`);
    }

    const data = await res.json();

    let content = '';
    let thinkingContent = '';

    if (data.content) {
        for (const block of data.content) {
            if (block.type === 'thinking') {
                thinkingContent += block.thinking;
            } else if (block.type === 'text') {
                content += block.text;
            }
        }
    }

    return {
        content,
        thinking: thinkingContent || null,
        usage: {
            inputTokens: data.usage?.input_tokens || 0,
            outputTokens: data.usage?.output_tokens || 0,
        },
    };
}
