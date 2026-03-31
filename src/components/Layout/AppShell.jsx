'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/store/app-store';
import { getModelById, MODEL_PROVIDERS } from '@/services/llm/model-registry';
import {
    HiOutlineChatBubbleLeftRight,
    HiOutlineCog6Tooth,
    HiOutlineChartBarSquare,
    HiOutlinePlus,
    HiOutlineBars3,
    HiOutlineTrash,
    HiOutlineSun,
    HiOutlineMoon,
} from 'react-icons/hi2';

export default function AppShell({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const pathname = usePathname();
    const router = useRouter();
    const {
        theme,
        toggleTheme,
        selectedModel,
        conversations,
        activeConversationId,
        createConversation,
        setActiveConversation,
        deleteConversation,
    } = useAppStore();

    const model = getModelById(selectedModel);
    const provider = model ? MODEL_PROVIDERS[model.provider] : null;

    const handleNewChat = () => {
        createConversation();
    };

    return (
        <div className="app-shell">
            {/* Sidebar */}
            <aside className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
                <div className="sidebar-header">
                    <div className="sidebar-brand">
                        <div className="sidebar-brand-icon">◈</div>
                        <h1>DataLens AI</h1>
                        <span style={{ fontSize: '0.6rem', fontWeight: 500, background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginLeft: '4px', letterSpacing: '0.04em' }}>v0.4</span>
                    </div>
                    <button className="new-chat-btn" onClick={handleNewChat}>
                        <HiOutlinePlus size={16} /> New Chat
                    </button>
                </div>

                <nav className="sidebar-nav">
                    <Link href="/" className={pathname === '/' ? 'active' : ''}>
                        <HiOutlineChatBubbleLeftRight size={18} /> Chat
                    </Link>
                    <Link
                        href="/settings"
                        className={pathname === '/settings' ? 'active' : ''}
                    >
                        <HiOutlineCog6Tooth size={18} /> Settings
                    </Link>
                    <Link
                        href="/usage"
                        className={pathname === '/usage' ? 'active' : ''}
                    >
                        <HiOutlineChartBarSquare size={18} /> Usage & Costs
                    </Link>
                </nav>

                <div className="sidebar-conversations">
                    <h3>Conversations</h3>
                    {conversations.length === 0 && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '8px 14px' }}>
                            No conversations yet
                        </p>
                    )}
                    {conversations.map((conv) => (
                        <div
                            key={conv.id}
                            className={`conv-item ${conv.id === activeConversationId ? 'active' : ''}`}
                            onClick={() => {
                                setActiveConversation(conv.id);
                                if (pathname !== '/') {
                                    router.push('/');
                                }
                            }}
                        >
                            <span className="conv-item-title">{conv.title}</span>
                            <button
                                className="conv-item-delete"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    deleteConversation(conv.id);
                                }}
                                title="Delete"
                            >
                                <HiOutlineTrash size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main Content */}
            <div className="main-content">
                {/* Header */}
                <header className="header">
                    <div className="header-left">
                        <button
                            className="sidebar-toggle"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            title="Toggle sidebar"
                        >
                            <HiOutlineBars3 size={18} />
                        </button>
                        {model && provider && (
                            <div className="header-model">
                                <span className="header-model-dot" />
                                <span>{provider.icon} {model.name}</span>
                            </div>
                        )}
                    </div>
                    <div className="header-right">
                        <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
                            <div className="theme-toggle-knob">
                                {theme === 'dark' ? '🌙' : '☀️'}
                            </div>
                        </button>
                    </div>
                </header>

                <div className="page-content">{children}</div>
            </div>
        </div>
    );
}
