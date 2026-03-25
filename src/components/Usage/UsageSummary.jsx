'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/store/app-store';
import { getModelById, MODEL_PROVIDERS, formatINR, formatTokens, calculateCost } from '@/services/llm/model-registry';

const FILTERS = [
    { id: 'all', label: 'All Time' },
    { id: '7d', label: '7 Days' },
    { id: '30d', label: '30 Days' },
    { id: 'today', label: 'Today' },
];

export default function UsageSummary() {
    const [filter, setFilter] = useState('all');
    const { usageData } = useAppStore();

    const filteredData = useMemo(() => {
        const now = new Date();
        return usageData.filter((entry) => {
            if (filter === 'all') return true;
            const entryDate = new Date(entry.timestamp);
            const diffDays = (now - entryDate) / (1000 * 60 * 60 * 24);
            if (filter === 'today') return diffDays < 1;
            if (filter === '7d') return diffDays < 7;
            if (filter === '30d') return diffDays < 30;
            return true;
        });
    }, [usageData, filter]);

    // Aggregate by model
    const aggregated = useMemo(() => {
        const map = {};
        for (const entry of filteredData) {
            if (!map[entry.model]) {
                map[entry.model] = {
                    model: entry.model,
                    provider: entry.provider,
                    inputTokens: 0,
                    outputTokens: 0,
                    count: 0,
                };
            }
            map[entry.model].inputTokens += entry.inputTokens || 0;
            map[entry.model].outputTokens += entry.outputTokens || 0;
            map[entry.model].count += 1;
        }
        return Object.values(map).sort((a, b) => {
            const costA = calculateCost(a.model, a.inputTokens, a.outputTokens);
            const costB = calculateCost(b.model, b.inputTokens, b.outputTokens);
            return costB - costA;
        });
    }, [filteredData]);

    const totalCost = aggregated.reduce(
        (sum, row) => sum + calculateCost(row.model, row.inputTokens, row.outputTokens),
        0
    );

    const totalInput = aggregated.reduce((sum, r) => sum + r.inputTokens, 0);
    const totalOutput = aggregated.reduce((sum, r) => sum + r.outputTokens, 0);

    return (
        <div className="usage-page">
            <h1>📊 Usage & Costs</h1>

            <div className="usage-filters">
                {FILTERS.map((f) => (
                    <button
                        key={f.id}
                        className={`usage-filter-btn ${filter === f.id ? 'active' : ''}`}
                        onClick={() => setFilter(f.id)}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {aggregated.length === 0 ? (
                <div className="settings-section" style={{ textAlign: 'center', padding: '48px' }}>
                    <p style={{ fontSize: '2rem', marginBottom: '12px' }}>📭</p>
                    <p style={{ color: 'var(--text-secondary)' }}>No usage data yet. Start chatting to see your usage!</p>
                </div>
            ) : (
                <>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="usage-table">
                            <thead>
                                <tr>
                                    <th>Model</th>
                                    <th>Provider</th>
                                    <th>Requests</th>
                                    <th>Input Tokens</th>
                                    <th>Output Tokens</th>
                                    <th>Total Tokens</th>
                                    <th style={{ textAlign: 'right' }}>Cost (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {aggregated.map((row) => {
                                    const model = getModelById(row.model);
                                    const provider = MODEL_PROVIDERS[row.provider];
                                    const cost = calculateCost(row.model, row.inputTokens, row.outputTokens);
                                    const isLocal = model?.isLocal;

                                    return (
                                        <tr key={row.model}>
                                            <td style={{ fontWeight: 500 }}>{model?.name || row.model}</td>
                                            <td>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {provider?.icon} {provider?.name || row.provider}
                                                </span>
                                            </td>
                                            <td>{row.count}</td>
                                            <td>{formatTokens(row.inputTokens)}</td>
                                            <td>{formatTokens(row.outputTokens)}</td>
                                            <td>{formatTokens(row.inputTokens + row.outputTokens)}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 500 }}>
                                                {isLocal ? (
                                                    <span style={{ color: 'var(--text-muted)' }}>Local</span>
                                                ) : (
                                                    formatINR(cost)
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="usage-total">
                        <div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Total: {formatTokens(totalInput)} input • {formatTokens(totalOutput)} output
                            </div>
                        </div>
                        <div className="usage-total-amount">
                            {totalCost > 0 ? formatINR(totalCost) : 'Free (Local Models)'}
                        </div>
                    </div>

                    {/* Visual cost breakdown */}
                    <div className="settings-section" style={{ marginTop: '20px' }}>
                        <h2>Cost Distribution</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                            {aggregated
                                .filter((r) => !getModelById(r.model)?.isLocal)
                                .map((row) => {
                                    const cost = calculateCost(row.model, row.inputTokens, row.outputTokens);
                                    const pct = totalCost > 0 ? (cost / totalCost) * 100 : 0;
                                    const model = getModelById(row.model);
                                    const provider = MODEL_PROVIDERS[row.provider];

                                    return (
                                        <div key={row.model}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                                                <span>{provider?.icon} {model?.name || row.model}</span>
                                                <span>{formatINR(cost)} ({pct.toFixed(1)}%)</span>
                                            </div>
                                            <div style={{
                                                height: '8px',
                                                background: 'var(--bg-tertiary)',
                                                borderRadius: '4px',
                                                overflow: 'hidden',
                                            }}>
                                                <div style={{
                                                    height: '100%',
                                                    width: `${pct}%`,
                                                    background: 'var(--accent-gradient)',
                                                    borderRadius: '4px',
                                                    transition: 'width 0.5s ease',
                                                }} />
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
