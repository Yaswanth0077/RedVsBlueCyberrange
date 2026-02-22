import React from 'react';
import useSimulationStore from '../store/simulationStore';
import { RESPONSE_STATUS } from '../engine/BlueTeamEngine';

const COLUMNS = [
    { status: 'detected', label: 'Detected', cssClass: 'detected' },
    { status: 'triaged', label: 'Triaged', cssClass: 'triaged' },
    { status: 'contained', label: 'Contained', cssClass: 'contained' },
    { status: 'remediated', label: 'Remediated', cssClass: 'remediated' },
    { status: 'closed', label: 'Closed', cssClass: 'closed' }
];

function IncidentResponse() {
    const { simulation } = useSimulationStore();
    const incidents = simulation?.blueTeam?.incidents || [];

    if (!simulation?.scenario) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon" style={{ fontSize: 32, opacity: 0.4, fontWeight: 800 }}>IR</div>
                <div className="empty-state-title">Incident Response Pipeline</div>
                <div className="empty-state-desc">Start a simulation to track incidents through the IR workflow.</div>
            </div>
        );
    }

    return (
        <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 4 }}>
                Incident Response Pipeline
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                Track incidents through the response workflow: Detected → Triaged → Contained → Remediated → Closed
            </p>

            <div className="ir-pipeline">
                {COLUMNS.map(col => {
                    const colIncidents = incidents.filter(i => i.status === col.status);
                    return (
                        <div key={col.status} className="ir-column">
                            <div className={`ir-column-header ${col.cssClass}`}>
                                <span>{col.label}</span>
                                <span className="ir-count">{colIncidents.length}</span>
                            </div>
                            {colIncidents.length === 0 ? (
                                <div style={{ padding: 16, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    No incidents
                                </div>
                            ) : (
                                colIncidents.map(incident => (
                                    <div key={incident.id} className={`ir-card ${incident.severity}`}>
                                        <div className="ir-card-title">{incident.title}</div>
                                        <div className="ir-card-meta">
                                            <span className="ir-card-id">#{incident.id}</span>
                                            <span>•</span>
                                            <span style={{
                                                color: incident.severity === 'critical' ? 'var(--severity-critical)'
                                                    : incident.severity === 'high' ? 'var(--severity-high)'
                                                        : 'var(--severity-medium)'
                                            }}>
                                                {incident.severity}
                                            </span>
                                            <span>•</span>
                                            <span>T{incident.detectedAt}</span>
                                        </div>
                                        {incident.responseActions.length > 0 && (
                                            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                                {incident.responseActions.map((ra, i) => (
                                                    <span key={i} style={{
                                                        fontSize: 9, padding: '1px 5px', borderRadius: 3,
                                                        background: 'rgba(99,102,241,0.1)', color: 'var(--accent-purple)'
                                                    }}>
                                                        {ra.action}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default IncidentResponse;
