import React, { useState, useEffect } from 'react';
import useSimulationStore from './store/simulationStore';
import { initSocketBridge } from './services/SocketBridge';
import Dashboard from './components/Dashboard';
import Timeline from './components/Timeline';
import NetworkTopology from './components/NetworkTopology';
import ScorePanel from './components/ScorePanel';
import LogViewer from './components/LogViewer';
import IncidentResponse from './components/IncidentResponse';
import Controls from './components/Controls';
import ReportPanel from './components/ReportPanel';
import LiveControls from './components/LiveControls';
import FirewallPanel from './components/FirewallPanel';
import Login from './pages/Login';
import AttackControlPanel from './panels/AttackControlPanel';
import BlueTeamAlertPanel from './panels/BlueTeamAlertPanel';
import {
    LayoutDashboard, Clock, Network, BarChart3,
    FileText, Shield, Settings, FileBarChart, Radio, Flame, ShieldAlert, Crosshair
} from 'lucide-react';

const NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'overview' },
    { id: 'timeline', label: 'Timeline', icon: Clock, section: 'overview' },
    { id: 'topology', label: 'Network Map', icon: Network, section: 'overview' },
    { id: 'scores', label: 'Scoring', icon: BarChart3, section: 'analytics' },
    { id: 'logs', label: 'Log Viewer', icon: FileText, section: 'analytics' },
    { id: 'incidents', label: 'Incident Response', icon: Shield, section: 'operations' },
    { id: 'firewall', label: 'Firewall', icon: Flame, section: 'operations' },
    { id: 'report', label: 'Report', icon: FileBarChart, section: 'operations' },
    { id: 'attacks', label: 'Attack Center', icon: Crosshair, section: 'operations' },
    { id: 'alerts', label: 'IDS Alerts', icon: ShieldAlert, section: 'operations' },
    { id: 'live', label: 'Live Mode', icon: Radio, section: 'config' },
    { id: 'scenarios', label: 'Scenarios', icon: Settings, section: 'config' }
];

function App() {
    const { simulation, activeTab, setActiveTab, mode, setMode, liveStatus, liveLogs, liveBlueTeam } = useSimulationStore();
    const [user, setUser] = useState(() => {
        const storedUser = localStorage.getItem('user');
        return storedUser ? JSON.parse(storedUser) : null;
    });

    const status = simulation?.status || 'idle';
    const isLive = mode === 'live';

    useEffect(() => { initSocketBridge(useSimulationStore); }, []);

    if (!user) {
        return <Login onLogin={setUser} />;
    }

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return <Dashboard />;
            case 'timeline': return <Timeline />;
            case 'topology': return <NetworkTopology />;
            case 'scores': return <ScorePanel />;
            case 'logs': return <LogViewer />;
            case 'incidents': return <IncidentResponse />;
            case 'report': return <ReportPanel />;
            case 'firewall': return <FirewallPanel />;
            case 'attacks': return <AttackControlPanel />;
            case 'alerts': return <BlueTeamAlertPanel />;
            case 'live': return <LiveControls />;
            case 'scenarios': return <Controls showScenarios />;
            default: return <Dashboard />;
        }
    };

    const grouped = {};
    NAV_ITEMS.filter(item => {
        if (item.id === 'attacks' && user.role === 'BlueTeam') return false;
        if (item.id === 'alerts' && user.role === 'RedTeam') return false;
        return true;
    }).forEach(item => {
        if (!grouped[item.section]) grouped[item.section] = [];
        grouped[item.section].push(item);
    });

    const sectionLabels = {
        overview: 'Overview',
        analytics: 'Analytics',
        operations: 'Operations',
        config: 'Configuration'
    };

    const openIncidents = isLive ? liveBlueTeam?.openIncidents || 0 : simulation?.blueTeam?.openIncidents || 0;
    const logCount = isLive ? liveLogs.length : simulation?.logs?.length || 0;

    const liveConnected = liveStatus.red === 'running' || liveStatus.blue === 'running';

    return (
        <div className="app-layout">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <div className="sidebar-brand-icon">RB</div>
                    <div>
                        <h1>Red vs Blue</h1>
                        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            Cyber Sim Platform
                            <button
                                onClick={() => { localStorage.removeItem('user'); localStorage.removeItem('token'); setUser(null); }}
                                style={{ marginLeft: 10, background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: 9, padding: '2px 4px', borderRadius: 4, cursor: 'pointer' }}
                            >
                                Logout
                            </button>
                        </span>
                    </div>
                </div>

                {/* Mode Toggle */}
                <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{
                        display: 'flex', borderRadius: 6, overflow: 'hidden',
                        border: '1px solid var(--border-color)', fontSize: 11, fontWeight: 600
                    }}>
                        <button
                            onClick={() => setMode('simulation')}
                            style={{
                                flex: 1, padding: '6px 0', border: 'none', cursor: 'pointer',
                                background: !isLive ? 'var(--accent-purple)' : 'transparent',
                                color: !isLive ? '#fff' : 'var(--text-muted)',
                                fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 11
                            }}
                        >
                            Simulation
                        </button>
                        <button
                            onClick={() => setMode('live')}
                            style={{
                                flex: 1, padding: '6px 0', border: 'none', cursor: 'pointer',
                                background: isLive ? 'var(--accent-emerald)' : 'transparent',
                                color: isLive ? '#fff' : 'var(--text-muted)',
                                fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 11
                            }}
                        >
                            Live {liveConnected ? '(ON)' : ''}
                        </button>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {Object.entries(grouped).map(([section, items]) => (
                        <React.Fragment key={section}>
                            <div className="sidebar-section-label">{sectionLabels[section]}</div>
                            {items.map(item => {
                                const Icon = item.icon;
                                return (
                                    <div
                                        key={item.id}
                                        className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
                                        onClick={() => setActiveTab(item.id)}
                                    >
                                        <Icon className="sidebar-item-icon" size={18} />
                                        <span>{item.label}</span>
                                        {item.id === 'incidents' && openIncidents > 0 && (
                                            <span className="sidebar-badge">{openIncidents}</span>
                                        )}
                                        {item.id === 'logs' && logCount > 0 && (
                                            <span className="sidebar-badge blue">{logCount}</span>
                                        )}
                                        {item.id === 'live' && liveConnected && (
                                            <span className="sidebar-badge" style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--accent-emerald)' }}>ON</span>
                                        )}
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </nav>
            </aside>

            {/* Main Content */}
            <div className="main-content">
                <header className="app-header">
                    <div className="header-left">
                        {isLive ? (
                            <>
                                <span className={`status-dot ${liveConnected ? 'running' : 'idle'}`}></span>
                                <div>
                                    <div className="header-title">
                                        Live Mode {liveConnected ? '-- Active' : '-- Disconnected'}
                                    </div>
                                    <div className="header-subtitle">
                                        Red: {liveStatus.red} | Blue: {liveStatus.blue}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <span className={`status-dot ${status}`}></span>
                                <div>
                                    <div className="header-title">
                                        {simulation?.scenario?.name || 'No Scenario Loaded'}
                                    </div>
                                    <div className="header-subtitle">
                                        {status === 'idle' && 'Select a scenario to begin'}
                                        {status === 'running' && `Simulation running -- Tick ${simulation?.tick}/${simulation?.maxTicks}`}
                                        {status === 'paused' && `Paused at tick ${simulation?.tick}`}
                                        {status === 'complete' && 'Simulation complete -- View report'}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    {!isLive && <Controls />}
                </header>
                <div className="content-area">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
}

export default App;
