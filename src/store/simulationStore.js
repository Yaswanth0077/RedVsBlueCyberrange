// Zustand store for simulation state — supports both Simulation and Live modes

import { create } from 'zustand';
import SimulationOrchestrator from '../engine/SimulationOrchestrator';

// ---- localStorage persistence helpers ----
const STORAGE_KEYS = {
    FIREWALL_RULES: 'rvb_firewall_rules',
    FIREWALL_BLOCKED: 'rvb_firewall_blocked',
    FIREWALL_ENABLED: 'rvb_firewall_enabled',
    SESSION_HISTORY: 'rvb_session_history',
    LAST_SCENARIO: 'rvb_last_scenario',
    SIMULATION_STATE: 'rvb_simulation_state',
    ACTIVE_TAB: 'rvb_active_tab',
    MODE: 'rvb_mode',
    LIVE_DATA: 'rvb_live_data'
};

function loadFromStorage(key, fallback) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : fallback;
    } catch { return fallback; }
}

function saveToStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { }
}

function persistFirewall(state) {
    saveToStorage(STORAGE_KEYS.FIREWALL_RULES, state.firewallRules);
    saveToStorage(STORAGE_KEYS.FIREWALL_BLOCKED, state.firewallBlocked);
    saveToStorage(STORAGE_KEYS.FIREWALL_ENABLED, state.firewallEnabled);
}

function persistSimulationState(simState) {
    if (!simState) return;
    // Save a snapshot — if it was running, mark as paused so it can be viewed on restore
    const snapshot = { ...simState };
    if (snapshot.status === 'running') snapshot.status = 'paused';
    saveToStorage(STORAGE_KEYS.SIMULATION_STATE, snapshot);
}

function persistLiveData(state) {
    saveToStorage(STORAGE_KEYS.LIVE_DATA, {
        liveLogs: state.liveLogs.slice(-200),
        liveTimeline: state.liveTimeline.slice(-200),
        liveScoring: state.liveScoring,
        liveRedTeam: state.liveRedTeam,
        liveBlueTeam: state.liveBlueTeam
    });
}

const useSimulationStore = create((set, get) => {
    const orchestrator = new SimulationOrchestrator((state) => {
        set({ simulation: state });
        persistSimulationState(state);
    });

    // WebSocket references
    let redWs = null;
    let blueWs = null;
    let liveLogId = 0;

    return {
        simulation: null,
        orchestrator,
        activeTab: loadFromStorage(STORAGE_KEYS.ACTIVE_TAB, 'dashboard'),
        logFilter: { team: null, severity: null, search: '' },

        // Mode: 'simulation' or 'live'
        mode: loadFromStorage(STORAGE_KEYS.MODE, 'simulation'),

        // Live mode state
        liveMode: false,
        liveStatus: { red: 'idle', blue: 'idle' }, // idle, connecting, running, error
        liveLogs: [],
        liveTimeline: [],
        liveScoring: {
            redTeamScore: 0, blueTeamScore: 0,
            detectionLatency: { score: 0, raw: 0, samples: 0 },
            responseAccuracy: { score: 100, raw: 1, samples: 0 },
            containmentEffectiveness: { score: 0, raw: 0, samples: 0 },
            recoveryTime: { score: 100, raw: 0, samples: 0 },
            overallBlueScore: 0,
            weights: { detectionLatency: 0.3, responseAccuracy: 0.25, containmentEffectiveness: 0.25, recoveryTime: 0.2 },
            history: { detectionLatency: [], responseAccuracy: [], containmentEffectiveness: [] }
        },
        liveRedTeam: {
            phase: 'idle', compromisedNodes: [], discoveredNodes: [],
            discoveredVulns: 0, totalAttacks: 0, successfulAttacks: 0,
            activeAction: null, queueLength: 0
        },
        liveBlueTeam: {
            totalDetections: 0, openIncidents: 0, resolvedIncidents: 0,
            alerts: [], incidents: [], activeResponses: 0, monitoringLevel: 'standard'
        },

        // Firewall state (loaded from localStorage)
        firewallRules: loadFromStorage(STORAGE_KEYS.FIREWALL_RULES, []),
        firewallBlocked: loadFromStorage(STORAGE_KEYS.FIREWALL_BLOCKED, []),
        firewallEnabled: loadFromStorage(STORAGE_KEYS.FIREWALL_ENABLED, true),

        // Session history (persisted)
        sessionHistory: loadFromStorage(STORAGE_KEYS.SESSION_HISTORY, []),

        // Actions -- Simulation Mode
        loadScenario: (scenarioId) => {
            orchestrator.loadScenario(scenarioId);
            saveToStorage(STORAGE_KEYS.LAST_SCENARIO, scenarioId);
        },
        startSimulation: () => orchestrator.start(),
        pauseSimulation: () => orchestrator.pause(),
        resumeSimulation: () => orchestrator.resume(),
        resetSimulation: () => orchestrator.reset(),
        setSpeed: (speed) => orchestrator.setSpeed(speed),

        // Navigation
        setActiveTab: (tab) => {
            set({ activeTab: tab });
            saveToStorage(STORAGE_KEYS.ACTIVE_TAB, tab);
        },
        setLogFilter: (filter) => set({ logFilter: { ...get().logFilter, ...filter } }),

        // Mode toggle
        setMode: (mode) => {
            set({ mode });
            saveToStorage(STORAGE_KEYS.MODE, mode);
        },

        // ---- Firewall Actions ----
        addFirewallRule: (rule) => {
            set(state => ({ firewallRules: [...state.firewallRules, rule] }));
            persistFirewall(get());
            // In live mode, send command to Blue Agent
            const state = get();
            if (state.mode === 'live' && blueWs && blueWs.readyState === WebSocket.OPEN) {
                const cmd = rule.action === 'Block'
                    ? (rule.port !== '*' ? 'close_port' : 'block_ip')
                    : 'open_port';
                const payload = { type: 'command', data: { command: cmd, ip: rule.ip, port: rule.port, protocol: rule.protocol } };
                blueWs.send(JSON.stringify(payload));
                get()._addLiveLog('system', 'dashboard', `Firewall: ${rule.action} rule sent — IP:${rule.ip} Port:${rule.port}`, 'info');
            }
        },

        removeFirewallRule: (id) => {
            const rule = get().firewallRules.find(r => r.id === id);
            set(state => ({ firewallRules: state.firewallRules.filter(r => r.id !== id) }));
            persistFirewall(get());
            if (rule && get().mode === 'live' && blueWs && blueWs.readyState === WebSocket.OPEN) {
                const cmd = rule.action === 'Block'
                    ? (rule.port !== '*' ? 'open_port' : 'unblock_ip')
                    : 'close_port';
                const payload = { type: 'command', data: { command: cmd, ip: rule.ip, port: rule.port, protocol: rule.protocol } };
                blueWs.send(JSON.stringify(payload));
                get()._addLiveLog('system', 'dashboard', `Firewall: Rule removed — IP:${rule.ip} Port:${rule.port}`, 'info');
            }
        },

        toggleFirewall: () => {
            const newState = !get().firewallEnabled;
            set({ firewallEnabled: newState });
            persistFirewall(get());
            if (get().mode === 'live' && blueWs && blueWs.readyState === WebSocket.OPEN) {
                blueWs.send(JSON.stringify({ type: 'command', data: { command: 'toggle_firewall', enable: newState } }));
                get()._addLiveLog('system', 'dashboard', `Firewall ${newState ? 'enabled' : 'disabled'}`, newState ? 'info' : 'warning');
            }
        },

        clearFirewallRules: () => {
            set({ firewallRules: [], firewallBlocked: [] });
            persistFirewall(get());
        },

        // ---- Session History ----
        saveSession: (label) => {
            const s = get();
            const session = {
                id: Date.now(),
                label: label || `Session ${new Date().toLocaleString()}`,
                timestamp: Date.now(),
                mode: s.mode,
                firewallRules: [...s.firewallRules],
                firewallBlocked: s.firewallBlocked.length,
                scoring: s.mode === 'live' ? { ...s.liveScoring } : (s.simulation?.scoring ? { ...s.simulation.scoring } : null),
                scenarioName: s.simulation?.scenario?.name || (s.mode === 'live' ? 'Live Session' : 'N/A'),
                logCount: s.mode === 'live' ? s.liveLogs.length : (s.simulation?.logs?.length || 0)
            };
            const history = [...get().sessionHistory.slice(-19), session];
            set({ sessionHistory: history });
            saveToStorage(STORAGE_KEYS.SESSION_HISTORY, history);
        },

        restoreSessionRules: (sessionId) => {
            const session = get().sessionHistory.find(s => s.id === sessionId);
            if (session && session.firewallRules) {
                set({ firewallRules: [...session.firewallRules] });
                persistFirewall(get());
            }
        },

        clearSessionHistory: () => {
            set({ sessionHistory: [] });
            saveToStorage(STORAGE_KEYS.SESSION_HISTORY, []);
        },

        // ---- Live Mode Actions ----
        connectRedAgent: (ip, port) => {
            const state = get();
            if (redWs && redWs.readyState === WebSocket.OPEN) return;

            set({ liveStatus: { ...state.liveStatus, red: 'connecting' } });

            try {
                redWs = new WebSocket(`ws://${ip}:${port}`);

                redWs.onopen = () => {
                    set({ liveStatus: { ...get().liveStatus, red: 'running' } });
                    get()._addLiveLog('system', 'orchestrator', `Connected to Red Team Agent at ${ip}:${port}`, 'info');
                };

                redWs.onmessage = (event) => {
                    try {
                        const msg = JSON.parse(event.data);
                        get()._handleRedMessage(msg);
                    } catch { }
                };

                redWs.onclose = () => {
                    set({ liveStatus: { ...get().liveStatus, red: 'idle' } });
                    get()._addLiveLog('system', 'orchestrator', 'Red Team Agent disconnected', 'warning');
                };

                redWs.onerror = () => {
                    set({ liveStatus: { ...get().liveStatus, red: 'error' } });
                    get()._addLiveLog('system', 'orchestrator', `Failed to connect to Red Agent at ${ip}:${port}`, 'error');
                };
            } catch {
                set({ liveStatus: { ...state.liveStatus, red: 'error' } });
            }
        },

        connectBlueAgent: (ip, port) => {
            const state = get();
            if (blueWs && blueWs.readyState === WebSocket.OPEN) return;

            set({ liveStatus: { ...state.liveStatus, blue: 'connecting' } });

            try {
                blueWs = new WebSocket(`ws://${ip}:${port}`);

                blueWs.onopen = () => {
                    set({ liveStatus: { ...get().liveStatus, blue: 'running' } });
                    get()._addLiveLog('system', 'orchestrator', `Connected to Blue Team Agent at ${ip}:${port}`, 'info');
                };

                blueWs.onmessage = (event) => {
                    try {
                        const msg = JSON.parse(event.data);
                        get()._handleBlueMessage(msg);
                    } catch { }
                };

                blueWs.onclose = () => {
                    set({ liveStatus: { ...get().liveStatus, blue: 'idle' } });
                    get()._addLiveLog('system', 'orchestrator', 'Blue Team Agent disconnected', 'warning');
                };

                blueWs.onerror = () => {
                    set({ liveStatus: { ...get().liveStatus, blue: 'error' } });
                    get()._addLiveLog('system', 'orchestrator', `Failed to connect to Blue Agent at ${ip}:${port}`, 'error');
                };
            } catch {
                set({ liveStatus: { ...state.liveStatus, blue: 'error' } });
            }
        },

        disconnectAgents: () => {
            if (redWs) { redWs.close(); redWs = null; }
            if (blueWs) { blueWs.close(); blueWs = null; }
            set({ liveStatus: { red: 'idle', blue: 'idle' } });
        },

        sendRedCommand: (command) => {
            if (redWs && redWs.readyState === WebSocket.OPEN) {
                redWs.send(JSON.stringify({ type: 'command', data: { command } }));
                get()._addLiveLog('system', 'dashboard', `Sent command to Red Agent: ${command}`, 'info');
            }
        },

        sendBlueCommand: (command, extraData = {}) => {
            if (blueWs && blueWs.readyState === WebSocket.OPEN) {
                blueWs.send(JSON.stringify({ type: 'command', data: { command, ...extraData } }));
                get()._addLiveLog('system', 'dashboard', `Sent command to Blue Agent: ${command}`, 'info');
            }
        },

        // ---- Internal: Process messages ----
        _addLiveLog: (team, source, message, severity) => {
            liveLogId++;
            const entry = {
                id: liveLogId,
                tick: Math.floor((Date.now() % 100000000) / 1000),
                timestamp: Date.now(),
                team, source, message, severity
            };

            set(state => {
                const newState = {
                    liveLogs: [...state.liveLogs.slice(-500), entry],
                    liveTimeline: [...state.liveTimeline.slice(-500), {
                        id: entry.id, event: `${team}.${source}`, tick: entry.tick,
                        timestamp: entry.timestamp, team, source, log: message, severity
                    }]
                };
                return newState;
            });
            // Debounced live data persist (persists after each log add)
            persistLiveData(get());
        },

        _handleRedMessage: (msg) => {
            if (msg.type === 'heartbeat') return;

            const severity = msg.severity || 'info';
            get()._addLiveLog('red', msg.source || 'red_agent', msg.message || '', severity);

            // Update red team state
            if (msg.type === 'attack_start') {
                set(state => ({
                    liveRedTeam: {
                        ...state.liveRedTeam,
                        activeAction: msg.data?.action || msg.message,
                        phase: msg.data?.phase || state.liveRedTeam.phase,
                        totalAttacks: state.liveRedTeam.totalAttacks + 1
                    }
                }));
            }

            if (msg.type === 'attack_result') {
                set(state => ({
                    liveRedTeam: {
                        ...state.liveRedTeam,
                        activeAction: null,
                        successfulAttacks: msg.data?.success
                            ? state.liveRedTeam.successfulAttacks + 1
                            : state.liveRedTeam.successfulAttacks
                    },
                    liveScoring: {
                        ...state.liveScoring,
                        redTeamScore: msg.data?.success
                            ? state.liveScoring.redTeamScore + 10
                            : state.liveScoring.redTeamScore
                    }
                }));
            }

            if (msg.type === 'scan_result' && msg.data?.ports) {
                set(state => ({
                    liveRedTeam: {
                        ...state.liveRedTeam,
                        discoveredVulns: state.liveRedTeam.discoveredVulns + (msg.data.vulnCount || 0)
                    }
                }));
            }

            if (msg.type === 'status' && msg.data?.phase) {
                set(state => ({
                    liveRedTeam: { ...state.liveRedTeam, phase: msg.data.phase }
                }));
            }
        },

        _handleBlueMessage: (msg) => {
            if (msg.type === 'heartbeat') return;

            const severity = msg.severity || 'info';
            get()._addLiveLog('blue', msg.source || 'blue_agent', msg.message || '', severity);

            // Update blue team state
            if (msg.type === 'alert') {
                set(state => ({
                    liveBlueTeam: {
                        ...state.liveBlueTeam,
                        totalDetections: state.liveBlueTeam.totalDetections + 1,
                        alerts: [...state.liveBlueTeam.alerts.slice(-100), {
                            id: Date.now(), tick: msg.tick, severity: msg.severity,
                            rule: msg.data?.type || 'alert', message: msg.message
                        }]
                    },
                    liveScoring: {
                        ...state.liveScoring,
                        blueTeamScore: state.liveScoring.blueTeamScore + 5
                    }
                }));
            }

            if (msg.type === 'firewall_event') {
                set(state => ({
                    liveScoring: {
                        ...state.liveScoring,
                        blueTeamScore: state.liveScoring.blueTeamScore + 3
                    }
                }));

                // Track blocked traffic in firewall feed
                if (msg.data?.action === 'block' || msg.message?.includes('BLOCK')) {
                    set(state => ({
                        firewallBlocked: [...state.firewallBlocked.slice(-200), {
                            id: Date.now() + Math.random(),
                            timestamp: msg.timestamp || Date.now(),
                            sourceIP: msg.data?.ip || msg.data?.remoteIP || 'unknown',
                            port: msg.data?.port || '—',
                            protocol: msg.data?.protocol || 'TCP',
                            reason: msg.message || 'Firewall block'
                        }]
                    }));
                }
            }

            if (msg.type === 'firewall_block') {
                set(state => ({
                    firewallBlocked: [...state.firewallBlocked.slice(-200), {
                        id: Date.now() + Math.random(),
                        timestamp: msg.timestamp || Date.now(),
                        sourceIP: msg.data?.sourceIP || msg.data?.ip || 'unknown',
                        port: msg.data?.port || '—',
                        protocol: msg.data?.protocol || 'TCP',
                        reason: msg.message || 'Firewall rule match'
                    }],
                    liveScoring: {
                        ...state.liveScoring,
                        blueTeamScore: state.liveScoring.blueTeamScore + 2
                    }
                }));
            }

            if (msg.type === 'service_status') {
                // Update stats from periodic reports
            }
        },

        // Clear live data
        clearLiveData: () => {
            liveLogId = 0;
            set({
                liveLogs: [], liveTimeline: [],
                liveScoring: {
                    redTeamScore: 0, blueTeamScore: 0,
                    detectionLatency: { score: 0, raw: 0, samples: 0 },
                    responseAccuracy: { score: 100, raw: 1, samples: 0 },
                    containmentEffectiveness: { score: 0, raw: 0, samples: 0 },
                    recoveryTime: { score: 100, raw: 0, samples: 0 },
                    overallBlueScore: 0,
                    weights: { detectionLatency: 0.3, responseAccuracy: 0.25, containmentEffectiveness: 0.25, recoveryTime: 0.2 },
                    history: { detectionLatency: [], responseAccuracy: [], containmentEffectiveness: [] }
                },
                liveRedTeam: {
                    phase: 'idle', compromisedNodes: [], discoveredNodes: [],
                    discoveredVulns: 0, totalAttacks: 0, successfulAttacks: 0,
                    activeAction: null, queueLength: 0
                },
                liveBlueTeam: {
                    totalDetections: 0, openIncidents: 0, resolvedIncidents: 0,
                    alerts: [], incidents: [], activeResponses: 0, monitoringLevel: 'standard'
                }
            });
        }
    };
});

// ---- Auto-restore on startup ----
(function restoreState() {
    const state = useSimulationStore.getState();

    // Restore last scenario (loads topology, scoring weights, etc.)
    const lastScenario = loadFromStorage(STORAGE_KEYS.LAST_SCENARIO, null);
    if (lastScenario) {
        state.loadScenario(lastScenario);
    }

    // Overlay the saved simulation snapshot (preserves logs, timeline, scores, tick, etc.)
    const savedSim = loadFromStorage(STORAGE_KEYS.SIMULATION_STATE, null);
    if (savedSim) {
        useSimulationStore.setState({ simulation: savedSim });
    }

    // Restore live data
    const savedLive = loadFromStorage(STORAGE_KEYS.LIVE_DATA, null);
    if (savedLive) {
        useSimulationStore.setState({
            liveLogs: savedLive.liveLogs || [],
            liveTimeline: savedLive.liveTimeline || [],
            liveScoring: savedLive.liveScoring || useSimulationStore.getState().liveScoring,
            liveRedTeam: savedLive.liveRedTeam || useSimulationStore.getState().liveRedTeam,
            liveBlueTeam: savedLive.liveBlueTeam || useSimulationStore.getState().liveBlueTeam
        });
    }
})();

export default useSimulationStore;
