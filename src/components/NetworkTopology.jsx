import React, { useMemo, useRef, useState, useCallback } from 'react';
import useSimulationStore from '../store/simulationStore';

const NODE_ICONS = {
    router: 'RT',
    firewall: 'FW',
    server: 'SV',
    workstation: 'WS',
    database: 'DB',
    wireless_ap: 'AP'
};

function NetworkTopology() {
    const { simulation, mode, firewallRules, addFirewallRule, liveStatus, networkEvents } = useSimulationStore();
    const svgRef = useRef(null);
    const [selectedNode, setSelectedNode] = useState(null);
    const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });

    const isLive = mode === 'live';

    // Build a set of blocked IPs from firewall rules
    const blockedIPs = useMemo(() => {
        const ips = new Set();
        firewallRules.filter(r => r.action === 'Block').forEach(r => {
            if (r.ip && r.ip !== '*') ips.add(r.ip);
        });
        return ips;
    }, [firewallRules]);

    // Live attack status from backend network events
    const liveNodeStatus = useMemo(() => {
        const status = {}; // nodeStatus: 'under_attack' | 'compromised' | 'defended' | 'stable'
        if (!networkEvents || networkEvents.length === 0) return status;
        // Take the last 10 events and build current status
        networkEvents.slice(-10).forEach(evt => {
            const key = evt.attackName || 'system';
            if (evt.nodeStatus) status[key] = evt.nodeStatus;
        });
        // Determine overall network state
        const vals = Object.values(status);
        status._hasActiveAttack = vals.includes('under_attack') || vals.includes('compromised');
        status._hasDefense = vals.includes('defended');
        status._isRecovering = vals.includes('stable');
        return status;
    }, [networkEvents]);

    // For live mode, generate a basic topology from connected agents
    const liveTopology = useMemo(() => {
        if (!isLive) return null;
        const nodes = [
            { id: 'dashboard', name: 'Dashboard (Host)', type: 'workstation', ip: '192.168.56.1', status: 'online', compromised: false, isolated: false, services: [{ name: 'HTTP', port: 3001 }], vulnerabilities: [] },
            { id: 'kali', name: 'Kali (Red Team)', type: 'server', ip: '192.168.56.101', status: 'online', compromised: liveStatus.red === 'running', isolated: false, services: [{ name: 'Agent', port: 4001 }], vulnerabilities: [] },
            { id: 'ubuntu', name: 'Ubuntu (Blue Team)', type: 'server', ip: '192.168.56.102', status: 'online', compromised: false, isolated: false, services: [{ name: 'SSH', port: 22 }, { name: 'HTTP', port: 80 }, { name: 'Agent', port: 4002 }], vulnerabilities: [] },
            { id: 'fw-host', name: 'Host-Only Network', type: 'firewall', ip: '192.168.56.0/24', status: 'online', compromised: false, isolated: false, services: [], vulnerabilities: [] }
        ];
        const connections = [
            ['dashboard', 'fw-host'], ['fw-host', 'kali'], ['fw-host', 'ubuntu'], ['kali', 'ubuntu']
        ];
        return { nodes, connections };
    }, [isLive, liveStatus]);

    const topology = isLive ? liveTopology : simulation?.topology;

    if (!topology) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon" style={{ fontSize: 32, opacity: 0.4, fontWeight: 800 }}>NET</div>
                <div className="empty-state-title">No Network Topology</div>
                <div className="empty-state-desc">
                    {isLive ? 'Connect to agents in Live Mode to see the network topology.' : 'Load a scenario to visualize the network topology.'}
                </div>
            </div>
        );
    }

    const { nodes, connections } = topology;

    // Simple force-directed layout calculation
    const layout = useMemo(() => {
        const width = 900;
        const height = 380;
        const positions = {};

        const layers = {};
        const visited = new Set();
        const adj = {};

        nodes.forEach(n => { adj[n.id] = []; });
        connections.forEach(([a, b]) => {
            if (adj[a]) adj[a].push(b);
            if (adj[b]) adj[b].push(a);
        });

        const queue = [nodes[0]?.id];
        visited.add(nodes[0]?.id);
        let layer = 0;
        while (queue.length > 0) {
            const layerSize = queue.length;
            layers[layer] = [];
            for (let i = 0; i < layerSize; i++) {
                const nodeId = queue.shift();
                layers[layer].push(nodeId);
                (adj[nodeId] || []).forEach(neighbor => {
                    if (!visited.has(neighbor)) {
                        visited.add(neighbor);
                        queue.push(neighbor);
                    }
                });
            }
            layer++;
        }

        nodes.forEach(n => {
            if (!visited.has(n.id)) {
                if (!layers[layer]) layers[layer] = [];
                layers[layer].push(n.id);
            }
        });

        const totalLayers = Object.keys(layers).length;
        Object.entries(layers).forEach(([l, nodeIds]) => {
            const ly = parseInt(l);
            const y = 50 + (ly / Math.max(1, totalLayers - 1)) * (height - 100);
            nodeIds.forEach((id, i) => {
                const x = 80 + (i / Math.max(1, nodeIds.length - 1)) * (width - 160);
                positions[id] = {
                    x: nodeIds.length === 1 ? width / 2 : x,
                    y
                };
            });
        });

        return { positions, width, height };
    }, [nodes, connections]);

    const { positions, width, height } = layout;
    const compromisedCount = nodes.filter(n => n.compromised).length;
    const isolatedCount = nodes.filter(n => n.isolated).length;
    const shieldedCount = nodes.filter(n => blockedIPs.has(n.ip)).length;

    const handleNodeClick = useCallback((node, e) => {
        const svgEl = svgRef.current;
        if (svgEl) {
            const rect = svgEl.getBoundingClientRect();
            const pos = positions[node.id];
            const scaleX = rect.width / width;
            const scaleY = rect.height / height;
            setPopoverPos({
                x: rect.left + pos.x * scaleX,
                y: rect.top + pos.y * scaleY - 10
            });
        }
        setSelectedNode(selectedNode?.id === node.id ? null : node);
    }, [selectedNode, positions, width, height]);

    const handleBlockIP = useCallback((ip) => {
        addFirewallRule({
            id: Date.now(),
            ip: ip,
            port: '*',
            protocol: 'TCP',
            direction: 'Inbound',
            action: 'Block',
            createdAt: Date.now()
        });
        setSelectedNode(null);
    }, [addFirewallRule]);

    const isBlocked = (ip) => blockedIPs.has(ip);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 4 }}>
                        Network Topology
                    </h2>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {nodes.length} nodes | {connections.length} connections | {compromisedCount} compromised | {isolatedCount} isolated | {shieldedCount} shielded
                    </p>
                </div>
                {isLive && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-emerald)', background: 'rgba(16,185,129,0.1)', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(16,185,129,0.25)' }}>
                        LIVE
                    </span>
                )}
            </div>

            <div className="card" style={{ position: 'relative' }}>
                <div className="card-body-flush">
                    <div className="topology-container">
                        <svg className="topology-svg" viewBox={`0 0 ${width} ${height}`} ref={svgRef}>
                            {/* Grid background */}
                            <defs>
                                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(99,102,241,0.05)" strokeWidth="0.5" />
                                </pattern>
                            </defs>
                            <rect width={width} height={height} fill="url(#grid)" />

                            {/* Connections */}
                            {connections.map(([a, b], i) => {
                                const pa = positions[a];
                                const pb = positions[b];
                                if (!pa || !pb) return null;
                                const nodeA = nodes.find(n => n.id === a);
                                const nodeB = nodes.find(n => n.id === b);
                                const isAttacked = nodeA?.compromised || nodeB?.compromised || liveNodeStatus._hasActiveAttack;
                                const hasShield = isBlocked(nodeA?.ip) || isBlocked(nodeB?.ip) || liveNodeStatus._hasDefense;
                                return (
                                    <line
                                        key={i}
                                        x1={pa.x} y1={pa.y}
                                        x2={pb.x} y2={pb.y}
                                        className="topology-link"
                                        style={{
                                            stroke: isAttacked ? 'rgba(239,68,68,0.5)' : hasShield ? 'rgba(59,130,246,0.4)' : 'rgba(99,102,241,0.15)',
                                            strokeWidth: isAttacked ? 2.5 : hasShield ? 2 : 1,
                                            strokeDasharray: isAttacked ? '8 4' : 'none',
                                            animation: isAttacked ? 'pulse-connection 1s ease-in-out infinite' : 'none'
                                        }}
                                    />
                                );
                            })}

                            {/* Nodes */}
                            {nodes.map(node => {
                                const pos = positions[node.id];
                                if (!pos) return null;
                                const blocked = isBlocked(node.ip);
                                const hasLiveAttack = liveNodeStatus._hasActiveAttack;
                                const status = node.isolated ? 'isolated' : (node.compromised || (hasLiveAttack && node.type === 'server')) ? 'compromised' : liveNodeStatus._hasDefense && node.type === 'firewall' ? 'online' : 'online';
                                const isSelected = selectedNode?.id === node.id;
                                return (
                                    <g key={node.id} className="topology-node-group"
                                        transform={`translate(${pos.x}, ${pos.y})`}
                                        onClick={(e) => handleNodeClick(node, e)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {/* Glow effect for compromised */}
                                        {(node.compromised || (hasLiveAttack && node.type === 'server')) && (
                                            <circle r="24" fill="rgba(239,68,68,0.15)" style={{ animation: 'pulse-red 1.5s ease-in-out infinite' }} />
                                        )}
                                        {liveNodeStatus._hasDefense && node.type === 'firewall' && (
                                            <circle r="24" fill="rgba(59,130,246,0.12)" style={{ animation: 'pulse-red 2s ease-in-out infinite' }} />
                                        )}
                                        {/* Shield glow for firewall-blocked */}
                                        {blocked && !node.compromised && (
                                            <circle r="24" fill="rgba(59,130,246,0.08)" stroke="rgba(59,130,246,0.3)" strokeWidth="1" strokeDasharray="3 2" />
                                        )}
                                        {/* Selection ring */}
                                        {isSelected && (
                                            <circle r="26" fill="none" stroke="var(--accent-purple)" strokeWidth="2" strokeDasharray="4 2" style={{ animation: 'pulse-red 1.5s ease-in-out infinite' }} />
                                        )}
                                        <circle r="18" className={`topology-node ${status}`}
                                            style={blocked && !node.compromised && !node.isolated ? { stroke: 'var(--blue-primary)', filter: 'drop-shadow(0 0 6px var(--blue-glow))' } : {}}
                                        />
                                        <text className="topology-node-icon" dy="1">{NODE_ICONS[node.type] || '??'}</text>
                                        {/* Shield badge */}
                                        {blocked && (
                                            <g transform="translate(12, -14)">
                                                <circle r="7" fill="var(--bg-secondary)" stroke="var(--blue-primary)" strokeWidth="1.5" />
                                                <text textAnchor="middle" dy="3.5" style={{ fontSize: 8, fill: 'var(--blue-primary)', fontWeight: 700 }}>🛡</text>
                                            </g>
                                        )}
                                        <text className="topology-node-label" y="30" style={{ fontSize: 8 }}>
                                            {node.name.length > 14 ? node.name.substring(0, 14) + '..' : node.name}
                                        </text>
                                        <text className="topology-node-label" y="40" style={{ fontSize: 7, opacity: 0.6 }}>
                                            {node.ip}
                                        </text>
                                    </g>
                                );
                            })}
                        </svg>

                        {/* Legend */}
                        <div className="topology-legend">
                            <div className="topology-legend-item">
                                <div className="topology-legend-dot" style={{ background: 'var(--accent-emerald)' }}></div>
                                Online
                            </div>
                            <div className="topology-legend-item">
                                <div className="topology-legend-dot" style={{ background: 'var(--red-primary)' }}></div>
                                Compromised
                            </div>
                            <div className="topology-legend-item">
                                <div className="topology-legend-dot" style={{ background: 'var(--accent-amber)' }}></div>
                                Isolated
                            </div>
                            <div className="topology-legend-item">
                                <div className="topology-legend-dot" style={{ background: 'var(--blue-primary)' }}></div>
                                Shielded
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Node Popover */}
            {selectedNode && (
                <div className="card" style={{
                    position: 'fixed',
                    left: Math.min(popoverPos.x, window.innerWidth - 320),
                    top: Math.max(popoverPos.y - 220, 80),
                    width: 290, zIndex: 100, padding: 16,
                    boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
                    borderColor: isBlocked(selectedNode.ip) ? 'var(--blue-border)' : 'var(--border-glow)',
                    animation: 'fadeSlideIn 0.2s ease'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 16, fontWeight: 700 }}>{NODE_ICONS[selectedNode.type]}</span>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-bright)' }}>{selectedNode.name}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{selectedNode.ip}</div>
                            </div>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => setSelectedNode(null)} style={{ padding: '2px 6px', fontSize: 10 }}>✕</button>
                    </div>

                    {/* Status badges */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                        {selectedNode.compromised && (
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'var(--red-bg)', color: 'var(--red-primary)', fontWeight: 700, border: '1px solid var(--red-border)' }}>COMPROMISED</span>
                        )}
                        {selectedNode.isolated && (
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', color: 'var(--accent-amber)', fontWeight: 700 }}>ISOLATED</span>
                        )}
                        {isBlocked(selectedNode.ip) && (
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'var(--blue-bg)', color: 'var(--blue-primary)', fontWeight: 700, border: '1px solid var(--blue-border)' }}>🛡 FIREWALL BLOCKED</span>
                        )}
                        {!selectedNode.compromised && !selectedNode.isolated && !isBlocked(selectedNode.ip) && (
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(16,185,129,0.1)', color: 'var(--accent-emerald)', fontWeight: 700 }}>ONLINE</span>
                        )}
                    </div>

                    {/* Services */}
                    {selectedNode.services && selectedNode.services.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, fontWeight: 600 }}>Services</div>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {selectedNode.services.map((svc, i) => (
                                    <span key={i} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', border: '1px solid var(--border-color)' }}>
                                        {svc.name}:{svc.port}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Vulnerabilities */}
                    {selectedNode.vulnerabilities && selectedNode.vulnerabilities.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, fontWeight: 600 }}>Vulnerabilities</div>
                            {selectedNode.vulnerabilities.map((vuln, i) => (
                                <div key={i} style={{ fontSize: 9, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>
                                    {vuln.id} — {vuln.name} <span style={{ color: vuln.severity === 'critical' ? 'var(--red-primary)' : 'var(--accent-amber)' }}>({vuln.severity})</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Firewall Action Button */}
                    {!isBlocked(selectedNode.ip) ? (
                        <button className="btn btn-danger btn-sm" style={{ width: '100%' }} onClick={() => handleBlockIP(selectedNode.ip)}>
                            🛡 Block IP ({selectedNode.ip})
                        </button>
                    ) : (
                        <div style={{ fontSize: 10, textAlign: 'center', color: 'var(--blue-primary)', fontWeight: 600, padding: '6px 0' }}>
                            ✓ IP is blocked by firewall rule
                        </div>
                    )}
                </div>
            )}

            {/* Click-outside handler overlay */}
            {selectedNode && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
                    onClick={() => setSelectedNode(null)} />
            )}

            {/* Node Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginTop: 16 }}>
                {nodes.filter(n => n.compromised || n.isolated || isBlocked(n.ip)).map(node => (
                    <div key={node.id} className="card" style={{ padding: 12, cursor: 'pointer', borderColor: isBlocked(node.ip) ? 'var(--blue-border)' : undefined }}
                        onClick={(e) => handleNodeClick(node, e)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 16 }}>{NODE_ICONS[node.type]}</span>
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-bright)' }}>{node.name}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{node.ip}</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            {node.compromised && (
                                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--red-bg)', color: 'var(--red-primary)', fontWeight: 600 }}>
                                    COMPROMISED
                                </span>
                            )}
                            {node.isolated && (
                                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', color: 'var(--accent-amber)', fontWeight: 600 }}>
                                    ISOLATED
                                </span>
                            )}
                            {isBlocked(node.ip) && (
                                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--blue-bg)', color: 'var(--blue-primary)', fontWeight: 600, border: '1px solid var(--blue-border)' }}>
                                    🛡 SHIELDED
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default NetworkTopology;
