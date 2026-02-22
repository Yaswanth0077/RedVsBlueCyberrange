import React, { useMemo } from 'react';
import useSimulationStore from '../store/simulationStore';
import { SCENARIOS } from '../engine/scenarios';
import { SIM_STATUS } from '../engine/SimulationOrchestrator';
import { Play, Pause, RotateCcw, Zap } from 'lucide-react';

function Controls({ showScenarios = false }) {
    const {
        simulation, orchestrator,
        loadScenario, startSimulation, pauseSimulation,
        resumeSimulation, resetSimulation, setSpeed
    } = useSimulationStore();

    const status = simulation?.status || 'idle';
    const speed = simulation?.speed || 1;

    const speeds = [1, 2, 5, 10];

    if (showScenarios) {
        return (
            <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-bright)', marginBottom: 4 }}>
                    Select Scenario
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 20 }}>
                    Choose a pre-configured attack scenario to simulate. Each scenario has different topology, difficulty, and scoring parameters.
                </p>
                <div className="scenario-grid">
                    {SCENARIOS.map(s => (
                        <div
                            key={s.id}
                            className={`card scenario-card ${simulation?.scenario?.id === s.id ? 'selected' : ''}`}
                            onClick={() => loadScenario(s.id)}
                        >
                            <div className="scenario-icon">{s.icon}</div>
                            <div className="scenario-name">{s.name}</div>
                            <div className="scenario-desc">{s.description}</div>
                            <div className="scenario-meta">
                                <span className={`scenario-tag difficulty-${s.difficulty}`}>{s.difficulty}</span>
                                <span className="scenario-tag">{s.topology}</span>
                                <span className="scenario-tag">{s.duration} ticks</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="sim-controls">
            {status === 'idle' && simulation?.scenario && (
                <button className="btn btn-success" onClick={startSimulation}>
                    <Play size={14} /> Start
                </button>
            )}
            {status === 'running' && (
                <button className="btn btn-ghost" onClick={pauseSimulation}>
                    <Pause size={14} /> Pause
                </button>
            )}
            {status === 'paused' && (
                <button className="btn btn-success" onClick={resumeSimulation}>
                    <Play size={14} /> Resume
                </button>
            )}
            {(status === 'paused' || status === 'complete') && (
                <button className="btn btn-ghost" onClick={resetSimulation}>
                    <RotateCcw size={14} /> Reset
                </button>
            )}

            {status !== 'idle' && (
                <>
                    <div className="speed-selector">
                        {speeds.map(s => (
                            <button
                                key={s}
                                className={`speed-btn ${speed === s ? 'active' : ''}`}
                                onClick={() => setSpeed(s)}
                            >
                                {s}x
                            </button>
                        ))}
                    </div>
                    <div className="sim-tick-display">
                        <Zap size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                        {simulation?.tick || 0}/{simulation?.maxTicks || 0}
                    </div>
                </>
            )}
        </div>
    );
}

export default Controls;
