'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { getModelById, MODEL_PROVIDERS, formatTokens } from '@/services/llm/model-registry';
import VisualizationRenderer from './VisualizationRenderer';
import { HiOutlineChevronDown, HiOutlineChevronRight, HiOutlineArrowDownTray } from 'react-icons/hi2';

const TOOL_ICONS = {
    execute_sql: '🔍',
    list_datasets: '📂',
    list_tables: '📋',
    get_table_schema: '🏗️',
};

export default function MessageBubble({ message, index, onVizRetry }) {
    const [thinkingOpen, setThinkingOpen] = useState(false);
    const [sqlExpanded, setSqlExpanded] = useState(false);
    const [dataExpanded, setDataExpanded] = useState(false);
    const [toolsExpanded, setToolsExpanded] = useState(false);
    const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
    const downloadMenuRef = useRef(null);

    // Close download menu on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target)) {
                setDownloadMenuOpen(false);
            }
        };
        if (downloadMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [downloadMenuOpen]);

    // Download via native form POST
    const handleDownload = useCallback((format) => {
        const result = message.sqlResult;
        if (!result?.rows?.length) return;

        try {
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = '/api/download';
            form.style.display = 'none';

            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'payload';
            input.value = JSON.stringify({
                rows: result.rows,
                columns: result.columns,
                format,
            });

            form.appendChild(input);
            document.body.appendChild(form);
            form.submit();
            document.body.removeChild(form);
        } catch (err) {
            console.error('Download error:', err);
        }
        setDownloadMenuOpen(false);
    }, [message.sqlResult]);

    const model = message.model ? getModelById(message.model) : null;
    const provider = message.provider ? MODEL_PROVIDERS[message.provider] : null;

    if (message.role === 'user') {
        return (
            <div className="message user">
                <div className="message-avatar">U</div>
                <div className="message-body">
                    <div className="message-content">{message.content}</div>
                </div>
            </div>
        );
    }

    // Assistant message
    const toolCalls = message.toolCalls || [];

    return (
        <div className="message assistant">
            <div className="message-avatar">◈</div>
            <div className="message-body">
                {/* Thinking block */}
                {message.thinking && (
                    <div className="thinking-block">
                        <button
                            className="thinking-header"
                            onClick={() => setThinkingOpen(!thinkingOpen)}
                        >
                            {thinkingOpen ? <HiOutlineChevronDown size={14} /> : <HiOutlineChevronRight size={14} />}
                            🧠 Model Thinking
                        </button>
                        {thinkingOpen && (
                            <div className="thinking-content">{message.thinking}</div>
                        )}
                    </div>
                )}

                {/* Tool Calls (replaces old Agent Progress) */}
                {toolCalls.length > 0 && (
                    <div className="tool-calls-block">
                        <button
                            className="tool-calls-header"
                            onClick={() => setToolsExpanded(!toolsExpanded)}
                        >
                            {toolsExpanded ? <HiOutlineChevronDown size={12} /> : <HiOutlineChevronRight size={12} />}
                            <span className="tool-calls-label">🔧 Agent used {toolCalls.length} tool{toolCalls.length !== 1 ? 's' : ''}</span>
                        </button>
                        {toolsExpanded && (
                            <div className="tool-calls-body">
                                {toolCalls.map((tc, i) => (
                                    <div key={i} className="tool-call-item">
                                        <span className="tool-call-icon">{TOOL_ICONS[tc.name] || '🔧'}</span>
                                        <span className="tool-call-name">{tc.name}</span>
                                        {tc.arguments?.sql && (
                                            <span className="tool-call-detail" title={tc.arguments.sql}>
                                                SQL query
                                            </span>
                                        )}
                                        {tc.arguments?.datasetId && (
                                            <span className="tool-call-detail">{tc.arguments.datasetId}</span>
                                        )}
                                        {tc.arguments?.tableId && (
                                            <span className="tool-call-detail">{tc.arguments.tableId}</span>
                                        )}
                                        {tc.result?.error ? (
                                            <span className="status-badge error-badge">❌ Error</span>
                                        ) : (
                                            <span className="status-badge success-badge">✓</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Text content */}
                {message.content && (
                    <div
                        className="message-content"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                    />
                )}

                {/* Ads Data Tables */}
                {message.adsResults && message.adsResults.length > 0 && (
                    <AdsDataBlock adsResults={message.adsResults} />
                )}

                {/* Empty assistant response fallback */}
                {!message.content && !message.sql && !message.visualization && toolCalls.length === 0 && !message.adsResults && (
                    <div className="message-content" style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                        The model returned an empty response. Try rephrasing your question.
                    </div>
                )}

                {/* SQL block */}
                {message.sql && (
                    <div className="sql-block">
                        <div className="sql-header" onClick={() => setSqlExpanded(!sqlExpanded)} style={{ cursor: 'pointer' }}>
                            <span>
                                {sqlExpanded ? <HiOutlineChevronDown size={12} /> : <HiOutlineChevronRight size={12} />}
                                {' '}SQL Query
                            </span>
                        </div>
                        {sqlExpanded && (
                            <div className="sql-body">
                                <pre style={{ margin: 0, padding: '14px', background: 'var(--bg-primary)', fontSize: '0.82rem', overflow: 'auto' }}>
                                    <code>{message.sql}</code>
                                </pre>
                            </div>
                        )}

                        {/* SQL Error */}
                        {message.sqlError && (
                            <div className="sql-error">
                                ❌ {message.sqlError}
                            </div>
                        )}

                        {/* SQL Results */}
                        {message.sqlResult && (
                            <div className="sql-result">
                                <div
                                    className="sql-result-header"
                                    onClick={() => setDataExpanded(!dataExpanded)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <span className="sql-result-toggle">
                                        {dataExpanded ? <HiOutlineChevronDown size={12} /> : <HiOutlineChevronRight size={12} />}
                                        {' '}✓ {message.sqlResult.totalRows || message.sqlResult.rows?.length || 0} rows returned
                                    </span>
                                    {message.sqlResult.rows && message.sqlResult.rows.length > 0 && (
                                        <div className="download-menu-wrapper" ref={downloadMenuRef}>
                                            <button
                                                className="download-csv-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDownloadMenuOpen(!downloadMenuOpen);
                                                }}
                                                title="Download data"
                                            >
                                                <HiOutlineArrowDownTray size={13} />
                                                <span>Download</span>
                                                <HiOutlineChevronDown size={10} />
                                            </button>
                                            {downloadMenuOpen && (
                                                <div className="download-dropdown">
                                                    <button onClick={(e) => { e.stopPropagation(); handleDownload('csv'); }}>
                                                        📄 CSV
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDownload('xlsx'); }}>
                                                        📊 XLSX
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {dataExpanded && message.sqlResult.rows && message.sqlResult.rows.length > 0 && (
                                    <div className="result-table-wrapper">
                                        <table className="result-table">
                                            <thead>
                                                <tr>
                                                    {message.sqlResult.columns?.map((col) => (
                                                        <th key={col.name}>{col.name}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {message.sqlResult.rows.slice(0, 50).map((row, ri) => (
                                                    <tr key={ri}>
                                                        {message.sqlResult.columns?.map((col) => (
                                                            <td key={col.name}>{row[col.name] ?? '—'}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {message.sqlResult.rows.length > 50 && (
                                            <div style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                Showing 50 of {message.sqlResult.rows.length} rows
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Visualization */}
                {message.visualization && (
                    <VisualizationRenderer
                        code={message.visualization}
                        data={message.sqlResult?.rows || []}
                        onError={(error) => onVizRetry?.(error)}
                        retries={message.vizRetries || 0}
                    />
                )}

                {/* Token Badge */}
                {message.usage && (message.usage.inputTokens > 0 || message.usage.outputTokens > 0) && (
                    <div className="token-badge">
                        <span className="token-badge-item">
                            ↑ {formatTokens(message.usage.inputTokens)}
                        </span>
                        <span className="token-badge-item">
                            ↓ {formatTokens(message.usage.outputTokens)}
                        </span>
                        {model && (
                            <>
                                <span style={{ color: 'var(--border-color)' }}>|</span>
                                <span>{provider?.icon} {model.name}</span>
                            </>
                        )}
                        {toolCalls.length > 0 && (
                            <>
                                <span style={{ color: 'var(--border-color)' }}>|</span>
                                <span>🔧 {toolCalls.length} tools</span>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// Ads Data Block — renders ads tool results as expandable, downloadable tables
function AdsDataBlock({ adsResults }) {
    const [expandedTables, setExpandedTables] = useState({});
    const [downloadMenuOpen, setDownloadMenuOpen] = useState(null);

    // Flatten Meta/Google Ads API results into rows
    const tables = adsResults.map((result, idx) => {
        const { tool, data } = result;
        // Extract the array from the response (accounts, campaigns, insights, adSets, ads)
        const dataKey = Object.keys(data).find(k => Array.isArray(data[k]));
        const rows = dataKey ? data[dataKey] : [];

        // Flatten nested objects (e.g. actions array in insights)
        const flatRows = rows.map(row => {
            const flat = {};
            for (const [key, value] of Object.entries(row)) {
                if (Array.isArray(value)) {
                    // Flatten arrays like actions: [{action_type: 'purchase', value: '3'}]
                    for (const item of value) {
                        if (item.action_type && item.value !== undefined) {
                            flat[`${key}_${item.action_type}`] = item.value;
                        } else if (item['7d_click'] !== undefined) {
                            flat[`${key}_${item.action_type}_7d`] = item['7d_click'];
                        }
                    }
                } else if (typeof value === 'object' && value !== null) {
                    flat[key] = JSON.stringify(value);
                } else {
                    flat[key] = value;
                }
            }
            return flat;
        });

        const columns = flatRows.length > 0
            ? [...new Set(flatRows.flatMap(r => Object.keys(r)))].map(name => ({ name }))
            : [];

        const label = tool.replace(/(meta_ads_|google_ads_)get_/, '').replace(/_/g, ' ');

        return { id: idx, label, tool, rows: flatRows, columns };
    }).filter(t => t.rows.length > 0);

    if (tables.length === 0) return null;

    const toggleTable = (id) => setExpandedTables(prev => ({ ...prev, [id]: !prev[id] }));

    const handleAdsDownload = (table, format) => {
        try {
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = '/api/download';
            form.style.display = 'none';

            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'payload';
            input.value = JSON.stringify({
                rows: table.rows,
                columns: table.columns,
                format,
            });

            form.appendChild(input);
            document.body.appendChild(form);
            form.submit();
            document.body.removeChild(form);
        } catch (err) {
            console.error('Download error:', err);
        }
        setDownloadMenuOpen(null);
    };

    return (
        <>
            {tables.map((table) => (
                <div key={table.id} className="sql-block">
                    <div
                        className="sql-result-header"
                        onClick={() => toggleTable(table.id)}
                        style={{ cursor: 'pointer' }}
                    >
                        <span className="sql-result-toggle">
                            {expandedTables[table.id]
                                ? <HiOutlineChevronDown size={12} />
                                : <HiOutlineChevronRight size={12} />}
                            {' '}📈 {table.rows.length} {table.label} rows
                        </span>

                        <div className="download-menu-wrapper">
                            <button
                                className="download-csv-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setDownloadMenuOpen(downloadMenuOpen === table.id ? null : table.id);
                                }}
                                title="Download data"
                            >
                                <HiOutlineArrowDownTray size={13} />
                                <span>Download</span>
                                <HiOutlineChevronDown size={10} />
                            </button>
                            {downloadMenuOpen === table.id && (
                                <div className="download-dropdown">
                                    <button onClick={(e) => { e.stopPropagation(); handleAdsDownload(table, 'csv'); }}>
                                        📄 CSV
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleAdsDownload(table, 'xlsx'); }}>
                                        📊 XLSX
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {expandedTables[table.id] && (
                        <div className="result-table-wrapper">
                            <table className="result-table">
                                <thead>
                                    <tr>
                                        {table.columns.map(col => (
                                            <th key={col.name}>{col.name}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {table.rows.slice(0, 50).map((row, ri) => (
                                        <tr key={ri}>
                                            {table.columns.map(col => (
                                                <td key={col.name}>{row[col.name] ?? '—'}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {table.rows.length > 50 && (
                                <div style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    Showing 50 of {table.rows.length} rows
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </>
    );
}

// Markdown renderer with support for headers (h1–h4), bold, italic, code,
// bullet lists (* and -), numbered lists, and proper list grouping.
function renderMarkdown(text) {
    if (!text) return '';

    // Unescape escaped chars from JSON
    let src = text
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"');

    // Fenced code blocks → <pre><code>
    src = src.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');

    // Process line-by-line for block elements
    const lines = src.split('\n');
    const out = [];
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Skip lines inside <pre> blocks (already handled)
        if (line.includes('<pre>')) {
            // Pass through pre blocks unchanged
            let j = i;
            while (j < lines.length && !lines[j].includes('</pre>')) {
                out.push(lines[j]);
                j++;
            }
            if (j < lines.length) out.push(lines[j]);
            i = j;
            continue;
        }

        // Headers (#### before ###, order matters)
        if (/^#{4}\s+/.test(line)) {
            if (inList) { out.push('</ul>'); inList = false; }
            out.push(line.replace(/^#{4}\s+(.+)$/, '<h4>$1</h4>'));
            continue;
        }
        if (/^#{3}\s+/.test(line)) {
            if (inList) { out.push('</ul>'); inList = false; }
            out.push(line.replace(/^#{3}\s+(.+)$/, '<h3>$1</h3>'));
            continue;
        }
        if (/^#{2}\s+/.test(line)) {
            if (inList) { out.push('</ul>'); inList = false; }
            out.push(line.replace(/^#{2}\s+(.+)$/, '<h2>$1</h2>'));
            continue;
        }
        if (/^#{1}\s+/.test(line)) {
            if (inList) { out.push('</ul>'); inList = false; }
            out.push(line.replace(/^#{1}\s+(.+)$/, '<h1>$1</h1>'));
            continue;
        }

        // Bullet lists: *, -, or numbered (1.)
        const bulletMatch = line.match(/^(\s*)[\*\-]\s+(.+)$/);
        const numMatch = !bulletMatch && line.match(/^(\s*)\d+\.\s+(.+)$/);
        if (bulletMatch || numMatch) {
            if (!inList) { out.push('<ul>'); inList = true; }
            const content = bulletMatch ? bulletMatch[2] : numMatch[2];
            const indent = (bulletMatch ? bulletMatch[1] : numMatch[1]).length;
            const cls = indent > 0 ? ' class="nested"' : '';
            out.push(`<li${cls}>${applyInline(content)}</li>`);
            continue;
        }

        // Close list if we hit a non-list line
        if (inList && line.trim() !== '') {
            out.push('</ul>');
            inList = false;
        }

        // Empty line → paragraph break
        if (line.trim() === '') {
            out.push('<br>');
            continue;
        }

        // Regular line
        out.push(`<p>${applyInline(line)}</p>`);
    }

    if (inList) out.push('</ul>');

    return out.join('\n');
}

// Apply inline formatting: bold, italic, inline code
function applyInline(text) {
    return text
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
}

