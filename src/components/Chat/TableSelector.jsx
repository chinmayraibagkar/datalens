'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useAppStore } from '@/store/app-store';
import {
    HiOutlineChevronDown,
    HiOutlineChevronRight,
    HiOutlineXMark,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';

export default function TableSelector({ open, onClose }) {
    const { data: session } = useSession();
    const {
        bqProjectId,
        selectedTables,
        setSelectedTables,
        tableSchemas,
        addTableSchema,
    } = useAppStore();

    const [datasets, setDatasets] = useState([]);
    const [tablesMap, setTablesMap] = useState({});
    const [expandedDatasets, setExpandedDatasets] = useState({});
    const [expandedSchemas, setExpandedSchemas] = useState({});
    const [loading, setLoading] = useState(false);

    // Fetch datasets on open
    useEffect(() => {
        if (open && session?.accessToken && bqProjectId) {
            fetchDatasets();
        }
    }, [open, session?.accessToken, bqProjectId]);

    const fetchDatasets = async () => {
        setLoading(true);
        try {
            const res = await fetch(
                `/api/bigquery/datasets?projectId=${bqProjectId}`,
                { headers: { 'x-access-token': session.accessToken } }
            );
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setDatasets(data.datasets || []);
        } catch (err) {
            toast.error(`Failed to load datasets: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const fetchTables = async (datasetId) => {
        if (tablesMap[datasetId]) return;
        try {
            const res = await fetch(
                `/api/bigquery/tables?projectId=${bqProjectId}&datasetId=${datasetId}`,
                { headers: { 'x-access-token': session.accessToken } }
            );
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setTablesMap((prev) => ({ ...prev, [datasetId]: data.tables || [] }));
        } catch (err) {
            toast.error(`Failed to load tables: ${err.message}`);
        }
    };

    const fetchSchema = async (projectId, datasetId, tableId) => {
        const key = `${projectId}.${datasetId}.${tableId}`;
        if (tableSchemas[key]) return;
        try {
            const res = await fetch(
                `/api/bigquery/schema?projectId=${projectId}&datasetId=${datasetId}&tableId=${tableId}`,
                { headers: { 'x-access-token': session.accessToken } }
            );
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            addTableSchema(key, data.schema || []);
        } catch (err) {
            toast.error(`Failed to load schema: ${err.message}`);
        }
    };

    const toggleDataset = (datasetId) => {
        setExpandedDatasets((prev) => {
            const newState = { ...prev, [datasetId]: !prev[datasetId] };
            if (newState[datasetId]) fetchTables(datasetId);
            return newState;
        });
    };

    const toggleTable = (table) => {
        const isSelected = selectedTables.some(
            (t) => t.project === table.project && t.dataset === table.dataset && t.table === table.id
        );

        if (isSelected) {
            setSelectedTables(
                selectedTables.filter(
                    (t) => !(t.project === table.project && t.dataset === table.dataset && t.table === table.id)
                )
            );
        } else {
            fetchSchema(table.project, table.dataset, table.id);
            setSelectedTables([
                ...selectedTables,
                { project: table.project, dataset: table.dataset, table: table.id },
            ]);
        }
    };

    const toggleSchemaPreview = (key) => {
        setExpandedSchemas((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    if (!open) return null;

    return (
        <div className={`table-panel ${open ? '' : 'collapsed'}`}>
            <div className="table-panel-header">
                <span>📊 BigQuery Tables</span>
                <button className="table-panel-toggle" onClick={onClose}>
                    <HiOutlineXMark size={16} />
                </button>
            </div>

            <div className="table-panel-body">
                {!session?.accessToken && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px' }}>
                        Connect your Google account in Settings to browse tables.
                    </p>
                )}
                {!bqProjectId && session?.accessToken && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px' }}>
                        Set your BigQuery Project ID in Settings.
                    </p>
                )}

                {loading && (
                    <div style={{ padding: '20px', textAlign: 'center' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto' }} />
                    </div>
                )}

                {datasets.map((ds) => (
                    <div key={ds.id} className="dataset-group">
                        <div className="dataset-name" onClick={() => toggleDataset(ds.id)}>
                            {expandedDatasets[ds.id] ? (
                                <HiOutlineChevronDown size={12} />
                            ) : (
                                <HiOutlineChevronRight size={12} />
                            )}
                            📁 {ds.id}
                        </div>

                        {expandedDatasets[ds.id] &&
                            (tablesMap[ds.id] || []).map((table) => {
                                const key = `${table.project}.${table.dataset}.${table.id}`;
                                const isSelected = selectedTables.some(
                                    (t) => t.project === table.project && t.dataset === table.dataset && t.table === table.id
                                );
                                return (
                                    <div key={table.id}>
                                        <div
                                            className={`table-item ${isSelected ? 'selected' : ''}`}
                                            onClick={() => toggleTable(table)}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => { }}
                                            />
                                            {table.id}
                                        </div>
                                        {isSelected && tableSchemas[key] && (
                                            <div style={{ marginLeft: '28px' }}>
                                                <button
                                                    onClick={() => toggleSchemaPreview(key)}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: 'var(--text-muted)',
                                                        fontSize: '0.72rem',
                                                        cursor: 'pointer',
                                                        padding: '2px 0',
                                                        fontFamily: 'inherit',
                                                    }}
                                                >
                                                    {expandedSchemas[key] ? '▾' : '▸'} Schema ({tableSchemas[key].length} fields)
                                                </button>
                                                {expandedSchemas[key] && (
                                                    <div className="schema-preview">
                                                        {tableSchemas[key].map((field) => (
                                                            <div key={field.name} className="schema-field">
                                                                <span className="schema-field-name">{field.name}</span>
                                                                <span className="schema-field-type">{field.type}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                    </div>
                ))}
            </div>
        </div>
    );
}
