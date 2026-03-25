'use client';

import { useState, useEffect, useRef } from 'react';

export default function AgentProgress({ steps, currentStatus, isActive }) {
    const [expanded, setExpanded] = useState(true);
    const bottomRef = useRef(null);

    useEffect(() => {
        if (bottomRef.current && isActive) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [steps, currentStatus, isActive]);

    if (!isActive && (!steps || steps.length === 0)) return null;

    return (
        <div className="message assistant">
            <div className="message-avatar">◈</div>
            <div className="message-body">
                <div className="message-content">
                    <div className="agent-progress-stream">
                        {/* Completed Steps */}
                        {steps && steps.map((step, i) => (
                            <div key={i} className="agent-step completed">
                                <span className="agent-step-icon">✓</span>
                                <span className="agent-step-text">{step.message}</span>
                            </div>
                        ))}

                        {/* Current Active Status */}
                        {isActive && currentStatus && (
                            <div className="agent-step active">
                                <span className="agent-step-spinner" />
                                <span className="agent-step-text">{currentStatus}</span>
                            </div>
                        )}

                        {/* Fallback when active with no status yet */}
                        {isActive && !currentStatus && steps.length === 0 && (
                            <div className="agent-step active">
                                <span className="agent-step-spinner" />
                                <span className="agent-step-text">Starting up...</span>
                            </div>
                        )}

                        <div ref={bottomRef} />
                    </div>
                </div>
            </div>
        </div>
    );
}
