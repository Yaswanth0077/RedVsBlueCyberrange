// ScoringEngine — Metrics: detection latency, response accuracy, containment effectiveness, recovery time

class ScoringEngine {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.scores = {
            blueTeam: 0,
            redTeam: 0,
            detectionLatency: [],       // ticks between attack and detection
            responseAccuracy: [],       // correct responses / total responses
            containmentEffectiveness: [],  // successful containments / total
            recoveryTime: [],           // ticks to full recovery
        };
        this.weights = {
            detectionLatency: 0.3,
            responseAccuracy: 0.25,
            containmentEffectiveness: 0.25,
            recoveryTime: 0.2
        };
        this.attackEvents = {};   // track attack events for latency calculation
        this.incidentScores = [];
        this._setupListeners();
    }

    _setupListeners() {
        // Track red team actions for latency calculation
        this.eventBus.on('red.exploit_result', (e) => {
            if (e.details?.success) {
                this.attackEvents[e.tick] = { tick: e.tick, action: e.details.action, target: e.details.target, detected: false };
                this.scores.redTeam += 10;
            }
        });

        this.eventBus.on('red.post_exploit_result', (e) => {
            if (e.details?.success) {
                this.attackEvents[e.tick] = { tick: e.tick, action: e.details.action, detected: false };
                this.scores.redTeam += 15;
            }
        });

        this.eventBus.on('red.recon_complete', (e) => {
            this.scores.redTeam += 3;
        });

        // Track blue team detections
        this.eventBus.on('blue.detection', (e) => {
            // Find closest undetected attack
            const undetected = Object.values(this.attackEvents).filter(a => !a.detected);
            if (undetected.length > 0) {
                const closest = undetected.reduce((a, b) =>
                    Math.abs(e.tick - a.tick) < Math.abs(e.tick - b.tick) ? a : b
                );
                closest.detected = true;
                const latency = e.tick - closest.tick;
                this.scores.detectionLatency.push(latency);
                this.scores.blueTeam += Math.max(0, 10 - latency * 2); // More points for faster detection
            }
        });

        this.eventBus.on('blue.containment', (e) => {
            if (e.details?.success) {
                this.scores.containmentEffectiveness.push(1);
                this.scores.blueTeam += 8;
            } else {
                this.scores.containmentEffectiveness.push(0);
            }
        });

        this.eventBus.on('blue.response_failed', () => {
            this.scores.containmentEffectiveness.push(0);
            this.scores.responseAccuracy.push(0);
        });

        this.eventBus.on('blue.remediation', (e) => {
            if (e.details?.success) {
                this.scores.responseAccuracy.push(1);
                this.scores.blueTeam += 12;
            }
        });

        this.eventBus.on('blue.recovery', (e) => {
            if (e.details?.success) {
                const incident = e.details;
                this.scores.blueTeam += 15;
                this.scores.responseAccuracy.push(1);
            }
        });
    }

    setWeights(weights) {
        this.weights = { ...this.weights, ...weights };
    }

    getMetrics() {
        const avg = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

        const avgLatency = avg(this.scores.detectionLatency);
        const avgAccuracy = avg(this.scores.responseAccuracy);
        const avgContainment = avg(this.scores.containmentEffectiveness);
        const avgRecovery = avg(this.scores.recoveryTime);

        // Normalize scores to 0-100
        const latencyScore = Math.max(0, 100 - avgLatency * 15);
        const accuracyScore = avgAccuracy * 100;
        const containmentScore = avgContainment * 100;
        const recoveryScore = Math.max(0, 100 - avgRecovery * 10);

        const overallBlue = (
            latencyScore * this.weights.detectionLatency +
            accuracyScore * this.weights.responseAccuracy +
            containmentScore * this.weights.containmentEffectiveness +
            recoveryScore * this.weights.recoveryTime
        );

        return {
            blueTeamScore: Math.round(this.scores.blueTeam),
            redTeamScore: Math.round(this.scores.redTeam),
            detectionLatency: { raw: avgLatency, score: Math.round(latencyScore), samples: this.scores.detectionLatency.length },
            responseAccuracy: { raw: avgAccuracy, score: Math.round(accuracyScore), samples: this.scores.responseAccuracy.length },
            containmentEffectiveness: { raw: avgContainment, score: Math.round(containmentScore), samples: this.scores.containmentEffectiveness.length },
            recoveryTime: { raw: avgRecovery, score: Math.round(recoveryScore), samples: this.scores.recoveryTime.length },
            overallBlueScore: Math.round(overallBlue),
            weights: { ...this.weights },
            history: {
                detectionLatency: [...this.scores.detectionLatency],
                responseAccuracy: [...this.scores.responseAccuracy],
                containmentEffectiveness: [...this.scores.containmentEffectiveness]
            }
        };
    }

    reset() {
        this.scores = {
            blueTeam: 0,
            redTeam: 0,
            detectionLatency: [],
            responseAccuracy: [],
            containmentEffectiveness: [],
            recoveryTime: []
        };
        this.attackEvents = {};
        this.incidentScores = [];
    }
}

export default ScoringEngine;
