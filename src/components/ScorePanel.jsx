import React, { useMemo, useEffect, useState } from 'react';
import useSimulationStore from '../store/simulationStore';
import {
    RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
    LineChart, Line, CartesianGrid, Cell, AreaChart, Area
} from 'recharts';

const TOOLTIP_STYLE = { background: '#1a2332', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, fontSize: 11 };

function ScorePanel() {
    const { simulation, backendScores, backendMetrics, backendReport, systemHealth } = useSimulationStore();
    const [liveScoreHistory, setLiveScoreHistory] = useState([]);

    // Subscribe to score updates for live trend
    useEffect(() => {
        if (backendScores?.history) {
            setLiveScoreHistory(backendScores.history.slice(-30));
        }
    }, [backendScores]);

    // Determine scoring data source: backend OR simulation
    const hasBackendData = backendScores && (backendScores.red > 0 || backendScores.blue > 0);
    const simScoring = simulation?.scoring;
    const hasSimData = !!(simScoring && simulation?.scenario);

    if (!hasBackendData && !hasSimData) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon" style={{ fontSize: 32, opacity: 0.4, fontWeight: 800 }}>SCR</div>
                <div className="empty-state-title">Scoring Analytics</div>
                <div className="empty-state-desc">Start a simulation or launch attacks from the Attack Center to see live scoring.</div>
            </div>
        );
    }

    // Backend-powered scoring
    const redScore = hasBackendData ? backendScores.red : (simScoring?.redTeamScore || 0);
    const blueScore = hasBackendData ? backendScores.blue : (simScoring?.blueTeamScore || 0);
    const totalAttacks = backendMetrics?.totalAttacks || simulation?.redTeam?.totalAttacks || 0;
    const successfulAttacks = backendMetrics?.successfulAttacks || simulation?.redTeam?.successfulAttacks || 0;
    const detections = backendMetrics?.totalDetections || simulation?.blueTeam?.totalDetections || 0;
    const blocked = backendMetrics?.blockedAttacks || 0;
    const health = systemHealth ?? backendMetrics?.avgSystemHealth ?? 100;

    // Compute dynamic defense score
    const detectionRate = totalAttacks > 0 ? Math.round((detections / totalAttacks) * 100) : 0;
    const blockRate = totalAttacks > 0 ? Math.round((blocked / totalAttacks) * 100) : 0;
    const overallDefense = hasSimData ? simScoring.overallBlueScore : Math.round((detectionRate * 0.4 + blockRate * 0.3 + health * 0.3));

    const comparisonData = [
        { name: 'Red Team', score: redScore, fill: '#ef4444' },
        { name: 'Blue Team', score: blueScore, fill: '#3b82f6' }
    ];

    const radarData = hasSimData ? [
        { metric: 'Detection', score: simScoring.detectionLatency.score, fullMark: 100 },
        { metric: 'Accuracy', score: simScoring.responseAccuracy.score, fullMark: 100 },
        { metric: 'Containment', score: simScoring.containmentEffectiveness.score, fullMark: 100 },
        { metric: 'Recovery', score: simScoring.recoveryTime.score, fullMark: 100 }
    ] : [
        { metric: 'Detection', score: detectionRate, fullMark: 100 },
        { metric: 'Block Rate', score: blockRate, fullMark: 100 },
        { metric: 'Health', score: health, fullMark: 100 },
        { metric: 'Score Lead', score: Math.min(100, Math.max(0, blueScore - redScore + 50)), fullMark: 100 }
    ];

    // Score trend chart
    const trendData = liveScoreHistory.map((h, i) => ({
        idx: i + 1, red: h.red, blue: h.blue,
        time: new Date(h.timestamp).toLocaleTimeString()
    }));

    const metricColor = (score) => score >= 75 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444';

    return (
        <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 4 }}>
                🏆 Live Scoring & Analytics
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                Dynamic scoring • Updates in real-time after each attack • Persisted to database
            </p>

            {/* Overall Defense Score */}
            <div className="card" style={{ marginBottom: 16, padding: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                    Overall Defense Score
                </div>
                <div style={{ fontSize: 64, fontWeight: 900, color: metricColor(overallDefense), lineHeight: 1.2, marginTop: 4 }}>
                    {overallDefense}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>out of 100</div>
                <div className="progress-bar-container" style={{ maxWidth: 400, margin: '12px auto 0', height: 6 }}>
                    <div className="progress-bar-fill blue" style={{ width: `${overallDefense}%`, background: metricColor(overallDefense) }}></div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="stat-grid" style={{ marginBottom: 16 }}>
                <div className="stat-card red">
                    <div className="stat-label">Red Team Score</div>
                    <div className="stat-value">{redScore}</div>
                    <div className="stat-detail">{successfulAttacks}/{totalAttacks} successful</div>
                </div>
                <div className="stat-card blue">
                    <div className="stat-label">Blue Team Score</div>
                    <div className="stat-value">{blueScore}</div>
                    <div className="stat-detail">{detections} detections, {blocked} blocked</div>
                </div>
                <div className="stat-card" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
                    <div className="stat-label">Detection Rate</div>
                    <div className="stat-value">{detectionRate}%</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">System Health</div>
                    <div className="stat-value" style={{ color: metricColor(health) }}>{Math.round(health)}%</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                {/* Radar Chart */}
                <div className="card" style={{ padding: 16 }}>
                    <div className="card-header"><div className="card-title">Defense Capability Radar</div></div>
                    <div className="card-body">
                        <ResponsiveContainer width="100%" height={220}>
                            <RadarChart data={radarData}>
                                <PolarGrid stroke="rgba(99,102,241,0.15)" />
                                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: '#aaa' }} />
                                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 8, fill: '#888' }} />
                                <Radar dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Team Comparison */}
                <div className="card" style={{ padding: 16 }}>
                    <div className="card-header"><div className="card-title">Team Score Comparison</div></div>
                    <div className="card-body">
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={comparisonData} barSize={60}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#aaa' }} />
                                <YAxis tick={{ fontSize: 9, fill: '#888' }} />
                                <Tooltip contentStyle={TOOLTIP_STYLE} />
                                <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                                    {comparisonData.map((entry, i) => (
                                        <Cell key={i} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Score Trend Over Time */}
            {trendData.length > 2 && (
                <div className="card" style={{ padding: 16, marginBottom: 16 }}>
                    <div className="card-header"><div className="card-title">Score Trend (Live)</div></div>
                    <div className="card-body">
                        <ResponsiveContainer width="100%" height={180}>
                            <AreaChart data={trendData}>
                                <defs>
                                    <linearGradient id="rsg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} /><stop offset="100%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
                                    <linearGradient id="bsg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#888' }} />
                                <YAxis tick={{ fontSize: 9, fill: '#888' }} />
                                <Tooltip contentStyle={TOOLTIP_STYLE} />
                                <Area type="monotone" dataKey="red" stroke="#ef4444" fill="url(#rsg)" strokeWidth={2} name="Red Team" />
                                <Area type="monotone" dataKey="blue" stroke="#3b82f6" fill="url(#bsg)" strokeWidth={2} name="Blue Team" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Scoring Rules */}
            <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-bright)', marginBottom: 10 }}>Scoring Rules</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 11, color: 'var(--text-secondary)' }}>
                    <div>
                        <div style={{ fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>Red Team</div>
                        <div>+10 per successful attack</div>
                        <div>+3 per undetected attack</div>
                        <div>+2 per attack launched</div>
                        <div>-2 if attack blocked</div>
                        <div>-1 if attack cancelled</div>
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, color: '#3b82f6', marginBottom: 6 }}>Blue Team</div>
                        <div>+8 per IDS detection</div>
                        <div>+5 per attack blocked</div>
                        <div>+3 per IP blocked</div>
                        <div>+2× per mitigation action</div>
                        <div>-3 if breach occurs</div>
                        <div>-1 if attack undetected</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ScorePanel;
