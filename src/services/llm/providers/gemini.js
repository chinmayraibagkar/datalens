// Gemini provider - Google AI Studio API
export async function chatGemini({ model, messages, systemPrompt, apiKey, thinking, temperature }) {
    const contents = [];

    for (const msg of messages) {
        contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
        });
    }

    const body = {
        contents,
        generationConfig: {
            temperature: temperature ?? 0.7,
            maxOutputTokens: 65536,
        },
    };

    if (systemPrompt) {
        body.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    if (thinking && model !== 'gemini-2.5-flash-lite' && model !== 'gemini-3-flash') {
        body.generationConfig.thinkingConfig = { thinkingBudget: 2048 };
    }

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }
    );

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];

    let content = '';
    let thinkingContent = '';

    if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
            if (part.thought) {
                thinkingContent += part.text;
            } else {
                content += part.text;
            }
        }
    }

    const usage = data.usageMetadata || {};

    return {
        content,
        thinking: thinkingContent || null,
        usage: {
            inputTokens: usage.promptTokenCount || 0,
            outputTokens: usage.candidatesTokenCount || 0,
        },
    };
}


// Gemini with function calling / tool use
export async function chatGeminiWithTools({ model, messages, systemPrompt, apiKey, thinking, tools, temperature }) {
    const contents = [];

    for (const msg of messages) {
        if (msg.role === 'user') {
            contents.push({
                role: 'user',
                parts: [{ text: msg.content }],
            });
        } else if (msg.role === 'assistant') {
            const parts = [];
            if (msg.content) parts.push({ text: msg.content });
            if (msg.toolCalls) {
                for (const tc of msg.toolCalls) {
                    parts.push({
                        functionCall: {
                            name: tc.name,
                            args: tc.arguments,
                        },
                    });
                }
            }
            if (parts.length > 0) {
                contents.push({ role: 'model', parts });
            }
        } else if (msg.role === 'tool') {
            contents.push({
                role: 'user',
                parts: [{
                    functionResponse: {
                        name: msg.name,
                        response: JSON.parse(msg.content),
                    },
                }],
            });
        }
    }

    // Convert to Gemini function declarations format
    const functionDeclarations = tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
    }));

    const body = {
        contents,
        tools: [{ functionDeclarations }],
        generationConfig: {
            temperature: temperature ?? 0.7,
            maxOutputTokens: 65536,
        },
    };

    if (systemPrompt) {
        body.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    if (thinking && model !== 'gemini-2.5-flash-lite' && model !== 'gemini-3-flash') {
        body.generationConfig.thinkingConfig = { thinkingBudget: 2048 };
    }

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }
    );

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];

    let content = '';
    let thinkingContent = '';
    const toolCalls = [];

    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
        if (candidate.finishReason === 'SAFETY') {
            throw new Error('Response blocked by Google safety filters.');
        }
        if (candidate.finishReason !== 'MAX_TOKENS') {
            throw new Error(`Execution stopped with finish reason: ${candidate.finishReason}`);
        }
    }

    if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
            if (part.thought) {
                thinkingContent += part.text;
            } else if (part.functionCall) {
                toolCalls.push({
                    id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                    name: part.functionCall.name,
                    arguments: part.functionCall.args || {},
                });
            } else if (part.text) {
                content += part.text;
            }
        }
    }

    const usage = data.usageMetadata || {};

    return {
        content,
        thinking: thinkingContent || null,
        toolCalls: toolCalls.length > 0 ? toolCalls : null,
        usage: {
            inputTokens: usage.promptTokenCount || 0,
            outputTokens: usage.candidatesTokenCount || 0,
        },
    };
}
