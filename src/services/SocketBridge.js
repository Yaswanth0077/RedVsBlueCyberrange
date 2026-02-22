// SocketBridge — connects the Express backend's socket.io events into the Zustand store
// This file sets up a singleton socket connection and dispatches all events

import { io as socketIOClient } from 'socket.io-client';

const SERVER = '';
let socket = null;
let storeRef = null;
let tlId = 0;

function pushTimeline(useStore, team, severity, message, extra = {}) {
    tlId++;
    useStore.setState(state => ({
        backendTimeline: [...(state.backendTimeline || []).slice(-300), {
            id: `tl_${Date.now()}_${tlId}`,
            team, severity, message, timestamp: Date.now(), ...extra
        }]
    }));
}

export function initSocketBridge(useStore) {
    if (socket) return socket;
    storeRef = useStore;

    socket = socketIOClient(SERVER, { autoConnect: true, reconnection: true, reconnectionDelay: 2000 });

    socket.on('connect', () => {
        console.log('[SocketBridge] Connected to backend');
        useStore.setState({ backendConnected: true });
        pushTimeline(useStore, 'system', 'info', 'Connected to backend server');
    });

    socket.on('disconnect', () => {
        console.log('[SocketBridge] Disconnected from backend');
        useStore.setState({ backendConnected: false });
    });

    // ---- Initial state from backend ----
    socket.on('initial_state', (data) => {
        useStore.setState({
            backendScores: data.scores || { red: 0, blue: 0, history: [] },
            backendReport: data.report || null,
            backendMetrics: data.metrics || null,
            backendLogs: data.recentLogs || []
        });
    });

    // ---- Real-time score updates ----
    socket.on('scores_update', (scores) => {
        useStore.setState({ backendScores: scores });
    });

    // ---- Report auto-regeneration ----
    socket.on('report_update', (report) => {
        useStore.setState({ backendReport: report });
    });

    // ---- Timeline events (from backend timeline_event emit) ----
    socket.on('timeline_event', (event) => {
        pushTimeline(useStore, event.team || 'system', event.severity || 'info', event.message, { type: event.type, attackName: event.attackName });
    });

    // ---- Network map events ----
    socket.on('network_event', (event) => {
        useStore.setState(state => ({
            networkEvents: [...(state.networkEvents || []).slice(-50), event]
        }));
    });

    // ---- System health + metrics ----
    socket.on('system_metrics_update', (data) => {
        useStore.setState(state => {
            const update = {};
            if (data.systemHealth != null) update.systemHealth = data.systemHealth;
            if (data.healthRestored) update.healthRestoring = true;
            if (data.impact) {
                update.cpuImpact = (state.cpuImpact || 0) + (data.impact.cpu || 0);
                update.memImpact = (state.memImpact || 0) + (data.impact.memory || 0);
            }
            return update;
        });
    });

    // ---- Attack lifecycle events -> graph data AND timeline ----
    socket.on('attack_started', (data) => {
        // Push to graph
        useStore.setState(state => ({
            attackGraphData: [...(state.attackGraphData || []).slice(-100), {
                time: new Date().toLocaleTimeString(), type: 'start', name: data.name,
                attacks: (state.attackGraphData?.length || 0) + 1, blocked: state.blockedCount || 0
            }]
        }));
        // Push to timeline/logs
        pushTimeline(useStore, 'red', 'warning', `⚔️ Attack Started: ${data.name} (${data.impactLevel || 'Unknown'} impact, ${Math.round(data.duration / 1000)}s)`, { type: 'attack_start', attackName: data.name });
        // Push execution logs
        if (data.logs && Array.isArray(data.logs)) {
            data.logs.forEach((log, i) => {
                setTimeout(() => {
                    pushTimeline(useStore, 'red', 'info', `  ↳ ${log}`, { type: 'attack_log', attackName: data.name });
                }, (i + 1) * 400);
            });
        }
    });

    socket.on('attack_progress', (data) => {
        // Update progress in store (for AttackControlPanel)
        useStore.setState(state => ({
            attackProgress: { ...(state.attackProgress || {}), [data.attackId]: data.progress }
        }));
    });

    socket.on('attack_completed', (data) => {
        const isBlocked = data.result !== 'Success';
        // Push to graph
        useStore.setState(state => ({
            attackGraphData: [...(state.attackGraphData || []).slice(-100), {
                time: new Date().toLocaleTimeString(), type: data.result.toLowerCase(),
                name: data.name, attacks: state.attackGraphData?.length || 0,
                blocked: (state.blockedCount || 0) + (isBlocked ? 1 : 0),
                success: (state.successCount || 0) + (isBlocked ? 0 : 1)
            }],
            blockedCount: (state.blockedCount || 0) + (isBlocked ? 1 : 0),
            successCount: (state.successCount || 0) + (isBlocked ? 0 : 1)
        }));
        // Push to timeline/logs
        pushTimeline(useStore, 'red', isBlocked ? 'info' : 'critical',
            isBlocked ? `🛡️ Attack BLOCKED: ${data.name} (${data.effectiveProbability}% chance)` : `💥 BREACH: ${data.name} SUCCEEDED (${data.effectiveProbability}% chance)`,
            { type: isBlocked ? 'attack_blocked' : 'attack_success', attackName: data.name }
        );
    });

    socket.on('attack_stopped', (data) => {
        pushTimeline(useStore, 'red', 'info', `⏹️ Attack Cancelled: ${data.name}`, { type: 'attack_cancel', attackName: data.name });
    });

    // ---- Blue team alerts -> graph data AND timeline ----
    socket.on('blue_team_alert', (data) => {
        // Push to defense graph
        useStore.setState(state => ({
            defenseGraphData: [...(state.defenseGraphData || []).slice(-100), {
                time: new Date().toLocaleTimeString(), type: data.type,
                severity: data.severity, threatScore: data.threatScore || 0
            }]
        }));
        // Push to timeline/logs
        pushTimeline(useStore, 'blue', data.severity === 'critical' ? 'critical' : data.severity === 'High' ? 'warning' : 'info',
            data.message,
            { type: data.type, attackName: data.attackName, sourceIP: data.sourceIP }
        );
    });

    return socket;
}

export function getSocket() { return socket; }

export function disconnectSocket() {
    if (socket) { socket.disconnect(); socket = null; }
}
