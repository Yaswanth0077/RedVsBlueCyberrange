// SimulationOrchestrator — Manages lifecycle: init → running → paused → complete

import EventBus from './EventBus';
import { createTopology } from './TopologyEngine';
import RedTeamEngine from './RedTeamEngine';
import BlueTeamEngine from './BlueTeamEngine';
import ScoringEngine from './ScoringEngine';
import { getScenario } from './scenarios';

const SIM_STATUS = {
    IDLE: 'idle',
    RUNNING: 'running',
    PAUSED: 'paused',
    COMPLETE: 'complete'
};

class SimulationOrchestrator {
    constructor(stateCallback) {
        this.eventBus = new EventBus();
        this.redTeam = new RedTeamEngine(this.eventBus);
        this.blueTeam = new BlueTeamEngine(this.eventBus);
        this.scoring = new ScoringEngine(this.eventBus);
        this.stateCallback = stateCallback;

        this.status = SIM_STATUS.IDLE;
        this.tick = 0;
        this.maxTicks = 100;
        this.speed = 1; // 1x, 2x, 5x, 10x
        this.intervalId = null;
        this.topology = null;
        this.scenario = null;
    }

    loadScenario(scenarioId) {
        this.scenario = getScenario(scenarioId);
        this.topology = createTopology(this.scenario.topology);
        this.maxTicks = this.scenario.duration;

        // Apply scenario config
        this.blueTeam.detectionRate = this.scenario.config.blueDetectionBase;
        this.blueTeam.setMonitoringLevel(this.scenario.config.monitoringLevel);
        this.scoring.setWeights(this.scenario.config.scoringWeights);

        // Init red team
        this.redTeam.initialize(this.topology);

        this.tick = 0;
        this.status = SIM_STATUS.IDLE;

        this.eventBus.emit('sim.loaded', {
            tick: 0, team: 'system', source: 'orchestrator',
            log: `Scenario loaded: ${this.scenario.name} -- ${this.scenario.description}`,
            severity: 'info'
        });

        this._pushState();
    }

    start() {
        if (this.status === SIM_STATUS.RUNNING) return;
        if (!this.topology) return;

        this.status = SIM_STATUS.RUNNING;

        this.eventBus.emit('sim.start', {
            tick: this.tick, team: 'system', source: 'orchestrator',
            log: `Simulation STARTED -- ${this.scenario.name}`,
            severity: 'info'
        });

        this._runLoop();
        this._pushState();
    }

    pause() {
        if (this.status !== SIM_STATUS.RUNNING) return;
        this.status = SIM_STATUS.PAUSED;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.eventBus.emit('sim.pause', {
            tick: this.tick, team: 'system', source: 'orchestrator',
            log: `Simulation PAUSED at tick ${this.tick}`,
            severity: 'info'
        });

        this._pushState();
    }

    resume() {
        if (this.status !== SIM_STATUS.PAUSED) return;
        this.status = SIM_STATUS.RUNNING;
        this._runLoop();
        this._pushState();
    }

    reset() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.eventBus.reset();
        this.scoring.reset();
        this.tick = 0;
        this.status = SIM_STATUS.IDLE;

        if (this.scenario) {
            this.loadScenario(this.scenario.id);
        }

        this._pushState();
    }

    setSpeed(speed) {
        this.speed = speed;
        if (this.status === SIM_STATUS.RUNNING) {
            clearInterval(this.intervalId);
            this._runLoop();
        }
    }

    _runLoop() {
        const baseInterval = 1000; // 1 second per tick at 1x
        const interval = baseInterval / this.speed;

        this.intervalId = setInterval(() => {
            this._tick();
        }, interval);
    }

    _tick() {
        if (this.tick >= this.maxTicks) {
            this._complete();
            return;
        }

        this.tick++;

        // Red team acts
        this.redTeam.tick(this.tick);

        // Blue team acts
        this.blueTeam.tick(this.tick, this.topology);
        this.blueTeam.closeRemediated(this.tick);

        // Push state every tick
        this._pushState();
    }

    _complete() {
        this.status = SIM_STATUS.COMPLETE;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        const metrics = this.scoring.getMetrics();
        this.eventBus.emit('sim.complete', {
            tick: this.tick, team: 'system', source: 'orchestrator',
            log: `Simulation COMPLETE -- Blue: ${metrics.blueTeamScore} pts | Red: ${metrics.redTeamScore} pts | Overall: ${metrics.overallBlueScore}/100`,
            severity: 'info',
            details: metrics
        });

        this._pushState();
    }

    _pushState() {
        if (this.stateCallback) {
            this.stateCallback(this.getState());
        }
    }

    getState() {
        return {
            status: this.status,
            tick: this.tick,
            maxTicks: this.maxTicks,
            speed: this.speed,
            scenario: this.scenario,
            topology: this.topology ? {
                nodes: this.topology.nodes.map(n => ({ ...n })),
                connections: [...this.topology.connections]
            } : null,
            redTeam: this.redTeam.getState(),
            blueTeam: this.blueTeam.getState(),
            scoring: this.scoring.getMetrics(),
            timeline: this.eventBus.getTimeline(),
            logs: this.eventBus.getLogs()
        };
    }

    getLogs(filter) {
        return this.eventBus.getLogs(filter);
    }

    destroy() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    }
}

export default SimulationOrchestrator;
export { SIM_STATUS };
