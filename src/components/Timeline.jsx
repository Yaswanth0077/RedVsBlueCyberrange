import React, { useMemo, useEffect, useState } from 'react';
import useSimulationStore from '../store/simulationStore';

function formatTimestamp(ts) {
    const d = new Date(ts);
    return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

const SEV_COLORS = {
    critical: '#ef4444', error: '#ef4444', High: '#f97316',
    warning: '#eab308', Medium: '#eab308', info: '#3b82f6', Low: '#22c55e'
};

const EVENT_ICONS = {
    attack_start: '⚔️', attack_success: '💥', attack_blocked: '🛡️', attack_cancel: '⏹️',
    detection: '🔍', mitigation: '⚡', firewall_block: '🔥', health_update: '✅',
    recovery: '🔄'
};

function Timeline() {
    const { simulation, mode, liveTimeline, backendTimeline } = useSimulationStore();
    const [historicalLogs, setHistoricalLogs] = useState([]);

    const isLive = mode === 'live';

    // Load historical logs from backend on mount
    useEffect(() => {
        fetch('/api/logs?limit=50')
            .then(r => r.ok ? r.json() : [])
            .then(data => {
                if (Array.isArray(data)) {
                    setHistoricalLogs(data.map(l => ({
                        id: l.id, team: 'red', type: 'attack_result',
                        severity: l.impactLevel === 'Critical' ? 'critical' : 'info',
                        message: `${l.attackName}: ${l.result} (Health: ${l.systemHealthBefore}% → ${l.systemHealthAfter ?? '?'}%)`,
                        timestamp: l.timestamp, attackName: l.attackName
                    })));
                }
            }).catch(() => { });
    }, []);

    // Merge all timeline sources
    const timeline = useMemo(() => {
        const backend = backendTimeline || [];
        const live = isLive ? liveTimeline : (simulation?.timeline || []);
        const historical = historicalLogs;

        // Combine and deduplicate by id, then sort chronologically
        const all = [...historical, ...live.map(e => ({
            ...e, timestamp: e.timestamp || Date.now()
        })), ...backend];

        const seen = new Set();
        const unique = all.filter(e => {
            if (seen.has(e.id)) return false;
            seen.add(e.id);
            return true;
        });

        return unique.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    }, [backendTimeline, liveTimeline, simulation?.timeline, isLive, historicalLogs]);

    if (!timeline.length) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon" style={{ fontSize: 48, opacity: 0.4 }}>--:--</div>
                <div className="empty-state-title">No Timeline Events</div>
                <div className="empty-state-desc">
                    Launch attacks from the Attack Center to see the live attack-defense timeline.
                </div>
            </div>
        );
    }

    const redEvents = timeline.filter(e => e.team === 'red');
    const blueEvents = timeline.filter(e => e.team === 'blue');
    const systemEvents = timeline.filter(e => e.team === 'system');

    return (
        <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 4 }}>
                Attack-Defense Timeline
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                Chronological event log with timestamps • {timeline.length} events
            </p>

            <div className="timeline-container">
                {/* System Events */}
                <div className="timeline-lane">
                    <div className="timeline-lane-label" style={{ color: 'var(--text-muted)' }}>SYSTEM</div>
                    <div className="timeline-events">
                        {systemEvents.slice(-10).map(e => (
                            <div key={e.id} className="timeline-event system" title={e.log || e.message}>
                                <span className="timeline-tick" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#888' }}>
                                    {formatTimestamp(e.timestamp)}
                                </span>
                                <span style={{ marginLeft: 8 }}>{(e.log || e.message || '').substring(0, 80)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Red Team Lane */}
                <div className="timeline-lane" style={{ marginTop: 14 }}>
                    <div className="timeline-lane-label red">RED TEAM — ATTACK OPERATIONS ({redEvents.length})</div>
                    <div className="timeline-events" style={{ borderLeft: '2px solid var(--red-border)' }}>
                        {redEvents.length === 0 ? (
                            <div style={{ padding: 8, fontSize: 11, color: 'var(--text-muted)' }}>No attack events yet...</div>
                        ) : (
                            redEvents.slice(-30).map(e => (
                                <div key={e.id} className={`timeline-event red`} style={{ borderLeft: `3px solid ${SEV_COLORS[e.severity] || '#888'}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#888', minWidth: 160 }}>
                                            {formatTimestamp(e.timestamp)}
                                        </span>
                                        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: `${SEV_COLORS[e.severity] || '#888'}22`, color: SEV_COLORS[e.severity] || '#888', fontWeight: 700 }}>
                                            {e.severity?.toUpperCase() || 'INFO'}
                                        </span>
                                    </div>
                                    <div style={{ marginTop: 3, fontSize: 12 }}>
                                        {EVENT_ICONS[e.type] || '•'} {(e.log || e.message || '').substring(0, 100)}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Blue Team Lane */}
                <div className="timeline-lane">
                    <div className="timeline-lane-label blue">BLUE TEAM — DEFENSE OPERATIONS ({blueEvents.length})</div>
                    <div className="timeline-events" style={{ borderLeft: '2px solid var(--blue-border)' }}>
                        {blueEvents.length === 0 ? (
                            <div style={{ padding: 8, fontSize: 11, color: 'var(--text-muted)' }}>No defense events yet...</div>
                        ) : (
                            blueEvents.slice(-30).map(e => (
                                <div key={e.id} className={`timeline-event blue`} style={{ borderLeft: `3px solid ${SEV_COLORS[e.severity] || '#3b82f6'}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#888', minWidth: 160 }}>
                                            {formatTimestamp(e.timestamp)}
                                        </span>
                                        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: `${SEV_COLORS[e.severity] || '#3b82f6'}22`, color: SEV_COLORS[e.severity] || '#3b82f6', fontWeight: 700 }}>
                                            {e.severity?.toUpperCase() || 'INFO'}
                                        </span>
                                    </div>
                                    <div style={{ marginTop: 3, fontSize: 12 }}>
                                        {EVENT_ICONS[e.type] || '🛡️'} {(e.log || e.message || '').substring(0, 100)}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Timeline;
