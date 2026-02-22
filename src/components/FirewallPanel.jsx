import React, { useState, useCallback, useMemo } from 'react';
import useSimulationStore from '../store/simulationStore';

let ruleIdCounter = 0;

function FirewallPanel() {
    const {
        mode, firewallRules, firewallBlocked, firewallEnabled,
        addFirewallRule, removeFirewallRule, toggleFirewall, clearFirewallRules,
        sessionHistory, saveSession, restoreSessionRules, clearSessionHistory
    } = useSimulationStore();

    const isLive = mode === 'live';

    // Add rule form state
    const [ruleIP, setRuleIP] = useState('');
    const [rulePort, setRulePort] = useState('');
    const [ruleProto, setRuleProto] = useState('TCP');
    const [ruleDir, setRuleDir] = useState('Inbound');
    const [ruleAction, setRuleAction] = useState('Block');

    // Quick action state
    const [quickIP, setQuickIP] = useState('');
    const [quickPort, setQuickPort] = useState('');

    const handleAddRule = useCallback(() => {
        if (!ruleIP && !rulePort) return;
        const rule = {
            id: ++ruleIdCounter,
            ip: ruleIP || '*',
            port: rulePort || '*',
            protocol: ruleProto,
            direction: ruleDir,
            action: ruleAction,
            createdAt: Date.now()
        };
        addFirewallRule(rule);
        setRuleIP('');
        setRulePort('');
    }, [ruleIP, rulePort, ruleProto, ruleDir, ruleAction, addFirewallRule]);

    const handleQuickBlock = useCallback(() => {
        if (!quickIP) return;
        addFirewallRule({
            id: ++ruleIdCounter, ip: quickIP, port: '*', protocol: 'TCP',
            direction: 'Inbound', action: 'Block', createdAt: Date.now()
        });
        setQuickIP('');
    }, [quickIP, addFirewallRule]);

    const handleQuickClosePort = useCallback(() => {
        if (!quickPort) return;
        addFirewallRule({
            id: ++ruleIdCounter, ip: '*', port: quickPort, protocol: 'TCP',
            direction: 'Inbound', action: 'Block', createdAt: Date.now()
        });
        setQuickPort('');
    }, [quickPort, addFirewallRule]);

    const handleQuickOpenPort = useCallback(() => {
        if (!quickPort) return;
        addFirewallRule({
            id: ++ruleIdCounter, ip: '*', port: quickPort, protocol: 'TCP',
            direction: 'Inbound', action: 'Allow', createdAt: Date.now()
        });
        setQuickPort('');
    }, [quickPort, addFirewallRule]);

    const blockedCount = firewallBlocked.length;
    const blockRules = firewallRules.filter(r => r.action === 'Block').length;
    const allowRules = firewallRules.filter(r => r.action === 'Allow').length;

    const recentBlocked = useMemo(() => [...firewallBlocked].reverse().slice(0, 50), [firewallBlocked]);

    const inputStyle = {
        background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '7px 10px',
        fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none', width: '100%',
        transition: 'border-color var(--transition-fast)'
    };

    const labelStyle = {
        fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3,
        textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600
    };

    const selectStyle = {
        ...inputStyle, cursor: 'pointer', appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', paddingRight: 28
    };

    return (
        <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 4 }}>
                Firewall Management
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                {isLive
                    ? 'Manage real UFW firewall rules on the Blue Team Ubuntu server via WebSocket.'
                    : 'Configure simulation firewall rules to block Red Team attack traffic.'}
            </p>

            {/* Status Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                <div className="card stat-card blue" style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Status</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: firewallEnabled ? 'var(--accent-emerald)' : 'var(--red-primary)' }}>
                        {firewallEnabled ? 'Active' : 'Disabled'}
                    </div>
                    <button
                        className={`btn ${firewallEnabled ? 'btn-ghost' : 'btn-success'} btn-sm`}
                        onClick={toggleFirewall}
                        style={{ marginTop: 8, width: '100%' }}
                    >
                        {firewallEnabled ? 'Disable' : 'Enable'}
                    </button>
                </div>

                <div className="card stat-card" style={{ padding: '14px 16px', borderColor: 'rgba(239,68,68,0.25)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Block Rules</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--red-primary)' }}>{blockRules}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>deny rules active</div>
                </div>

                <div className="card stat-card" style={{ padding: '14px 16px', borderColor: 'rgba(16,185,129,0.25)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Allow Rules</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-emerald)' }}>{allowRules}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>allow rules active</div>
                </div>

                <div className="card stat-card" style={{ padding: '14px 16px', borderColor: 'rgba(245,158,11,0.25)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Blocked</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-amber)' }}>{blockedCount}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>connections blocked</div>
                </div>
            </div>

            {/* Add Rule + Quick Actions Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 }}>

                {/* Add Rule Form */}
                <div className="card" style={{ padding: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blue-primary)', display: 'inline-block' }}></span>
                        Add Firewall Rule
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 100px 90px', gap: 10, alignItems: 'end' }}>
                        <div>
                            <label style={labelStyle}>IP Address</label>
                            <input style={inputStyle} type="text" value={ruleIP} onChange={e => setRuleIP(e.target.value)} placeholder="* (any)" />
                        </div>
                        <div>
                            <label style={labelStyle}>Port</label>
                            <input style={inputStyle} type="text" value={rulePort} onChange={e => setRulePort(e.target.value)} placeholder="* (any)" />
                        </div>
                        <div>
                            <label style={labelStyle}>Protocol</label>
                            <select style={selectStyle} value={ruleProto} onChange={e => setRuleProto(e.target.value)}>
                                <option>TCP</option><option>UDP</option><option>Both</option>
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Direction</label>
                            <select style={selectStyle} value={ruleDir} onChange={e => setRuleDir(e.target.value)}>
                                <option>Inbound</option><option>Outbound</option>
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Action</label>
                            <select style={selectStyle} value={ruleAction} onChange={e => setRuleAction(e.target.value)}>
                                <option>Block</option><option>Allow</option>
                            </select>
                        </div>
                    </div>

                    <button className="btn btn-primary" style={{ marginTop: 14, width: '100%' }} onClick={handleAddRule}>
                        Add Rule
                    </button>
                </div>

                {/* Quick Actions */}
                <div className="card" style={{ padding: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-amber)', display: 'inline-block' }}></span>
                        Quick Actions
                    </div>

                    <div style={{ marginBottom: 12 }}>
                        <label style={labelStyle}>Block IP</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <input style={inputStyle} type="text" value={quickIP} onChange={e => setQuickIP(e.target.value)} placeholder="10.0.0.5" />
                            <button className="btn btn-danger btn-sm" onClick={handleQuickBlock} style={{ whiteSpace: 'nowrap' }}>Block</button>
                        </div>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                        <label style={labelStyle}>Port</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <input style={inputStyle} type="text" value={quickPort} onChange={e => setQuickPort(e.target.value)} placeholder="8080" />
                            <button className="btn btn-danger btn-sm" onClick={handleQuickClosePort} style={{ whiteSpace: 'nowrap' }}>Close</button>
                            <button className="btn btn-success btn-sm" onClick={handleQuickOpenPort} style={{ whiteSpace: 'nowrap' }}>Open</button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={clearFirewallRules} style={{ flex: 1 }}>Reset All</button>
                        <button className="btn btn-primary btn-sm" onClick={() => saveSession()} style={{ flex: 1 }}>Save Session</button>
                    </div>
                </div>
            </div>

            {/* Active Rules Table */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header">
                    <div className="card-title">
                        Active Rules
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                            {firewallRules.length} {firewallRules.length === 1 ? 'rule' : 'rules'}
                        </span>
                    </div>
                    <span style={{ fontSize: 10, color: isLive ? 'var(--accent-emerald)' : 'var(--accent-purple)', fontWeight: 600 }}>
                        {isLive ? 'LIVE' : 'SIM'}
                    </span>
                </div>
                <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                    {firewallRules.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 30, fontSize: 12 }}>
                            No firewall rules configured. Add a rule above.
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    {['#', 'Action', 'IP Address', 'Port', 'Proto', 'Direction', ''].map(h => (
                                        <th key={h} style={{
                                            padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600,
                                            color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {firewallRules.map((rule, idx) => (
                                    <tr key={rule.id} style={{
                                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                                        transition: 'background 0.15s',
                                        animation: 'fadeIn 0.2s ease'
                                    }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.05)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <td style={{ padding: '8px 14px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                        <td style={{ padding: '8px 14px' }}>
                                            <span style={{
                                                display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                                                background: rule.action === 'Block' ? 'var(--red-bg)' : 'rgba(16,185,129,0.1)',
                                                color: rule.action === 'Block' ? 'var(--red-primary)' : 'var(--accent-emerald)',
                                                border: `1px solid ${rule.action === 'Block' ? 'var(--red-border)' : 'rgba(16,185,129,0.25)'}`
                                            }}>
                                                {rule.action === 'Block' ? 'DENY' : 'ALLOW'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '8px 14px', color: 'var(--text-primary)' }}>{rule.ip}</td>
                                        <td style={{ padding: '8px 14px', color: 'var(--accent-cyan)' }}>{rule.port}</td>
                                        <td style={{ padding: '8px 14px', color: 'var(--text-secondary)' }}>{rule.protocol}</td>
                                        <td style={{ padding: '8px 14px', color: 'var(--text-secondary)' }}>{rule.direction}</td>
                                        <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => removeFirewallRule(rule.id)}
                                                style={{ padding: '3px 8px', fontSize: 10, color: 'var(--red-primary)' }}
                                            >
                                                ✕
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Blocked Traffic Feed */}
            <div className="card">
                <div className="card-header">
                    <div className="card-title">
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: blockedCount > 0 ? 'var(--red-primary)' : 'var(--text-muted)', display: 'inline-block', animation: blockedCount > 0 ? 'pulse-red 2s infinite' : 'none' }}></span>
                        Blocked Traffic
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                            {blockedCount} events
                        </span>
                    </div>
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    {recentBlocked.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 30, fontSize: 12 }}>
                            {isLive ? 'No blocked traffic yet. Firewall events will appear here in real-time.' : 'No blocked traffic in this simulation session.'}
                        </div>
                    ) : (
                        recentBlocked.map(entry => (
                            <div key={entry.id} style={{
                                display: 'flex', gap: 10, padding: '6px 14px', alignItems: 'center',
                                borderBottom: '1px solid rgba(255,255,255,0.03)',
                                animation: 'fadeIn 0.2s ease'
                            }}>
                                <span style={{ color: 'var(--red-primary)', fontWeight: 700, fontSize: 9, minWidth: 38 }}>BLOCK</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: 10, minWidth: 75 }}>
                                    {new Date(entry.timestamp).toLocaleTimeString()}
                                </span>
                                <span style={{ color: 'var(--accent-amber)', minWidth: 110 }}>{entry.sourceIP}</span>
                                <span style={{ color: 'var(--accent-cyan)', minWidth: 50 }}>:{entry.port}</span>
                                <span style={{ color: 'var(--text-secondary)', minWidth: 35 }}>{entry.protocol}</span>
                                <span style={{ color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {entry.reason}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
            {/* Session History */}
            <div className="card" style={{ marginTop: 20 }}>
                <div className="card-header">
                    <div className="card-title">
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-purple)', display: 'inline-block' }}></span>
                        Session History
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                            {sessionHistory.length} saved
                        </span>
                    </div>
                    {sessionHistory.length > 0 && (
                        <button className="btn btn-ghost btn-sm" onClick={clearSessionHistory} style={{ fontSize: 10, padding: '2px 8px' }}>Clear History</button>
                    )}
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {sessionHistory.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24, fontSize: 12 }}>
                            No saved sessions. Click "Save Session" to snapshot your current rules.
                        </div>
                    ) : (
                        [...sessionHistory].reverse().map(session => (
                            <div key={session.id} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)',
                                transition: 'background 0.15s'
                            }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.05)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{
                                        fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 700,
                                        background: session.mode === 'live' ? 'rgba(16,185,129,0.1)' : 'rgba(139,92,246,0.1)',
                                        color: session.mode === 'live' ? 'var(--accent-emerald)' : 'var(--accent-purple)',
                                        border: `1px solid ${session.mode === 'live' ? 'rgba(16,185,129,0.25)' : 'rgba(139,92,246,0.25)'}`
                                    }}>{session.mode === 'live' ? 'LIVE' : 'SIM'}</span>
                                    <div>
                                        <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>{session.scenarioName}</div>
                                        <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                            {new Date(session.timestamp).toLocaleString()} · {session.firewallRules?.length || 0} rules · {session.firewallBlocked || 0} blocked
                                        </div>
                                    </div>
                                </div>
                                <button className="btn btn-primary btn-sm" onClick={() => restoreSessionRules(session.id)}
                                    style={{ fontSize: 9, padding: '3px 8px' }}>Restore Rules</button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export default FirewallPanel;
