// Unified LLM adapter - routes to the correct provider
import { chatGemini, chatGeminiWithTools } from './providers/gemini';
import { chatAnthropic } from './providers/anthropic';
import { chatOpenAI } from './providers/openai';
import { chatGrok } from './providers/grok';
import { chatOllama, chatOllamaWithTools } from './providers/ollama';
import { chatLMStudio, chatLMStudioWithTools } from './providers/lmstudio';
import { chatLocalServer, chatLocalServerWithTools } from './providers/local-server';
import { chatOpenRouter, chatOpenRouterWithTools } from './providers/openrouter';

export async function chatWithModel({
    provider,
    model,
    messages,
    systemPrompt,
    apiKey,
    thinking = false,
    temperature,
    ollamaBaseUrl,
    lmStudioBaseUrl,
    localServerUrl,
}) {
    switch (provider) {
        case 'gemini':
            return chatGemini({ model, messages, systemPrompt, apiKey, thinking, temperature });
        case 'anthropic':
            return chatAnthropic({ model, messages, systemPrompt, apiKey, thinking, temperature });
        case 'openai':
            return chatOpenAI({ model, messages, systemPrompt, apiKey, thinking, temperature });
        case 'grok':
            return chatGrok({ model, messages, systemPrompt, apiKey, thinking, temperature });
        case 'openrouter':
            return chatOpenRouter({ model, messages, systemPrompt, apiKey, thinking, temperature });
        case 'ollama':
            return chatOllama({
                model,
                messages,
                systemPrompt,
                baseUrl: ollamaBaseUrl || 'http://localhost:11434',
            });
        case 'lmstudio':
            return chatLMStudio({
                model,
                messages,
                systemPrompt,
                baseUrl: lmStudioBaseUrl || 'http://localhost:1234',
            });
        case 'local-server':
            return chatLocalServer({
                model,
                messages,
                systemPrompt,
                serverUrl: localServerUrl || 'http://localhost:8080/v1/messages',
            });
        default:
            throw new Error(`Unknown provider: ${provider}`);
    }
}

// Tool-use variant: sends tool definitions and handles function calling
export async function chatWithTools({
    provider,
    model,
    messages,
    systemPrompt,
    apiKey,
    thinking = false,
    temperature,
    tools = [],
    ollamaBaseUrl,
    lmStudioBaseUrl,
    localServerUrl,
}) {
    switch (provider) {
        case 'gemini':
            return chatGeminiWithTools({ model, messages, systemPrompt, apiKey, thinking, tools, temperature });
        case 'anthropic':
            return chatAnthropicWithTools({ model, messages, systemPrompt, apiKey, thinking, tools });
        case 'openai':
            return chatOpenAIWithTools({ model, messages, systemPrompt, apiKey, thinking, tools });
        case 'openrouter':
            return chatOpenRouterWithTools({ model, messages, systemPrompt, apiKey, thinking, tools, temperature });
        case 'ollama':
            return chatOllamaWithTools({
                model,
                messages,
                systemPrompt,
                tools,
                baseUrl: ollamaBaseUrl || 'http://localhost:11434',
            });
        case 'lmstudio':
            return chatLMStudioWithTools({
                model,
                messages,
                systemPrompt,
                tools,
                baseUrl: lmStudioBaseUrl || 'http://localhost:1234',
            });
        case 'local-server':
            return chatLocalServerWithTools({
                model,
                messages,
                systemPrompt,
                tools,
                serverUrl: localServerUrl || 'http://localhost:8080/v1/messages',
            });
        default:
            // Fallback: providers not supporting tools just use regular chat
            return chatWithModel({ provider, model, messages, systemPrompt, apiKey, thinking, temperature, ollamaBaseUrl, lmStudioBaseUrl, localServerUrl });
    }
}

// Anthropic tool-use wrapper
async function chatAnthropicWithTools({ model, messages, systemPrompt, apiKey, thinking, tools }) {
    const anthropicTools = tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
    }));

    const filteredMessages = messages.filter(m => m.role !== 'tool' && !m.toolCalls);
    const toolMessages = messages.filter(m => m.role === 'tool');

    // Build the message list with tool results
    const anthropicMessages = [];
    for (const m of messages) {
        if (m.role === 'user' || m.role === 'assistant') {
            if (m.toolCalls && m.toolCalls.length > 0) {
                // Assistant message with tool calls
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

    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model,
            max_tokens: 65536,
            system: systemPrompt || undefined,
            messages: anthropicMessages,
            tools: anthropicTools,
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Anthropic error: ${res.status}`);
    }

    const data = await res.json();

    // Parse tool calls from response
    const responseToolCalls = [];
    let textContent = '';
    for (const block of data.content || []) {
        if (block.type === 'text') {
            textContent += block.text;
        } else if (block.type === 'tool_use') {
            responseToolCalls.push({
                id: block.id,
                name: block.name,
                arguments: block.input,
            });
        }
    }

    return {
        content: textContent,
        toolCalls: responseToolCalls.length > 0 ? responseToolCalls : null,
        usage: {
            inputTokens: data.usage?.input_tokens || 0,
            outputTokens: data.usage?.output_tokens || 0,
        },
    };
}

// OpenAI tool-use wrapper
async function chatOpenAIWithTools({ model, messages, systemPrompt, apiKey, thinking, tools }) {
    const openaiTools = tools.map(t => ({
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
                    tool_calls: m.toolCalls.map(tc => ({
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

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: openaiMessages,
            tools: openaiTools,
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `OpenAI error: ${res.status}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const msg = choice?.message;

    const responseToolCalls = (msg?.tool_calls || []).map(tc => ({
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
