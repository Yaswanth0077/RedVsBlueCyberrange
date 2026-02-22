import React, { useEffect, useState, useRef } from 'react';
import { io as socketIOClient } from 'socket.io-client';

const SEVERITY_STYLES = {
    critical: { bg: 'rgba(239,68,68,0.12)', border: '#ef4444', icon: '🚨' },
    Critical: { bg: 'rgba(239,68,68,0.12)', border: '#ef4444', icon: '🚨' },
    High: { bg: 'rgba(249,115,22,0.12)', border: '#f97316', icon: '⚠️' },
    warning: { bg: 'rgba(234,179,8,0.12)', border: '#eab308', icon: '⚡' },
    Medium: { bg: 'rgba(234,179,8,0.12)', border: '#eab308', icon: '⚡' },
    info: { bg: 'rgba(59,130,246,0.08)', border: '#3b82f6', icon: 'ℹ️' },
    Low: { bg: 'rgba(34,197,94,0.08)', border: '#22c55e', icon: '✅' }
};

const SERVER = '';

function BlueTeamAlertPanel() {
    const [alerts, setAlerts] = useState([]);
    const [defenseStatus, setDefenseStatus] = useState(null);
    const [connected, setConnected] = useState(false);
    const token = localStorage.getItem('token');
    const alertContainerRef = useRef(null);

    useEffect(() => {
        // Fetch defense status
        fetch(`${SERVER}/api/attacks/defense-status`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.ok ? res.json() : null)
            .then(data => { if (data) setDefenseStatus(data); })
            .catch(() => { });

        const socket = socketIOClient(SERVER);

        socket.on('connect', () => setConnected(true));
        socket.on('disconnect', () => setConnected(false));

        socket.on('blue_team_alert', (data) => {
            setAlerts(prev => [data, ...prev].slice(0, 100));
        });

        socket.on('system_metrics_update', (data) => {
            if (data.threatScore != null) {
                setDefenseStatus(prev => prev ? { ...prev, threatScore: data.threatScore } : prev);
            }
        });

        // Refresh defense status periodically
        const statusInterval = setInterval(() => {
            fetch(`${SERVER}/api/attacks/defense-status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
                .then(res => res.ok ? res.json() : null)
                .then(data => { if (data) setDefenseStatus(data); })
                .catch(() => { });
        }, 5000);

        return () => { socket.disconnect(); clearInterval(statusInterval); };
    }, [token]);

    const threatScoreColor = (score) => {
        if (score > 70) return '#ef4444';
        if (score > 40) return '#f97316';
        if (score > 15) return '#eab308';
        return '#22c55e';
    };

    return (
        <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 4 }}>
                🛡️ Blue Team Defense Center
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                Real-time IDS detections, threat scoring, and automated countermeasures.
                <span style={{ marginLeft: 10, fontSize: 10, color: connected ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                    {connected ? '● LIVE' : '● DISCONNECTED'}
                </span>
            </p>

            {/* Defense Stats Dashboard */}
            {defenseStatus && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                    <div className="card" style={{ padding: 14, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Threat Score</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: threatScoreColor(defenseStatus.threatScore) }}>
                            {defenseStatus.threatScore}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>/100</div>
                    </div>
                    <div className="card" style={{ padding: 14, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Detections</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: '#3b82f6' }}>
                            {defenseStatus.totalDetections}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>total</div>
                    </div>
                    <div className="card" style={{ padding: 14, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>IPs Blocked</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: '#f97316' }}>
                            {defenseStatus.blockedIPs?.length || 0}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>sources</div>
                    </div>
                    <div className="card" style={{ padding: 14, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Mitigation</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: '#22c55e' }}>
                            {Math.round((defenseStatus.mitigationFactor || 0) * 100)}%
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>reduction</div>
                    </div>
                </div>
            )}

            {/* Blocked IPs */}
            {defenseStatus?.blockedIPs?.length > 0 && (
                <div className="card" style={{ padding: 14, marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#f97316', marginBottom: 8 }}>🔥 Blocked IP Addresses</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {defenseStatus.blockedIPs.map((ip, i) => (
                            <span key={i} style={{ fontSize: 11, padding: '3px 8px', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 4, fontFamily: 'var(--font-mono)', color: '#f97316' }}>
                                {ip}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Live Alert Feed */}
            <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-bright)' }}>Live Alert Feed</div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{alerts.length} events</span>
                </div>
                <div ref={alertContainerRef} style={{ maxHeight: 450, overflowY: 'auto' }}>
                    {alerts.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 30 }}>
                            No alerts yet. Launch an attack from the Attack Center to see live IDS detections...
                        </div>
                    ) : (
                        alerts.map((alert, idx) => {
                            const sev = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info;
                            return (
                                <div key={idx} style={{
                                    padding: 10,
                                    marginBottom: 6,
                                    backgroundColor: sev.bg,
                                    borderLeft: `4px solid ${sev.border}`,
                                    borderRadius: '0 6px 6px 0',
                                    transition: 'all 0.3s ease'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: sev.border }}>
                                            {sev.icon} {alert.type === 'ids_detection' ? 'IDS Detection' : alert.type === 'defense_action' ? 'Defense Action' : alert.type === 'auto_mitigation' ? 'Auto-Mitigation' : alert.type === 'firewall_update' ? 'Firewall' : alert.type === 'health_update' ? 'System Health' : 'Alert'}
                                        </span>
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                            {new Date(alert.timestamp).toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-bright)', lineHeight: 1.5 }}>
                                        {alert.message}
                                    </div>
                                    {alert.sourceIP && (
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                                            Source: {alert.sourceIP} {alert.threatScore != null && `| Threat: ${alert.threatScore}/100`}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}

export default BlueTeamAlertPanel;
