import React, { useRef, useEffect, useMemo, useState } from 'react';
import useSimulationStore from '../store/simulationStore';

function formatTimestamp(ts) {
    const d = new Date(ts);
    return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

function LogViewer() {
    const {
        simulation, logFilter, setLogFilter, mode, liveLogs, backendTimeline, backendLogs
    } = useSimulationStore();

    const isLive = mode === 'live';
    const [historicalLogs, setHistoricalLogs] = useState([]);

    // Fetch historical logs from backend on mount
    useEffect(() => {
        fetch('/api/logs?limit=100')
            .then(r => r.ok ? r.json() : [])
            .then(data => {
                if (Array.isArray(data)) {
                    setHistoricalLogs(data.map(l => ({
                        id: l.id,
                        team: 'red',
                        source: 'attack_engine',
                        severity: l.impactLevel === 'Critical' ? 'critical' : l.impactLevel === 'High' ? 'warning' : 'info',
                        log: `[${l.attackName}] ${l.result || 'Running'} | Health: ${l.systemHealthBefore}% → ${l.systemHealthAfter ?? '?'}% | Detected: ${l.detected ? 'Yes' : 'No'}`,
                        message: `[${l.attackName}] ${l.result || 'Running'}`,
                        timestamp: l.timestamp,
                        tick: 0
                    })));
                }
            }).catch(() => { });
    }, []);

    // Merge all log sources: historical DB logs + live backend timeline + sim/live logs
    const allLogs = useMemo(() => {
        const simLogs = isLive ? liveLogs : (simulation?.logs || []);
        const backend = (backendTimeline || []).map(e => ({
            id: e.id,
            team: e.team || 'system',
            source: e.type || 'backend',
            severity: e.severity || 'info',
            log: e.message,
            message: e.message,
            timestamp: e.timestamp,
            tick: 0
        }));

        // Combine and deduplicate
        const all = [...historicalLogs, ...simLogs, ...backend];
        const seen = new Set();
        const unique = all.filter(e => {
            if (!e.id) return true;
            if (seen.has(e.id)) return false;
            seen.add(e.id);
            return true;
        });

        return unique.sort((a, b) => (a.timestamp || a.tick || 0) - (b.timestamp || b.tick || 0));
    }, [isLive, liveLogs, simulation?.logs, backendTimeline, historicalLogs]);

    const logEndRef = useRef(null);
    const autoScrollRef = useRef(true);

    const filteredLogs = useMemo(() => {
        return allLogs.filter(entry => {
            if (logFilter.team && entry.team !== logFilter.team) return false;
            if (logFilter.severity && entry.severity !== logFilter.severity) return false;
            if (logFilter.search) {
                const text = (entry.log || entry.message || '').toLowerCase();
                if (!text.includes(logFilter.search.toLowerCase())) return false;
            }
            return true;
        });
    }, [allLogs, logFilter]);

    useEffect(() => {
        if (autoScrollRef.current && logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [filteredLogs]);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 4 }}>
                        {isLive ? 'Live SIEM Feed' : 'SIEM Log Viewer'}
                    </h2>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {filteredLogs.length} / {allLogs.length} events
                        {historicalLogs.length > 0 ? ` (${historicalLogs.length} from DB)` : ''}
                        {isLive ? ' • real-time' : ''}
                    </p>
                </div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                        type="checkbox" defaultChecked
                        onChange={e => { autoScrollRef.current = e.target.checked; }}
                    />
                    Auto-scroll
                </label>
            </div>

            {/* Filters */}
            <div className="log-filters">
                <input
                    className="log-search"
                    placeholder="Search logs..."
                    value={logFilter.search}
                    onChange={e => setLogFilter({ search: e.target.value })}
                />
                <button
                    className={`log-filter-btn ${logFilter.team === 'red' ? 'active' : ''}`}
                    onClick={() => setLogFilter({ team: logFilter.team === 'red' ? null : 'red' })}
                    style={{ borderColor: logFilter.team === 'red' ? 'var(--red-border)' : undefined }}
                >Red Team</button>
                <button
                    className={`log-filter-btn ${logFilter.team === 'blue' ? 'active' : ''}`}
                    onClick={() => setLogFilter({ team: logFilter.team === 'blue' ? null : 'blue' })}
                    style={{ borderColor: logFilter.team === 'blue' ? 'var(--blue-border)' : undefined }}
                >Blue Team</button>
                <button
                    className={`log-filter-btn ${logFilter.team === 'system' ? 'active' : ''}`}
                    onClick={() => setLogFilter({ team: logFilter.team === 'system' ? null : 'system' })}
                >System</button>

                <div style={{ width: 1, height: 20, background: 'var(--border-color)' }} />

                {['critical', 'warning', 'info'].map(sev => (
                    <button key={sev}
                        className={`log-filter-btn ${logFilter.severity === sev ? 'active' : ''}`}
                        onClick={() => setLogFilter({ severity: logFilter.severity === sev ? null : sev })}
                    >
                        {sev === 'critical' ? '[!]' : sev === 'warning' ? '[~]' : '[i]'} {sev}
                    </button>
                ))}

                <button
                    className="log-filter-btn"
                    style={{ marginLeft: 'auto' }}
                    onClick={() => setLogFilter({ team: null, severity: null, search: '' })}
                >Clear</button>
            </div>

            {/* Log Entries */}
            <div className="log-container">
                {filteredLogs.map(entry => (
                    <div key={entry.id} className={`log-entry ${entry.severity}`}>
                        <span className="log-timestamp" style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                            {entry.timestamp
                                ? formatTimestamp(entry.timestamp)
                                : `T${String(entry.tick).padStart(4, '0')}`}
                        </span>
                        <span className={`log-severity ${entry.severity}`}>
                            {entry.severity?.toUpperCase()?.substring(0, 4)}
                        </span>
                        <span className={`log-source ${entry.team}`}>
                            [{(entry.source || entry.team || '').toUpperCase()}]
                        </span>
                        <span className="log-message">{entry.log || entry.message || ''}</span>
                    </div>
                ))}
                <div ref={logEndRef} />
                {filteredLogs.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 12 }}>
                        {allLogs.length === 0
                            ? 'No log events yet. Launch attacks from the Attack Center to see logs here.'
                            : 'No log entries match current filters'}
                    </div>
                )}
            </div>
        </div>
    );
}

export default LogViewer;
