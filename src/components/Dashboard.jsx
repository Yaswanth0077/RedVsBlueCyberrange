import React, { useMemo, useEffect, useState } from 'react';
import useSimulationStore from '../store/simulationStore';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart, BarChart, Bar, CartesianGrid, Legend } from 'recharts';

const TOOLTIP_STYLE = { background: '#1a2332', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, fontSize: 11 };

function formatTs(ts) {
    const d = new Date(ts);
    return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

function Dashboard() {
    const {
        simulation, mode, liveLogs, liveScoring, liveRedTeam, liveBlueTeam, liveStatus,
        backendScores, attackGraphData, defenseGraphData, systemHealth, backendMetrics, backendTimeline
    } = useSimulationStore();

    const isLive = mode === 'live';

    const logs = isLive ? liveLogs : simulation?.logs || [];
    const scoring = backendScores || (isLive ? liveScoring : simulation?.scoring);
    const redTeam = isLive ? liveRedTeam : simulation?.redTeam;
    const blueTeam = isLive ? liveBlueTeam : simulation?.blueTeam;
    const hasData = backendScores || (isLive ? (liveLogs.length > 0) : !!(simulation && simulation.scenario));

    // Chart data from backend graph stream
    const activityChartData = useMemo(() => {
        if (attackGraphData && attackGraphData.length > 0) {
            return attackGraphData.slice(-20).map((d, i) => ({
                time: d.time, attacks: i + 1, blocked: d.blocked || 0, success: d.success || 0
            }));
        }
        // Fallback to log-based chart
        const bucketSize = isLive ? 10 : 5;
        const buckets = {};
        logs.forEach(l => {
            const bucket = Math.floor((l.tick || 0) / bucketSize) * bucketSize;
            if (!buckets[bucket]) buckets[bucket] = { tick: bucket, red: 0, blue: 0 };
            if (l.team === 'red') buckets[bucket].red++;
            else if (l.team === 'blue') buckets[bucket].blue++;
        });
        return Object.values(buckets).sort((a, b) => a.tick - b.tick);
    }, [attackGraphData, logs, isLive]);

    // Defense events chart
    const defenseChartData = useMemo(() => {
        if (!defenseGraphData || defenseGraphData.length === 0) return [];
        return defenseGraphData.slice(-20).map((d, i) => ({
            time: d.time, detections: defenseGraphData.filter((_, j) => j <= i && defenseGraphData[j].type === 'ids_detection').length,
            mitigations: defenseGraphData.filter((_, j) => j <= i && defenseGraphData[j].type === 'auto_mitigation').length
        }));
    }, [defenseGraphData]);

    // Health & threat data
    const healthData = useMemo(() => {
        if (backendMetrics?.healthHistory) {
            return backendMetrics.healthHistory.slice(-20).map(h => ({
                time: new Date(h.timestamp).toLocaleTimeString(), health: h.health
            }));
        }
        return [];
    }, [backendMetrics]);

    // Score comparison data for bar chart
    const scoreData = useMemo(() => {
        if (!scoring) return [];
        return [
            { name: 'Red Team', score: scoring.red || scoring.redTeamScore || 0, fill: '#ef4444' },
            { name: 'Blue Team', score: scoring.blue || scoring.blueTeamScore || 0, fill: '#3b82f6' }
        ];
    }, [scoring]);

    // Recent timeline events
    const recentEvents = useMemo(() => {
        return (backendTimeline || []).slice(-10).reverse();
    }, [backendTimeline]);

    if (!hasData) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon" style={{ fontSize: 32, opacity: 0.4, fontWeight: 800, color: 'var(--red-primary)' }}>RvB</div>
                <div className="empty-state-title">
                    {isLive ? 'No Live Data' : 'No Scenario Loaded'}
                </div>
                <div className="empty-state-desc">
                    {isLive
                        ? 'Connect to Red and Blue Team agents in Live Mode to see real attack/defense data.'
                        : 'Select a scenario or launch attacks from the Attack Center to populate the dashboard.'}
                </div>
                {!isLive && (
                    <button className="btn btn-primary" onClick={() => useSimulationStore.getState().setActiveTab('attacks')} style={{ marginTop: 12 }}>
                        Open Attack Center
                    </button>
                )}
            </div>
        );
    }

    return (
        <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 4 }}>
                {isLive ? 'Live Operations Dashboard' : 'Cyber Range Dashboard'}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                Real-time synchronized view | System Health: {systemHealth ?? 100}%
                {backendMetrics && ` | Total Attacks: ${backendMetrics.totalAttacks}`}
            </p>

            {/* Stat Cards */}
            <div className="stat-grid">
                <div className="stat-card red">
                    <div className="stat-label">Red Team Score</div>
                    <div className="stat-value">{scoring?.red ?? scoring?.redTeamScore ?? 0}</div>
                    <div className="stat-detail">
                        {backendMetrics ? `${backendMetrics.successfulAttacks} successful / ${backendMetrics.totalAttacks} total` : `${redTeam?.totalAttacks || 0} attacks`}
                    </div>
                </div>
                <div className="stat-card blue">
                    <div className="stat-label">Blue Team Score</div>
                    <div className="stat-value">{scoring?.blue ?? scoring?.blueTeamScore ?? 0}</div>
                    <div className="stat-detail">
                        {backendMetrics ? `${backendMetrics.totalDetections} detections, ${backendMetrics.blockedAttacks} blocked` : `${blueTeam?.totalDetections || 0} detections`}
                    </div>
                </div>
                <div className="stat-card" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
                    <div className="stat-label">System Health</div>
                    <div className="stat-value" style={{ color: (systemHealth ?? 100) > 60 ? '#22c55e' : (systemHealth ?? 100) > 30 ? '#eab308' : '#ef4444' }}>
                        {systemHealth ?? 100}<span style={{ fontSize: 14, color: 'var(--text-muted)' }}>%</span>
                    </div>
                    <div className="stat-detail">
                        {backendMetrics ? `Avg: ${backendMetrics.avgSystemHealth}%` : isLive ? `Red: ${liveStatus.red} | Blue: ${liveStatus.blue}` : `Phase: ${redTeam?.phase || 'idle'}`}
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Detection Rate</div>
                    <div className="stat-value">
                        {backendMetrics && backendMetrics.totalAttacks > 0
                            ? Math.round((backendMetrics.totalDetections / backendMetrics.totalAttacks) * 100)
                            : 0}
                        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>%</span>
                    </div>
                    <div className="stat-detail">{(logs.length || 0) + (backendTimeline?.length || 0)} total events</div>
                </div>
            </div>

            {/* Attack Activity + Score Comparison Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 16 }}>
                <div className="card" style={{ padding: 16 }}>
                    <div className="card-header"><div className="card-title">Attack Activity (Real-Time)</div></div>
                    <div className="card-body">
                        <ResponsiveContainer width="100%" height={180}>
                            <AreaChart data={activityChartData}>
                                <defs>
                                    <linearGradient id="redG" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="blueG" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#888' }} />
                                <YAxis tick={{ fontSize: 9, fill: '#888' }} />
                                <Tooltip contentStyle={TOOLTIP_STYLE} />
                                {attackGraphData?.length > 0 ? (
                                    <>
                                        <Area type="monotone" dataKey="attacks" stroke="#ef4444" fill="url(#redG)" strokeWidth={2} name="Attacks" />
                                        <Area type="monotone" dataKey="blocked" stroke="#3b82f6" fill="url(#blueG)" strokeWidth={2} name="Blocked" />
                                    </>
                                ) : (
                                    <>
                                        <Area type="monotone" dataKey="red" stroke="#ef4444" fill="url(#redG)" strokeWidth={2} />
                                        <Area type="monotone" dataKey="blue" stroke="#3b82f6" fill="url(#blueG)" strokeWidth={2} />
                                    </>
                                )}
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card" style={{ padding: 16 }}>
                    <div className="card-header"><div className="card-title">Score Comparison</div></div>
                    <div className="card-body">
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={scoreData}>
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#aaa' }} />
                                <YAxis tick={{ fontSize: 9, fill: '#888' }} />
                                <Tooltip contentStyle={TOOLTIP_STYLE} />
                                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                                    {scoreData.map((entry, i) => (
                                        <Bar key={i} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Defense Activity + System Health Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                {defenseChartData.length > 0 && (
                    <div className="card" style={{ padding: 16 }}>
                        <div className="card-header"><div className="card-title">Defense Activity</div></div>
                        <div className="card-body">
                            <ResponsiveContainer width="100%" height={150}>
                                <LineChart data={defenseChartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#888' }} />
                                    <YAxis tick={{ fontSize: 9, fill: '#888' }} />
                                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                                    <Line type="monotone" dataKey="detections" stroke="#f97316" strokeWidth={2} dot={false} name="Detections" />
                                    <Line type="monotone" dataKey="mitigations" stroke="#22c55e" strokeWidth={2} dot={false} name="Mitigations" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {healthData.length > 0 && (
                    <div className="card" style={{ padding: 16 }}>
                        <div className="card-header"><div className="card-title">System Health Trend</div></div>
                        <div className="card-body">
                            <ResponsiveContainer width="100%" height={150}>
                                <AreaChart data={healthData}>
                                    <defs>
                                        <linearGradient id="healthG" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                                            <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#888' }} />
                                    <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#888' }} />
                                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                                    <Area type="monotone" dataKey="health" stroke="#22c55e" fill="url(#healthG)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>

            {/* Recent Activity Feed */}
            <div className="card" style={{ padding: 16 }}>
                <div className="card-header">
                    <div className="card-title">Recent Activity</div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{isLive ? 'LIVE' : 'REAL-TIME'}</span>
                </div>
                <div className="card-body">
                    <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                        {recentEvents.length > 0 ? recentEvents.map(entry => (
                            <div key={entry.id} className="activity-item">
                                <span className={`activity-dot ${entry.team}`}></span>
                                <span className="activity-time" style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                                    {formatTs(entry.timestamp)}
                                </span>
                                <span className="activity-msg">{(entry.message || '').substring(0, 120)}</span>
                            </div>
                        )) : logs.slice(-15).reverse().map(entry => (
                            <div key={entry.id} className="activity-item">
                                <span className={`activity-dot ${entry.team}`}></span>
                                <span className="activity-time">
                                    {isLive ? new Date(entry.timestamp).toLocaleTimeString() : `T${entry.tick}`}
                                </span>
                                <span className="activity-msg">{(entry.log || entry.message || '').substring(0, 120)}</span>
                            </div>
                        ))}
                        {logs.length === 0 && recentEvents.length === 0 && (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20, fontSize: 12 }}>
                                Launch an attack from the Attack Center to see real-time events
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
