import React, { useMemo, useEffect, useState } from 'react';
import useSimulationStore from '../store/simulationStore';
import {
    ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#6b7280', '#8b5cf6', '#ec4899'];

function formatTs(ts) {
    const d = new Date(ts);
    return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

const TOOLTIP_STYLE = { background: '#1a2332', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, fontSize: 11 };

function ReportPanel() {
    const { simulation, mode, backendReport, backendScores, liveLogs, liveScoring, backendTimeline } = useSimulationStore();
    const [report, setReport] = useState(null);

    const isLive = mode === 'live';

    // Auto-refresh report from backend whenever backendReport changes
    useEffect(() => {
        if (backendReport) {
            setReport(backendReport);
        }
    }, [backendReport]);

    // Also fetch report on mount
    useEffect(() => {
        fetch('/api/report')
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data) setReport(data); })
            .catch(() => { });
    }, []);

    // Fallback to simulation data
    const scores = backendScores || (isLive ? liveScoring : simulation?.scoring);
    const logs = isLive ? liveLogs : (simulation?.logs || []);

    const localReport = useMemo(() => {
        if (report) return report;
        // Generate from local data
        const total = logs.length;
        const redLogs = logs.filter(l => l.team === 'red');
        const blueLogs = logs.filter(l => l.team === 'blue');
        return {
            totalAttacks: redLogs.length,
            successRate: 0,
            detectionRate: 0,
            topAttackTypes: [],
            avgSystemHealth: 100,
            scores: scores,
            attackTimeline: logs.slice(-20)
        };
    }, [report, logs, scores]);

    // Pie chart data for success/block ratio
    const outcomeData = useMemo(() => {
        if (!localReport) return [];
        return [
            { name: 'Successful', value: localReport.successRate || 0 },
            { name: 'Blocked', value: 100 - (localReport.successRate || 0) }
        ].filter(d => d.value > 0);
    }, [localReport]);

    // Top attacks bar chart
    const topAttackData = useMemo(() => {
        return (localReport?.topAttackTypes || []).map(t => ({ name: t.name, count: t.count }));
    }, [localReport]);

    // Health history chart
    const healthData = useMemo(() => {
        return (localReport?.healthHistory || []).map(h => ({
            time: new Date(h.timestamp).toLocaleTimeString(), health: h.health
        }));
    }, [localReport]);

    // Score timeline
    const scoreHistory = useMemo(() => {
        return (localReport?.scores?.history || []).slice(-20).map(h => ({
            time: new Date(h.timestamp).toLocaleTimeString(), red: h.red, blue: h.blue
        }));
    }, [localReport]);

    const handleExportJSON = () => {
        const blob = new Blob([JSON.stringify(localReport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `rvb-report-${Date.now()}.json`; a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 4 }}>
                        📊 Auto-Generated Report
                    </h2>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Auto-updates after every attack • Pulled from persistent database
                    </p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={handleExportJSON}>
                    Export JSON
                </button>
            </div>

            {/* Summary Stats */}
            <div className="stat-grid" style={{ marginBottom: 16 }}>
                <div className="stat-card red">
                    <div className="stat-label">Total Attacks</div>
                    <div className="stat-value">{localReport.totalAttacks || 0}</div>
                </div>
                <div className="stat-card" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
                    <div className="stat-label">Success Rate</div>
                    <div className="stat-value">{localReport.successRate || 0}%</div>
                </div>
                <div className="stat-card blue">
                    <div className="stat-label">Detection Rate</div>
                    <div className="stat-value">{localReport.detectionRate || 0}%</div>
                </div>
                <div className="stat-card" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
                    <div className="stat-label">Avg System Health</div>
                    <div className="stat-value">{localReport.avgSystemHealth || 100}%</div>
                </div>
            </div>

            {/* Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                {/* Success vs Blocked Pie */}
                <div className="card" style={{ padding: 16 }}>
                    <div className="card-header"><div className="card-title">Attack Outcome</div></div>
                    <div className="card-body">
                        {outcomeData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={180}>
                                <PieChart>
                                    <Pie data={outcomeData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${value}%`}>
                                        {outcomeData.map((_, i) => <Cell key={i} fill={i === 0 ? '#ef4444' : '#3b82f6'} />)}
                                    </Pie>
                                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>No attack data yet</div>
                        )}
                    </div>
                </div>

                {/* Top Attack Types */}
                <div className="card" style={{ padding: 16 }}>
                    <div className="card-header"><div className="card-title">Top Attack Types</div></div>
                    <div className="card-body">
                        {topAttackData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={topAttackData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis type="number" tick={{ fontSize: 9, fill: '#888' }} />
                                    <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: '#aaa' }} width={120} />
                                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                                    <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>No data</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Score Comparison Over Time */}
            {scoreHistory.length > 0 && (
                <div className="card" style={{ padding: 16, marginBottom: 16 }}>
                    <div className="card-header"><div className="card-title">Score History</div></div>
                    <div className="card-body">
                        <ResponsiveContainer width="100%" height={150}>
                            <BarChart data={scoreHistory}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#888' }} />
                                <YAxis tick={{ fontSize: 9, fill: '#888' }} />
                                <Tooltip contentStyle={TOOLTIP_STYLE} />
                                <Bar dataKey="red" fill="#ef4444" name="Red Team" />
                                <Bar dataKey="blue" fill="#3b82f6" name="Blue Team" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Attack Timeline Summary */}
            <div className="card" style={{ padding: 16 }}>
                <div className="card-header"><div className="card-title">Attack Timeline Summary</div></div>
                <div className="card-body">
                    <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                        {(localReport.attackTimeline || []).slice(-20).reverse().map((entry, i) => (
                            <div key={entry.id || i} style={{
                                padding: 8, marginBottom: 4, borderRadius: 4,
                                background: entry.result === 'Success' ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.08)',
                                borderLeft: `3px solid ${entry.result === 'Success' ? '#ef4444' : '#3b82f6'}`
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                                    <span style={{ fontWeight: 700 }}>{entry.name || entry.attackName}</span>
                                    <span style={{
                                        fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                                        background: entry.result === 'Success' ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)',
                                        color: entry.result === 'Success' ? '#ef4444' : '#22c55e'
                                    }}>
                                        {entry.result || 'Unknown'}
                                    </span>
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                                    {formatTs(entry.timestamp)} | Detected: {entry.detected ? '✅' : '❌'} | {entry.impactLevel || 'N/A'}
                                </div>
                            </div>
                        ))}
                        {(!localReport.attackTimeline || localReport.attackTimeline.length === 0) && (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20, fontSize: 12 }}>
                                No attacks executed yet. Launch attacks from the Attack Center.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ReportPanel;
