import React, { useState, useCallback } from 'react';
import useSimulationStore from '../store/simulationStore';

function LiveControls() {
    const {
        liveMode, liveStatus,
        connectRedAgent, connectBlueAgent,
        disconnectAgents, sendRedCommand, sendBlueCommand
    } = useSimulationStore();

    const [redIP, setRedIP] = useState('192.168.56.101');
    const [redPort, setRedPort] = useState('4001');
    const [blueIP, setBlueIP] = useState('192.168.56.102');
    const [bluePort, setBluePort] = useState('4002');

    const handleConnectRed = useCallback(() => {
        connectRedAgent(redIP, redPort);
    }, [redIP, redPort, connectRedAgent]);

    const handleConnectBlue = useCallback(() => {
        connectBlueAgent(blueIP, bluePort);
    }, [blueIP, bluePort, connectBlueAgent]);

    return (
        <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 4 }}>
                Live Mode -- Agent Connections
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                Connect to real Red Team (Kali) and Blue Team (Ubuntu) agents running on your virtual network.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                {/* Red Agent Connection */}
                <div className="card" style={{ padding: 20, borderColor: 'var(--red-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <span className={`status-dot ${liveStatus.red}`}></span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--red-primary)' }}>
                            Red Team Agent (Kali)
                        </span>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>
                                Kali IP
                            </label>
                            <input
                                type="text" value={redIP} onChange={e => setRedIP(e.target.value)}
                                className="log-search" style={{ width: '100%' }}
                                placeholder="192.168.56.101"
                            />
                        </div>
                        <div style={{ width: 80 }}>
                            <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>
                                Port
                            </label>
                            <input
                                type="text" value={redPort} onChange={e => setRedPort(e.target.value)}
                                className="log-search" style={{ width: '100%' }}
                                placeholder="4001"
                            />
                        </div>
                    </div>

                    {liveStatus.red === 'idle' || liveStatus.red === 'error' ? (
                        <button className="btn btn-danger" style={{ width: '100%' }} onClick={handleConnectRed}>
                            Connect to Kali
                        </button>
                    ) : liveStatus.red === 'connecting' ? (
                        <button className="btn btn-ghost" style={{ width: '100%' }} disabled>
                            Connecting...
                        </button>
                    ) : (
                        <div>
                            <div style={{ fontSize: 11, color: 'var(--accent-emerald)', marginBottom: 8, fontWeight: 600 }}>
                                Connected
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                <button className="btn btn-danger btn-sm" onClick={() => sendRedCommand('run_full_attack')}>
                                    Full Attack
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={() => sendRedCommand('recon_only')}>
                                    Recon Only
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={() => sendRedCommand('port_scan')}>
                                    Port Scan
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={() => sendRedCommand('vuln_scan')}>
                                    Vuln Scan
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={() => sendRedCommand('ssh_brute')}>
                                    SSH Brute
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={() => sendRedCommand('web_scan')}>
                                    Web Scan
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Blue Agent Connection */}
                <div className="card" style={{ padding: 20, borderColor: 'var(--blue-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <span className={`status-dot ${liveStatus.blue}`}></span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--blue-primary)' }}>
                            Blue Team Agent (Ubuntu)
                        </span>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>
                                Ubuntu IP
                            </label>
                            <input
                                type="text" value={blueIP} onChange={e => setBlueIP(e.target.value)}
                                className="log-search" style={{ width: '100%' }}
                                placeholder="192.168.56.102"
                            />
                        </div>
                        <div style={{ width: 80 }}>
                            <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>
                                Port
                            </label>
                            <input
                                type="text" value={bluePort} onChange={e => setBluePort(e.target.value)}
                                className="log-search" style={{ width: '100%' }}
                                placeholder="4002"
                            />
                        </div>
                    </div>

                    {liveStatus.blue === 'idle' || liveStatus.blue === 'error' ? (
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleConnectBlue}>
                            Connect to Ubuntu
                        </button>
                    ) : liveStatus.blue === 'connecting' ? (
                        <button className="btn btn-ghost" style={{ width: '100%' }} disabled>
                            Connecting...
                        </button>
                    ) : (
                        <div>
                            <div style={{ fontSize: 11, color: 'var(--accent-emerald)', marginBottom: 8, fontWeight: 600 }}>
                                Connected
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => sendBlueCommand('status')}>
                                    Status Report
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={() => sendBlueCommand('enable_enhanced_logging')}>
                                    Enhance Logging
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Disconnect All */}
            {(liveStatus.red === 'running' || liveStatus.blue === 'running') && (
                <button className="btn btn-ghost" onClick={disconnectAgents} style={{ marginBottom: 16 }}>
                    Disconnect All Agents
                </button>
            )}

            {/* Connection Info */}
            <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-bright)', marginBottom: 8 }}>
                    Setup Instructions
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7, fontFamily: 'var(--font-mono)' }}>
                    <div style={{ marginBottom: 6 }}>
                        <span style={{ color: 'var(--red-primary)' }}>Kali VM:</span>{' '}
                        node server/red-agent.js --target [UBUNTU_IP] --port 4001
                    </div>
                    <div style={{ marginBottom: 6 }}>
                        <span style={{ color: 'var(--blue-primary)' }}>Ubuntu VM:</span>{' '}
                        sudo node server/blue-agent.js --port 4002
                    </div>
                    <div>
                        <span style={{ color: 'var(--accent-purple)' }}>Dashboard:</span>{' '}
                        npm run dev (this machine)
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LiveControls;
