// Custom local server provider (Anthropic-style API)
export async function chatLocalServer({ model, messages, systemPrompt, serverUrl }) {
    const body = {
        model,
        max_tokens: 65536,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
    };

    if (systemPrompt) {
        body.system = systemPrompt;
    }

    const res = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Local server error (${res.status}): ${err}`);
    }

    const data = await res.json();

    let content = '';
    let thinkingContent = '';

    if (data.content && Array.isArray(data.content)) {
        for (const block of data.content) {
            if (block.type === 'thinking') {
                thinkingContent += block.thinking;
            } else if (block.type === 'text') {
                content += block.text;
            }
        }
    } else if (typeof data.content === 'string') {
        content = data.content;
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

// Custom local server provider with Tool Support (Anthropic API schema)
export async function chatLocalServerWithTools({ model, messages, systemPrompt, serverUrl, tools }) {
    const anthropicTools = tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
    }));

    const anthropicMessages = [];
    for (const m of messages) {
        if (m.role === 'user' || m.role === 'assistant') {
            if (m.toolCalls && m.toolCalls.length > 0) {
                const content = [];
                if (m.content) content.push({ type: 'text', text: m.content });
                for (const tc of m.toolCalls) {
                    content.push({
                        type: 'tool_use',
                        id: tc.id,
                        name: tc.name,
                        input: tc.arguments,
                    });
                }
                anthropicMessages.push({ role: 'assistant', content });
            } else {
                anthropicMessages.push({ role: m.role, content: m.content });
            }
        } else if (m.role === 'tool') {
            anthropicMessages.push({
                role: 'user',
                content: [{
                    type: 'tool_result',
                    tool_use_id: m.toolCallId,
                    content: m.content,
                }],
            });
        }
    }

    const body = {
        model,
        max_tokens: 65536,
        messages: anthropicMessages,
        tools: anthropicTools,
    };

    if (systemPrompt) {
        body.system = systemPrompt;
    }

    const res = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Local server error (${res.status})`);
    }

    const data = await res.json();

    const responseToolCalls = [];
    let textContent = '';
    let thinkingContent = '';

    for (const block of data.content || []) {
        if (block.type === 'thinking') {
            thinkingContent += block.thinking;
        } else if (block.type === 'text') {
            textContent += block.text;
        } else if (block.type === 'tool_use') {
            responseToolCalls.push({
                id: block.id,
                name: block.name,
                arguments: block.input,
            });
        }
    }

    // Fallback if the local server returns a string instead of array
    if (typeof data.content === 'string') {
        textContent = data.content;
    }

    return {
        content: textContent,
        thinking: thinkingContent || null,
        toolCalls: responseToolCalls.length > 0 ? responseToolCalls : null,
        usage: {
            inputTokens: data.usage?.input_tokens || 0,
            outputTokens: data.usage?.output_tokens || 0,
        },
    };
}
