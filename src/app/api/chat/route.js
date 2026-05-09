import { chatWithModel, chatWithTools } from '@/services/llm/adapter';
import { buildSystemPrompt } from '@/services/prompts/system-prompt';
import { executeGoogleAdsTool } from '@/services/mcp/google-ads-client';
import { executeMetaAdsTool } from '@/services/mcp/meta-ads-client';

const BQ_TOOLS = [
    {
        name: 'execute_sql',
        description: 'Execute a BigQuery Standard SQL query and return the results. Use this to fetch data from BigQuery tables. Always use fully-qualified table names (project.dataset.table).',
        parameters: {
            type: 'object',
            properties: {
                sql: {
                    type: 'string',
                    description: 'The BigQuery Standard SQL query to execute. Must use Standard SQL syntax, not Legacy SQL.',
                },
            },
            required: ['sql'],
        },
    },
    {
        name: 'list_datasets',
        description: 'List all datasets available in the BigQuery project. Use this first to discover what data is available.',
        parameters: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'list_tables',
        description: 'List all tables within a specific BigQuery dataset.',
        parameters: {
            type: 'object',
            properties: {
                datasetId: {
                    type: 'string',
                    description: 'The dataset ID to list tables from.',
                },
            },
            required: ['datasetId'],
        },
    },
    {
        name: 'get_table_schema',
        description: 'Get the full schema (columns, types, descriptions) of a specific BigQuery table. Use this to understand the structure of a table before writing SQL.',
        parameters: {
            type: 'object',
            properties: {
                datasetId: {
                    type: 'string',
                    description: 'The dataset ID containing the table.',
                },
                tableId: {
                    type: 'string',
                    description: 'The table ID to get schema for.',
                },
            },
            required: ['datasetId', 'tableId'],
        },
    },
];

const GOOGLE_ADS_TOOLS = [
    {
        name: 'google_ads_search',
        description: 'Execute a Google Ads Query Language (GAQL) query to fetch campaign metrics, budgets, keywords, ad groups, conversions, etc. Use this when the user asks about Google Ads performance.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The GAQL query to execute against Google Ads.',
                },
                customer_id: {
                    type: 'string',
                    description: 'Optional Google Ads customer ID. If not specified, uses the default configured account.',
                },
            },
            required: ['query'],
        },
    },
    {
        name: 'google_ads_list_customers',
        description: 'List all accessible Google Ads customer accounts.',
        parameters: {
            type: 'object',
            properties: {},
        },
    },
];

const META_ADS_TOOLS = [
    {
        name: 'meta_ads_get_accounts',
        description: 'Get all Meta/Facebook ad accounts accessible by the authenticated user.',
        parameters: {
            type: 'object',
            properties: {
                user_id: {
                    type: 'string',
                    description: 'The user ID. Use "me" for the current user.',
                },
            },
        },
    },
    {
        name: 'meta_ads_get_campaigns',
        description: 'Get campaigns for a Meta/Facebook ad account with status and configuration.',
        parameters: {
            type: 'object',
            properties: {
                account_id: {
                    type: 'string',
                    description: 'The ad account ID (format: act_XXXXX).',
                },
                limit: {
                    type: 'number',
                    description: 'Maximum number of campaigns to return.',
                },
            },
            required: ['account_id'],
        },
    },
    {
        name: 'meta_ads_get_insights',
        description: 'Get performance insights (spend, impressions, clicks, CTR, conversions, CPA, ROAS) for an account, campaign, ad set, or ad.',
        parameters: {
            type: 'object',
            properties: {
                object_id: {
                    type: 'string',
                    description: 'The account/campaign/adset/ad ID to get insights for. Use act_XXXX for account level.',
                },
                level: {
                    type: 'string',
                    description: 'The level of results. Options: "account", "campaign", "adset", "ad". Using "ad" on an account object_id returns metrics for ALL ads in the account.',
                },
                date_preset: {
                    type: 'string',
                    description: 'Date preset like "last_7d", "last_30d", "this_month", "last_month".',
                },
                breakdowns: {
                    type: 'string',
                    description: 'Optional breakdowns like "age", "gender", "placement", "country".',
                },
            },
            required: ['object_id'],
        },
    },
    {
        name: 'meta_ads_get_ad_sets',
        description: 'Get ad sets for a Meta/Facebook campaign with targeting and budget details.',
        parameters: {
            type: 'object',
            properties: {
                campaign_id: {
                    type: 'string',
                    description: 'The campaign ID to get ad sets for.',
                },
            },
            required: ['campaign_id'],
        },
    },
    {
        name: 'meta_ads_get_ads',
        description: 'Get list of ads for a Meta/Facebook ad set or campaign with status and descriptive details.',
        parameters: {
            type: 'object',
            properties: {
                parent_id: {
                    type: 'string',
                    description: 'The ad set ID or campaign ID to get ads for.',
                },
            },
            required: ['parent_id'],
        },
    },
];

const MAX_TOOL_ITERATIONS = 15;

// Enforce correct account IDs in tool call arguments.
// Smaller models (e.g. Ollama Gemma) often hallucinate wrong account IDs
// even when the correct ones are specified in the system prompt.
// This function overrides the LLM-generated account_id/object_id/customer_id
// with the user-selected accounts to guarantee correctness.
function enforceSelectedAccounts(toolName, args, selectedGoogleAdsAccounts, selectedMetaAdsAccounts) {
    const corrected = { ...args };

    // Meta Ads tools
    if (toolName === 'meta_ads_get_campaigns' || toolName === 'meta_ads_get_insights') {
        const paramKey = toolName === 'meta_ads_get_campaigns' ? 'account_id' : 'object_id';
        const llmValue = corrected[paramKey];

        if (selectedMetaAdsAccounts?.length > 0) {
            // If the LLM provided an account_id, check if it's one of the selected ones
            if (llmValue) {
                const normalizedLlmValue = llmValue.startsWith('act_') ? llmValue : `act_${llmValue}`;
                const isCorrectAccount = selectedMetaAdsAccounts.some(id => {
                    const normalizedId = id.startsWith('act_') ? id : `act_${id}`;
                    return normalizedId === normalizedLlmValue;
                });
                if (!isCorrectAccount) {
                    // LLM picked the wrong account — override with first selected account
                    console.log(`[ENFORCE] Meta Ads: LLM used ${llmValue} but selected accounts are [${selectedMetaAdsAccounts.join(', ')}]. Overriding to ${selectedMetaAdsAccounts[0]}`);
                    corrected[paramKey] = selectedMetaAdsAccounts[0];
                }
            } else {
                // LLM didn't provide an account — use the first selected one
                console.log(`[ENFORCE] Meta Ads: No account_id provided. Using selected: ${selectedMetaAdsAccounts[0]}`);
                corrected[paramKey] = selectedMetaAdsAccounts[0];
            }
        }
    }

    // Meta Ads: meta_ads_get_accounts — force user_id to 'me'
    if (toolName === 'meta_ads_get_accounts') {
        corrected.user_id = 'me';
    }

    // Google Ads tools
    if (toolName === 'google_ads_search') {
        if (selectedGoogleAdsAccounts?.length > 0) {
            const llmValue = corrected.customer_id;
            if (llmValue) {
                const isCorrect = selectedGoogleAdsAccounts.includes(llmValue);
                if (!isCorrect) {
                    console.log(`[ENFORCE] Google Ads: LLM used ${llmValue} but selected accounts are [${selectedGoogleAdsAccounts.join(', ')}]. Overriding to ${selectedGoogleAdsAccounts[0]}`);
                    corrected.customer_id = selectedGoogleAdsAccounts[0];
                }
            } else {
                console.log(`[ENFORCE] Google Ads: No customer_id provided. Using selected: ${selectedGoogleAdsAccounts[0]}`);
                corrected.customer_id = selectedGoogleAdsAccounts[0];
            }
        }
    }

    return corrected;
}

// Status message mapping for tool calls
function getToolStatusMessage(toolName, args) {
    switch (toolName) {
        case 'execute_sql':
            return '🔍 Querying BigQuery...';
        case 'list_datasets':
            return '📂 Listing available datasets...';
        case 'list_tables':
            return `📋 Listing tables in ${args?.datasetId || 'dataset'}...`;
        case 'get_table_schema':
            return `📊 Loading schema for ${args?.tableId || 'table'}...`;
        case 'google_ads_search':
            return '📈 Fetching Google Ads data...';
        case 'google_ads_list_customers':
            return '🏢 Listing Google Ads accounts...';
        case 'meta_ads_get_accounts':
            return '📘 Fetching Meta ad accounts...';
        case 'meta_ads_get_campaigns':
            return '📘 Fetching Meta campaigns...';
        case 'meta_ads_get_insights':
            return '📊 Pulling Meta Ads insights...';
        case 'meta_ads_get_ad_sets':
            return '📘 Fetching Meta ad sets...';
        case 'meta_ads_get_ads':
            return '📘 Fetching Meta ads...';
        default:
            return `⚙️ Running ${toolName}...`;
    }
}

// Generic response detection patterns
const GENERIC_PATTERNS = [
    /\bif\s+.*\bshow(?:s|ing)?\b.*\b(?:incremental|decremental|growth|decline)/i,
    /\bonce you review\b/i,
    /\bbased on (?:potential|possible) trends?\b/i,
    /\bhere are (?:actionable|some) (?:steps|insights|recommendations) you can take based on\b/i,
    /\bwhen you (?:see|observe|notice)\b.*\bdata\b/i,
    /\bdepending on (?:the|your) (?:results|data|output)\b/i,
    /\bif (?:the )?(?:data|results|output) (?:shows?|reveals?|indicates?)\b/i,
    /\byou (?:may|might|could|should) (?:see|find|observe)\b/i,
];

function isGenericResponse(text) {
    if (!text) return false;
    let matchCount = 0;
    for (const pattern of GENERIC_PATTERNS) {
        if (pattern.test(text)) matchCount++;
        if (matchCount >= 2) return true;
    }
    return false;
}

// Execute a BigQuery tool call using the REST API
async function executeBQTool(toolName, args, bqAccessToken, bqProjectId) {
    const headers = {
        Authorization: `Bearer ${bqAccessToken}`,
        'Content-Type': 'application/json',
    };

    switch (toolName) {
        case 'execute_sql': {
            const res = await fetch(
                `https://bigquery.googleapis.com/bigquery/v2/projects/${bqProjectId}/queries`,
                {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        query: args.sql,
                        useLegacySql: false,
                        maxResults: 1000,
                        timeoutMs: 30000,
                        maximumBytesBilled: '1073741824',
                    }),
                }
            );
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                const errMsg = err.error?.message || err.error?.errors?.[0]?.message || 'Query execution failed';
                return { error: errMsg };
            }
            const data = await res.json();
            const fields = data.schema?.fields || [];
            const rows = (data.rows || []).map((row) => {
                const obj = {};
                row.f.forEach((cell, i) => {
                    obj[fields[i].name] = cell.v;
                });
                return obj;
            });
            return {
                columns: fields.map((f) => ({ name: f.name, type: f.type })),
                rows,
                totalRows: data.totalRows,
            };
        }

        case 'list_datasets': {
            const res = await fetch(
                `https://bigquery.googleapis.com/bigquery/v2/projects/${bqProjectId}/datasets`,
                { headers }
            );
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                return { error: err.error?.message || 'Failed to list datasets' };
            }
            const data = await res.json();
            const datasets = (data.datasets || []).map((ds) => ({
                id: ds.datasetReference.datasetId,
                project: ds.datasetReference.projectId,
            }));
            return { datasets };
        }

        case 'list_tables': {
            const res = await fetch(
                `https://bigquery.googleapis.com/bigquery/v2/projects/${bqProjectId}/datasets/${args.datasetId}/tables`,
                { headers }
            );
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                return { error: err.error?.message || 'Failed to list tables' };
            }
            const data = await res.json();
            const tables = (data.tables || []).map((t) => ({
                id: t.tableReference.tableId,
                type: t.type,
            }));
            return { tables };
        }

        case 'get_table_schema': {
            const res = await fetch(
                `https://bigquery.googleapis.com/bigquery/v2/projects/${bqProjectId}/datasets/${args.datasetId}/tables/${args.tableId}`,
                { headers }
            );
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                return { error: err.error?.message || 'Failed to get schema' };
            }
            const data = await res.json();
            const schema = (data.schema?.fields || []).map((f) => ({
                name: f.name,
                type: f.type,
                mode: f.mode,
                description: f.description || '',
            }));
            return {
                tableId: data.tableReference.tableId,
                datasetId: data.tableReference.datasetId,
                projectId: data.tableReference.projectId,
                numRows: data.numRows,
                schema,
            };
        }

        default:
            return { error: `Unknown tool: ${toolName}` };
    }
}

// Route tool execution to appropriate handler
async function executeTool(toolName, args, { bqAccessToken, bqProjectId, googleAdsConfig, metaAdsConfig }) {
    // BigQuery tools
    if (['execute_sql', 'list_datasets', 'list_tables', 'get_table_schema'].includes(toolName)) {
        return executeBQTool(toolName, args, bqAccessToken, bqProjectId);
    }
    // Google Ads tools
    if (toolName.startsWith('google_ads_')) {
        return executeGoogleAdsTool(toolName, args, googleAdsConfig);
    }
    // Meta Ads tools
    if (toolName.startsWith('meta_ads_')) {
        return executeMetaAdsTool(toolName, args, metaAdsConfig);
    }
    return { error: `Unknown tool: ${toolName}` };
}

// Truncate tool results to prevent context overflow while preserving enough data for good analysis
function truncateToolResult(result) {
    const MAX_ROWS = 5000;

    // If the result has standard rows/columns (BQ style), truncate rows
    if (result.rows && Array.isArray(result.rows)) {
        const truncated = { ...result };
        if (truncated.rows.length > MAX_ROWS) {
            truncated.totalRows = truncated.rows.length;
            truncated.rows = truncated.rows.slice(0, MAX_ROWS);
            truncated.truncated = true;
        }
        return truncated;
    }

    // For Ads API results (campaigns, insights, ads, adSets, etc.)
    // Find the array key and truncate
    const copy = { ...result };
    for (const key of Object.keys(copy)) {
        if (Array.isArray(copy[key]) && copy[key].length > MAX_ROWS) {
            copy[`total_${key}`] = copy[key].length;
            copy[key] = copy[key].slice(0, MAX_ROWS);
            copy.truncated = true;
        }
    }

    // Final safety: if the serialized result is dangerously massive for LLM context, hard-truncate
    const serialized = JSON.stringify(copy);
    if (serialized.length > 500000) { // 500KB limit
        return { summary: serialized.slice(0, 499000), truncated: true, originalLength: serialized.length };
    }

    return copy;
}


// SSE helper: write an event to the stream
function writeSSE(controller, encoder, event, data) {
    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}


export async function POST(req) {
    try {
        const body = await req.json();
        const {
            messages,
            model,
            provider,
            apiKey,
            systemPromptEnabled,
            systemPrompt: customSystemPrompt,
            selectedTables,
            thinkingEnabled,
            temperature,
            ollamaBaseUrl,
            lmStudioBaseUrl,
            localServerUrl,
            bqAccessToken,
            bqProjectId,
            googleAdsConfig,
            metaAdsConfig,
            selectedGoogleAdsAccounts,
            selectedMetaAdsAccounts,
        } = body;

        const llmConfig = {
            provider, model, apiKey,
            thinking: thinkingEnabled,
            temperature: temperature ?? 0.7,
            ollamaBaseUrl, lmStudioBaseUrl, localServerUrl,
        };

        console.log(`[CHAT] Provider: ${provider}, Model: ${model}, HasApiKey: ${!!apiKey}`);
        if (selectedMetaAdsAccounts?.length > 0) {
            console.log(`[CHAT] Selected Meta Ads accounts: ${selectedMetaAdsAccounts.join(', ')}`);
        }
        if (selectedGoogleAdsAccounts?.length > 0) {
            console.log(`[CHAT] Selected Google Ads accounts: ${selectedGoogleAdsAccounts.join(', ')}`);
        }

        const toolContext = { bqAccessToken, bqProjectId, googleAdsConfig, metaAdsConfig };

        const systemPrompt = buildSystemPrompt({
            basePrompt: customSystemPrompt,
            tables: selectedTables || [],
            systemPromptEnabled: systemPromptEnabled !== false,
            selectedGoogleAdsAccounts: selectedGoogleAdsAccounts || [],
            selectedMetaAdsAccounts: selectedMetaAdsAccounts || [],
        });

        const supportsTools = ['gemini', 'openai', 'anthropic', 'grok', 'openrouter', 'local-server', 'ollama', 'lmstudio'].includes(provider);
        const bqConnected = bqAccessToken && bqProjectId;
        const googleAdsConnected = googleAdsConfig?.enabled && googleAdsConfig?.refreshToken;
        const metaAdsConnected = metaAdsConfig?.enabled && metaAdsConfig?.accessToken;

        // Automatically hide BigQuery tools if the user explicitly selected Ad accounts
        // but did NOT explicitly select any BigQuery tables. This forces the agent to use Ads tools natively.
        const hasAdAccountsSelected = (selectedGoogleAdsAccounts?.length > 0) || (selectedMetaAdsAccounts?.length > 0);
        const hasTablesSelected = selectedTables?.length > 0;
        const skipBqTools = hasAdAccountsSelected && !hasTablesSelected;

        // Build the tools list based on connected data sources and user intent
        let allTools = [];
        if (bqConnected && !skipBqTools) allTools.push(...BQ_TOOLS);
        if (googleAdsConnected) allTools.push(...GOOGLE_ADS_TOOLS);
        if (metaAdsConnected) allTools.push(...META_ADS_TOOLS);

        const encoder = new TextEncoder();

        // Create SSE streaming response
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    let totalInputTokens = 0;
                    let totalOutputTokens = 0;
                    let toolCallsLog = [];
                    let lastSql = null;
                    let lastSqlResult = null;
                    let lastSqlError = null;
                    let adsResults = [];
                    let finalVisualization = null;

                    if (supportsTools && allTools.length > 0) {
                        // ========================================
                        // AGENTIC TOOL-USE LOOP (SSE)
                        // ========================================
                        let currentMessages = [...messages];
                        let iteration = 0;
                        let finalText = '';

                        writeSSE(controller, encoder, 'status', {
                            step: 'analyzing',
                            message: '🧠 Analyzing your question...',
                        });

                        while (iteration < MAX_TOOL_ITERATIONS) {
                            iteration++;
                            console.log(`[AGENT] Iteration ${iteration}, messages: ${currentMessages.length}, totalChars: ${JSON.stringify(currentMessages).length}`);

                            // Send a keep-alive status before starting LLM call
                            writeSSE(controller, encoder, 'status', {
                                step: 'analyzing',
                                message: `⏳ Analyzing data (step ${iteration})...`,
                            });

                            // Heartbeat: send tiny SSE pings every 8s to prevent browser idle timeout
                            const heartbeat = setInterval(() => {
                                try {
                                    writeSSE(controller, encoder, 'status', {
                                        step: 'analyzing',
                                        message: `⏳ Still processing (step ${iteration})...`,
                                    });
                                } catch (_) {}
                            }, 8000);

                            let response;
                            try {
                                response = await chatWithTools({
                                    ...llmConfig,
                                    messages: currentMessages,
                                    systemPrompt,
                                    tools: allTools,
                                });
                            } finally {
                                clearInterval(heartbeat);
                            }

                            console.log(`[AGENT] Response received: toolCalls=${response.toolCalls?.length || 0}, contentLen=${response.content?.length || 0}, input=${response.usage?.inputTokens}, output=${response.usage?.outputTokens}`);

                            totalInputTokens += response.usage?.inputTokens || 0;
                            totalOutputTokens += response.usage?.outputTokens || 0;

                            // If no tool calls — this is the final response
                            if (!response.toolCalls || response.toolCalls.length === 0) {
                                writeSSE(controller, encoder, 'status', {
                                    step: 'generating',
                                    message: '✍️ Generating analysis...',
                                });

                                const parsed = parseAgentResponse(response.content);
                                finalText = parsed.text || response.content || '';
                                finalVisualization = parsed.visualization || null;
                                if (parsed.sql) {
                                    lastSql = parsed.sql;
                                }

                                // Generic response detection + retry (max 1)
                                if (isGenericResponse(finalText) && lastSqlResult) {
                                    writeSSE(controller, encoder, 'status', {
                                        step: 'improving',
                                        message: '🔄 Improving analysis quality...',
                                    });

                                    const retryMessages = [
                                        ...currentMessages,
                                        { role: 'assistant', content: response.content },
                                        {
                                            role: 'user',
                                            content: `Your response contains hypothetical/conditional language instead of data-specific analysis. The query has been executed and actual data is available. Please rewrite your analysis referencing ONLY the actual numbers, percentages, and trends from the query results. Do NOT use phrases like "If X shows..." or "Once you review...". Use the actual data values.`,
                                        },
                                    ];

                                    const retryResponse = await chatWithTools({
                                        ...llmConfig,
                                        messages: retryMessages,
                                        systemPrompt,
                                        tools: allTools,
                                    });

                                    totalInputTokens += retryResponse.usage?.inputTokens || 0;
                                    totalOutputTokens += retryResponse.usage?.outputTokens || 0;

                                    if (!retryResponse.toolCalls || retryResponse.toolCalls.length === 0) {
                                        const retryParsed = parseAgentResponse(retryResponse.content);
                                        if (retryParsed.text) finalText = retryParsed.text;
                                        if (retryParsed.sql) lastSql = retryParsed.sql;
                                        if (retryParsed.visualization) finalVisualization = retryParsed.visualization;
                                    }
                                }

                                break;
                            }

                            // Process tool calls in PARALLEL
                            const toolPromises = response.toolCalls.map(async (tc) => {
                                // Enforce selected account IDs — override any wrong IDs the LLM hallucinated
                                const correctedArgs = enforceSelectedAccounts(
                                    tc.name, tc.arguments,
                                    selectedGoogleAdsAccounts || [],
                                    selectedMetaAdsAccounts || []
                                );

                                writeSSE(controller, encoder, 'status', {
                                    step: 'executing_tool',
                                    message: getToolStatusMessage(tc.name, correctedArgs),
                                    tool: tc.name,
                                });

                                const toolResult = await executeTool(tc.name, correctedArgs, toolContext);

                                toolCallsLog.push({
                                    name: tc.name,
                                    arguments: correctedArgs,
                                    result: toolResult.error
                                        ? { error: toolResult.error }
                                        : { success: true, rowCount: toolResult.rows?.length },
                                });

                                if (tc.name === 'execute_sql') {
                                    lastSql = correctedArgs.sql;
                                    if (toolResult.error) {
                                        lastSqlError = toolResult.error;
                                    } else {
                                        lastSqlResult = toolResult;
                                        lastSqlError = null;
                                        writeSSE(controller, encoder, 'status', {
                                            step: 'data_received',
                                            message: `📊 Query returned ${toolResult.rows?.length || 0} rows, analyzing...`,
                                        });
                                    }
                                }

                                // Collect Ads tool results for display
                                if (tc.name.startsWith('meta_ads_') || tc.name.startsWith('google_ads_')) {
                                    if (!toolResult.error) {
                                        adsResults.push({
                                            tool: tc.name,
                                            arguments: correctedArgs,
                                            data: toolResult, // Full untruncated data for CSV download
                                        });
                                    }
                                }

                                // Update tc.arguments so the LLM sees corrected IDs in conversation history
                                tc.arguments = correctedArgs;

                                return { tc, toolResult };
                            });

                            const toolResults = await Promise.all(toolPromises);

                            // Feed tool results back to the LLM
                            let updatedMessages = [
                                ...currentMessages,
                                { role: 'assistant', content: response.content || '', toolCalls: response.toolCalls },
                            ];

                            for (const { tc, toolResult } of toolResults) {
                                updatedMessages.push({
                                    role: 'tool',
                                    toolCallId: tc.id,
                                    name: tc.name,
                                    content: JSON.stringify(
                                        toolResult.error
                                            ? { error: toolResult.error }
                                            : truncateToolResult(toolResult)
                                    ),
                                });
                            }

                            currentMessages = updatedMessages;
                        }

                        // ========================================
                        // FALLBACK: Force generation if we hit MAX_TOOL_ITERATIONS
                        // ========================================
                        if (!finalText && currentMessages.length > messages.length) {
                            writeSSE(controller, encoder, 'status', {
                                step: 'analyzing',
                                message: '✍️ Finalizing analysis...',
                            });

                            const fallbackHeartbeat = setInterval(() => {
                                try {
                                    writeSSE(controller, encoder, 'status', {
                                        step: 'analyzing',
                                        message: '⏳ Still finalizing...',
                                    });
                                } catch (_) {}
                            }, 8000);

                            try {
                                const finalResponse = await chatWithModel({
                                    ...llmConfig,
                                    messages: currentMessages,
                                    systemPrompt: systemPrompt + '\n\nCRITICAL INSTRUCTION: You MUST provide a final text summary of the data you have collected. Do not use any more tools.',
                                });
                                totalInputTokens += finalResponse.usage?.inputTokens || 0;
                                totalOutputTokens += finalResponse.usage?.outputTokens || 0;
                                const parsed = parseAgentResponse(finalResponse.content);
                                finalText = parsed.text || finalResponse.content || 'I have gathered the data but was unable to generate a summary.';
                                finalVisualization = parsed.visualization || null;
                                if (parsed.sql && !lastSql) lastSql = parsed.sql;
                            } catch (fallbackErr) {
                                console.error('Fallback generation failed:', fallbackErr);
                                finalText = 'I gathered the requested data, but encountered an error while generating the final summary.';
                            } finally {
                                clearInterval(fallbackHeartbeat);
                            }
                        }

                        // ========================================
                        // FALLBACK: Generate viz if model mentioned chart but didn't include code
                        // ========================================
                        const userAskedForChart = /chart|graph|plot|visual/i.test(
                            messages[messages.length - 1]?.content || ''
                        );
                        if (userAskedForChart && !finalVisualization && lastSqlResult && lastSqlResult.rows?.length > 0) {
                            writeSSE(controller, encoder, 'status', {
                                step: 'visualization',
                                message: '📈 Generating visualization...',
                            });

                            try {
                                const sampleData = lastSqlResult.rows.slice(0, 5);
                                const columns = lastSqlResult.columns?.map(c => c.name) || Object.keys(sampleData[0] || {});
                                const vizPrompt = `Generate ONLY Plotly.js JavaScript code (no explanation, no JSON wrapper) to create a chart for this data.

The variable \`data\` is already available as an array of objects with these columns: ${columns.join(', ')}
Sample rows: ${JSON.stringify(sampleData)}
Total rows: ${lastSqlResult.rows.length}

User's request: "${messages[messages.length - 1]?.content}"

Requirements:
- Call Plotly.newPlot('chart', traces, layout, config)
- paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)'
- Colors: ['#a855f7', '#6366f1', '#ec4899', '#06b6d4', '#f59e0b', '#10b981']
- Font: {family: 'Inter, system-ui, sans-serif', color: '#e2e8f0', size: 13}
- Config: {responsive: true, displayModeBar: false}
- Convert numeric values with Number() when needed
- Output ONLY the JavaScript code, nothing else.`;

                                const vizResponse = await chatWithModel({
                                    ...llmConfig,
                                    messages: [{ role: 'user', content: vizPrompt }],
                                    systemPrompt: 'You are a Plotly.js chart code generator. Output ONLY valid JavaScript code. No explanation, no markdown.',
                                });

                                totalInputTokens += vizResponse.usage?.inputTokens || 0;
                                totalOutputTokens += vizResponse.usage?.outputTokens || 0;

                                if (vizResponse.content) {
                                    let vizCode = vizResponse.content.trim();
                                    vizCode = vizCode.replace(/^```(?:javascript|js)?\s*\n?/, '').replace(/\n?\s*```\s*$/, '');
                                    finalVisualization = vizCode;
                                }
                            } catch (vizErr) {
                                console.error('Fallback viz generation failed:', vizErr.message);
                            }
                        }

                        // Truncate adsResults for SSE (keep full data for CSV export)
                        const adsResultsForSSE = adsResults.length > 0
                            ? adsResults.map(ar => ({
                                tool: ar.tool,
                                arguments: ar.arguments,
                                data: truncateToolResult(ar.data),
                            }))
                            : null;

                        console.log(`[AGENT] Sending result: textLen=${finalText.length}, adsResults=${adsResults.length}, ssePayloadSize=${JSON.stringify(adsResultsForSSE || []).length}`);

                        // Send the final result
                        writeSSE(controller, encoder, 'result', {
                            text: finalText,
                            sql: lastSql,
                            visualization: finalVisualization,
                            thinking: null,
                            sqlResult: lastSqlResult,
                            sqlError: lastSqlError,
                            toolCalls: toolCallsLog,
                            adsResults: adsResultsForSSE,
                            usage: {
                                inputTokens: totalInputTokens,
                                outputTokens: totalOutputTokens,
                            },
                        });
                    } else {
                        // ========================================
                        // FALLBACK: Single-shot (no tools)
                        // ========================================
                        writeSSE(controller, encoder, 'status', {
                            step: 'generating',
                            message: '✍️ Generating response...',
                        });

                        const llmResponse = await chatWithModel({
                            ...llmConfig,
                            messages,
                            systemPrompt,
                        });
                        totalInputTokens += llmResponse.usage.inputTokens;
                        totalOutputTokens += llmResponse.usage.outputTokens;

                        const parsed = parseAgentResponse(llmResponse.content);
                        let finalText = parsed.text || '';
                        let finalSql = parsed.sql || null;
                        let finalSqlResult = null;
                        let finalSqlError = null;

                        // If SQL was generated and BQ is connected, execute it
                        if (parsed.sql && bqConnected) {
                            writeSSE(controller, encoder, 'status', {
                                step: 'executing_sql',
                                message: '🔍 Executing SQL query...',
                            });

                            const result = await executeBQTool('execute_sql', { sql: parsed.sql }, bqAccessToken, bqProjectId);
                            if (result.error) {
                                finalSqlError = result.error;
                                writeSSE(controller, encoder, 'status', {
                                    step: 'fixing_query',
                                    message: '🔧 Fixing query...',
                                });

                                const retryMessages = [
                                    ...messages,
                                    { role: 'assistant', content: llmResponse.content },
                                    { role: 'user', content: `The SQL query failed with error: ${result.error}\n\nPlease fix the query and respond in the same JSON format.` },
                                ];
                                const retryResponse = await chatWithModel({ ...llmConfig, messages: retryMessages, systemPrompt });
                                totalInputTokens += retryResponse.usage.inputTokens;
                                totalOutputTokens += retryResponse.usage.outputTokens;
                                const retryParsed = parseAgentResponse(retryResponse.content);
                                if (retryParsed.sql) {
                                    finalSql = retryParsed.sql;
                                    const retryResult = await executeBQTool('execute_sql', { sql: retryParsed.sql }, bqAccessToken, bqProjectId);
                                    if (!retryResult.error) {
                                        finalSqlResult = retryResult;
                                        finalSqlError = null;
                                    } else {
                                        finalSqlError = retryResult.error;
                                    }
                                }
                                if (retryParsed.text) finalText = retryParsed.text;
                            } else {
                                finalSqlResult = result;
                            }
                        }

                        writeSSE(controller, encoder, 'result', {
                            text: finalText,
                            sql: finalSql,
                            visualization: parsed.visualization || null,
                            thinking: null,
                            sqlResult: finalSqlResult,
                            sqlError: finalSqlError,
                            toolCalls: [],
                            usage: {
                                inputTokens: totalInputTokens,
                                outputTokens: totalOutputTokens,
                            },
                        });
                    }

                    // Signal stream end
                    writeSSE(controller, encoder, 'done', {});
                } catch (error) {
                    console.error('SSE stream error:', error?.message, error?.stack);
                    try {
                        writeSSE(controller, encoder, 'error', {
                            message: error?.message || 'Unknown server error during agent execution.',
                        });
                    } catch (writeErr) {
                        console.error('Failed to write SSE error event:', writeErr?.message);
                    }
                } finally {
                    try { controller.close(); } catch (_) { }
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        });
    } catch (error) {
        console.error('Chat API error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}


// Parse agent JSON response
function parseAgentResponse(content) {
    if (!content || typeof content !== 'string') {
        return { text: content || '', sql: null, visualization: null };
    }

    let cleaned = content.trim();

    const fenceStart = /^```(?:json)?\s*\n?/;
    const fenceEnd = /\n?\s*```\s*$/;
    if (fenceStart.test(cleaned) && fenceEnd.test(cleaned)) {
        cleaned = cleaned.replace(fenceStart, '').replace(fenceEnd, '').trim();
    }

    try {
        const parsed = JSON.parse(cleaned);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
        // continue
    }

    const jsonObj = extractJsonByBraceCounting(cleaned);
    if (jsonObj) return jsonObj;

    const innerFenceIdx = cleaned.indexOf('```');
    if (innerFenceIdx >= 0) {
        const afterFence = cleaned.slice(innerFenceIdx);
        const strippedInner = afterFence.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```[\s\S]*$/, '').trim();
        try {
            const parsed = JSON.parse(strippedInner);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
        } catch {
            const innerObj = extractJsonByBraceCounting(strippedInner);
            if (innerObj) return innerObj;
        }
    }

    const textMatch = cleaned.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
    const sqlMatch = cleaned.match(/"sql"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
    const vizMatch = cleaned.match(/"visualization"\s*:\s*"((?:[^"\\]|\\.)*)"/s);

    if (textMatch || sqlMatch) {
        return {
            text: textMatch ? unescapeJsonString(textMatch[1]) : content,
            sql: sqlMatch ? unescapeJsonString(sqlMatch[1]) : null,
            visualization: vizMatch ? unescapeJsonString(vizMatch[1]) : null,
        };
    }

    return { text: content, sql: null, visualization: null };
}

function extractJsonByBraceCounting(str) {
    const startIdx = str.indexOf('{');
    if (startIdx === -1) return null;

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = startIdx; i < str.length; i++) {
        const ch = str[i];
        if (escape) { escape = false; continue; }
        if (ch === '\\') { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (!inString) {
            if (ch === '{') depth++;
            if (ch === '}') {
                depth--;
                if (depth === 0) {
                    const candidate = str.slice(startIdx, i + 1);
                    try {
                        const parsed = JSON.parse(candidate);
                        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
                    } catch { /* continue */ }
                }
            }
        }
    }

    if (depth > 0) {
        let truncated = str.slice(startIdx);
        if (inString) truncated += '"';
        for (let d = 0; d < depth; d++) truncated += '}';
        try {
            const parsed = JSON.parse(truncated);
            if (parsed && typeof parsed === 'object') return parsed;
        } catch { /* Can't repair */ }
    }

    return null;
}

function unescapeJsonString(s) {
    try {
        return JSON.parse(`"${s}"`);
    } catch {
        return s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');
    }
}
