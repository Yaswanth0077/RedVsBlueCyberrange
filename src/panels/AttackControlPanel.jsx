import React, { useEffect, useState, useRef } from 'react';
import { io as socketIOClient } from 'socket.io-client';

const IMPACT_COLORS = {
    Critical: '#ef4444',
    High: '#f97316',
    Medium: '#eab308',
    Low: '#22c55e'
};

const SERVER = '';

function AttackControlPanel() {
    const [attacks, setAttacks] = useState([]);
    const [activeAttacks, setActiveAttacks] = useState({});
    const [attackLogs, setAttackLogs] = useState({});
    const [error, setError] = useState('');
    const token = localStorage.getItem('token');
    const socketRef = useRef(null);

    useEffect(() => {
        // Fetch attack definitions from backend
        fetch(`${SERVER}/api/attacks/definitions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data)) setAttacks(data);
            })
            .catch(err => setError(`Failed to load attacks: ${err.message}. Make sure backend is running (npm run server)`));

        // Fetch currently active attacks
        fetch(`${SERVER}/api/attacks/active`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.ok ? res.json() : [])
            .then(data => {
                if (Array.isArray(data)) {
                    const activeMap = {};
                    data.forEach(a => activeMap[a.id] = { status: 'running', progress: a.progress });
                    setActiveAttacks(activeMap);
                }
            })
            .catch(() => { });

        // Socket.io for real-time updates
        const socket = socketIOClient(SERVER);
        socketRef.current = socket;

        socket.on('attack_started', (data) => {
            setActiveAttacks(prev => ({ ...prev, [data.attackId]: { status: 'running', progress: 0 } }));
            if (data.logs) {
                setAttackLogs(prev => ({ ...prev, [data.attackId]: data.logs }));
            }
        });

        socket.on('attack_progress', (data) => {
            setActiveAttacks(prev => ({
                ...prev,
                [data.attackId]: { ...prev[data.attackId], status: 'running', progress: data.progress }
            }));
        });

        socket.on('attack_stopped', (data) => {
            setActiveAttacks(prev => {
                const next = { ...prev };
                next[data.attackId] = { status: 'cancelled' };
                return next;
            });
            setTimeout(() => {
                setActiveAttacks(p => { const n = { ...p }; delete n[data.attackId]; return n; });
            }, 3000);
        });

        socket.on('attack_completed', (data) => {
            setActiveAttacks(prev => ({
                ...prev,
                [data.attackId]: { status: data.result === 'Success' ? 'success' : 'failed', effectiveProb: data.effectiveProbability }
            }));
            setTimeout(() => {
                setActiveAttacks(p => { const n = { ...p }; delete n[data.attackId]; return n; });
                setAttackLogs(p => { const n = { ...p }; delete n[data.attackId]; return n; });
            }, 5000);
        });

        return () => socket.disconnect();
    }, [token]);

    const handleStart = async (attackId) => {
        try {
            const res = await fetch(`${SERVER}/api/attacks/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ attackId })
            });
            const data = await res.json();
            if (!res.ok) setError(data.error || 'Failed to start attack');
        } catch (err) {
            setError('Server connection failed. Is the backend running?');
        }
    };

    const handleStop = async (attackId) => {
        try {
            await fetch(`${SERVER}/api/attacks/stop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ attackId })
            });
        } catch (err) {
            setError('Failed to stop attack');
        }
    };

    const getStatusBadge = (state) => {
        if (!state) return null;
        const styles = {
            running: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', text: 'EXECUTING' },
            success: { bg: 'rgba(239,68,68,0.25)', color: '#ef4444', text: '⚡ SUCCESS' },
            failed: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', text: '🛡️ BLOCKED' },
            cancelled: { bg: 'rgba(156,163,175,0.15)', color: '#9ca3af', text: 'CANCELLED' }
        };
        const s = styles[state.status] || styles.cancelled;
        return (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: s.bg, color: s.color, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                {s.text}
            </span>
        );
    };

    return (
        <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 4 }}>
                🎯 Attack Command Center
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                Launch advanced cyber attacks from the Red Team engine. Each attack runs in real-time with live progress, logs, and Blue Team detection.
            </p>

            {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 12, color: '#ef4444' }}>
                    ⚠️ {error}
                    <button onClick={() => setError('')} style={{ marginLeft: 10, background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                </div>
            )}

            {attacks.length === 0 && !error && (
                <div className="card" style={{ padding: 30, textAlign: 'center' }}>
                    <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Loading attack modules...</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                        Make sure the backend server is running: <code>npm run server</code>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
                {attacks.map(attack => {
                    const state = activeAttacks[attack.id];
                    const isRunning = state?.status === 'running';
                    const logs = attackLogs[attack.id] || [];
                    const impactColor = IMPACT_COLORS[attack.impactLevel] || '#888';

                    return (
                        <div key={attack.id} className="card" style={{
                            padding: 16,
                            borderColor: isRunning ? '#ef4444' : 'var(--border-color)',
                            transition: 'border-color 0.3s ease',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            {/* Progress bar overlay */}
                            {isRunning && (
                                <div style={{
                                    position: 'absolute', top: 0, left: 0,
                                    height: 3, width: `${state.progress || 0}%`,
                                    background: 'linear-gradient(90deg, #ef4444, #f97316)',
                                    transition: 'width 0.5s ease'
                                }} />
                            )}

                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-bright)' }}>{attack.name}</div>
                                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: `${impactColor}22`, color: impactColor, letterSpacing: 0.5 }}>
                                    {attack.impactLevel}
                                </span>
                            </div>

                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
                                {attack.description}
                            </div>

                            {/* Stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
                                <div style={{ fontSize: 10, textAlign: 'center', padding: '4px 0', background: 'var(--bg-darker)', borderRadius: 4 }}>
                                    <div style={{ color: 'var(--text-muted)' }}>Duration</div>
                                    <div style={{ fontWeight: 700, color: 'var(--text-bright)' }}>{(attack.duration / 1000).toFixed(1)}s</div>
                                </div>
                                <div style={{ fontSize: 10, textAlign: 'center', padding: '4px 0', background: 'var(--bg-darker)', borderRadius: 4 }}>
                                    <div style={{ color: 'var(--text-muted)' }}>Success</div>
                                    <div style={{ fontWeight: 700, color: '#ef4444' }}>{Math.round(attack.baseSuccessProbability * 100)}%</div>
                                </div>
                                <div style={{ fontSize: 10, textAlign: 'center', padding: '4px 0', background: 'var(--bg-darker)', borderRadius: 4 }}>
                                    <div style={{ color: 'var(--text-muted)' }}>Detection</div>
                                    <div style={{ fontWeight: 700, color: '#3b82f6' }}>{Math.round(attack.baseDetectionProbability * 100)}%</div>
                                </div>
                            </div>

                            {/* Execution logs when running */}
                            {isRunning && logs.length > 0 && (
                                <div style={{ background: 'var(--bg-darker)', borderRadius: 4, padding: 8, marginBottom: 12, maxHeight: 80, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#22c55e' }}>
                                    {logs.map((log, i) => (
                                        <div key={i} style={{ opacity: 0.8 }}>{'>'} {log}</div>
                                    ))}
                                </div>
                            )}

                            {/* Status + Actions */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                {getStatusBadge(state)}
                                {isRunning ? (
                                    <button className="btn btn-ghost btn-sm" onClick={() => handleStop(attack.id)} style={{ fontSize: 11 }}>
                                        ■ Stop
                                    </button>
                                ) : state ? (
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                        {state.effectiveProb != null && `(${state.effectiveProb}% effective)`}
                                    </span>
                                ) : (
                                    <button className="btn btn-danger btn-sm" style={{ width: '100%', fontSize: 12, fontWeight: 700 }} onClick={() => handleStart(attack.id)}>
                                        ▶ Launch Attack
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default AttackControlPanel;
