'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useAppStore } from '@/store/app-store';
import { HiOutlineChevronDown, HiOutlineChevronRight, HiOutlineXMark } from 'react-icons/hi2';
import toast from 'react-hot-toast';

export default function AdsAccountSelector({ open, onClose }) {
    const { data: session } = useSession();
    const {
        googleAdsConfig,
        metaAdsConfig,
        selectedGoogleAdsAccounts,
        setSelectedGoogleAdsAccounts,
        selectedMetaAdsAccounts,
        setSelectedMetaAdsAccounts,
    } = useAppStore();

    const [activeTab, setActiveTab] = useState('google');
    const [googleAccounts, setGoogleAccounts] = useState([]);
    const [metaAccounts, setMetaAccounts] = useState([]);
    const [loadingGoogle, setLoadingGoogle] = useState(false);
    const [loadingMeta, setLoadingMeta] = useState(false);
    const [googleExpanded, setGoogleExpanded] = useState(true);
    const [metaExpanded, setMetaExpanded] = useState(true);

    const fetchGoogleAccounts = async () => {
        if (!googleAdsConfig.enabled) return;
        setLoadingGoogle(true);
        try {
            const res = await fetch('/api/ads/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'list_customers', config: googleAdsConfig }),
            });
            const data = await res.json();
            if (data.customers) {
                setGoogleAccounts(data.customers);
            }
        } catch (err) {
            toast.error(`Failed to fetch Google Ads accounts: ${err.message}`);
        } finally {
            setLoadingGoogle(false);
        }
    };

    const fetchMetaAccounts = async () => {
        if (!metaAdsConfig.enabled) return;
        setLoadingMeta(true);
        try {
            const res = await fetch('/api/ads/meta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'list_accounts', config: metaAdsConfig }),
            });
            const data = await res.json();
            if (data.accounts) {
                setMetaAccounts(data.accounts);
            }
        } catch (err) {
            toast.error(`Failed to fetch Meta Ads accounts: ${err.message}`);
        } finally {
            setLoadingMeta(false);
        }
    };

    useEffect(() => {
        if (open) {
            if (googleAdsConfig.enabled && googleAccounts.length === 0) fetchGoogleAccounts();
            if (metaAdsConfig.enabled && metaAccounts.length === 0) fetchMetaAccounts();
        }
    }, [open]);

    const toggleGoogleAccount = (accountId) => {
        const current = [...selectedGoogleAdsAccounts];
        const idx = current.indexOf(accountId);
        if (idx >= 0) {
            current.splice(idx, 1);
        } else {
            current.push(accountId);
        }
        setSelectedGoogleAdsAccounts(current);
    };

    const toggleMetaAccount = (accountId) => {
        const current = [...selectedMetaAdsAccounts];
        const idx = current.indexOf(accountId);
        if (idx >= 0) {
            current.splice(idx, 1);
        } else {
            current.push(accountId);
        }
        setSelectedMetaAdsAccounts(current);
    };

    if (!open) return null;

    const hasanyAds = googleAdsConfig.enabled || metaAdsConfig.enabled;

    return (
        <div className={`table-panel ${open ? '' : 'collapsed'}`}>
            <div className="table-panel-header">
                <span>📈 Ad Accounts</span>
                <button className="table-panel-toggle" onClick={onClose}>
                    <HiOutlineXMark size={16} />
                </button>
            </div>

            <div className="table-panel-body">
                {!hasanyAds ? (
                    <div style={{ padding: '16px', textAlign: 'center' }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>No ad platforms configured.</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                            Go to Settings → Ad Platforms to connect Google Ads or Meta Ads.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Google Ads */}
                        {googleAdsConfig.enabled && (
                            <div className="dataset-group">
                                <div
                                    className="dataset-name"
                                    onClick={() => setGoogleExpanded(!googleExpanded)}
                                >
                                    {googleExpanded ? <HiOutlineChevronDown size={12} /> : <HiOutlineChevronRight size={12} />}
                                    <span>📈 Google Ads</span>
                                    {selectedGoogleAdsAccounts.length > 0 && (
                                        <span className="status-badge primary" style={{ marginLeft: 'auto', fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'var(--accent-primary)', color: 'white' }}>
                                            {selectedGoogleAdsAccounts.length}
                                        </span>
                                    )}
                                </div>
                                {googleExpanded && (
                                    <div style={{ marginTop: '4px' }}>
                                        {loadingGoogle ? (
                                            <div style={{ padding: '8px 28px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Loading...</div>
                                        ) : googleAccounts.length === 0 ? (
                                            <div style={{ padding: '8px 28px' }}>
                                                <button className="btn btn-secondary btn-sm" onClick={fetchGoogleAccounts}>
                                                    Fetch Accounts
                                                </button>
                                            </div>
                                        ) : (
                                            googleAccounts.map((acc) => {
                                                const isSelected = selectedGoogleAdsAccounts.includes(acc.id);
                                                return (
                                                    <div 
                                                        key={acc.id} 
                                                        className={`table-item ${isSelected ? 'selected' : ''}`}
                                                        onClick={() => toggleGoogleAccount(acc.id)}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => {}}
                                                        />
                                                        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                                            <span style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>{acc.name || acc.id}</span>
                                                            {acc.name !== acc.id && (
                                                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{acc.id}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Meta Ads */}
                        {metaAdsConfig.enabled && (
                            <div className="dataset-group">
                                <div
                                    className="dataset-name"
                                    onClick={() => setMetaExpanded(!metaExpanded)}
                                >
                                    {metaExpanded ? <HiOutlineChevronDown size={12} /> : <HiOutlineChevronRight size={12} />}
                                    <span>📘 Meta Ads</span>
                                    {selectedMetaAdsAccounts.length > 0 && (
                                        <span className="status-badge primary" style={{ marginLeft: 'auto', fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'var(--accent-primary)', color: 'white' }}>
                                            {selectedMetaAdsAccounts.length}
                                        </span>
                                    )}
                                </div>
                                {metaExpanded && (
                                    <div style={{ marginTop: '4px' }}>
                                        {loadingMeta ? (
                                            <div style={{ padding: '8px 28px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Loading...</div>
                                        ) : metaAccounts.length === 0 ? (
                                            <div style={{ padding: '8px 28px' }}>
                                                <button className="btn btn-secondary btn-sm" onClick={fetchMetaAccounts}>
                                                    Fetch Accounts
                                                </button>
                                            </div>
                                        ) : (
                                            metaAccounts.map((acc) => {
                                                const isSelected = selectedMetaAdsAccounts.includes(acc.id);
                                                return (
                                                    <div 
                                                        key={acc.id} 
                                                        className={`table-item ${isSelected ? 'selected' : ''}`}
                                                        onClick={() => toggleMetaAccount(acc.id)}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => {}}
                                                        />
                                                        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                                            <span style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>{acc.name || acc.id}</span>
                                                            {acc.name !== acc.id && (
                                                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{acc.id}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
