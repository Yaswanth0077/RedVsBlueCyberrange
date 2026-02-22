import { getIO } from '../utils/socketManager.js';
import { autoMitigate } from './AutoMitigation.js';
import { logStore } from '../utils/LogStore.js';

class IDSEngine {
    constructor() {
        this.threatScore = 0;
        this.mitigationFactor = 0;
        this.blockedIPs = new Set();
    }

    handleAttackCheck(attackDef, isSuccess) {
        const io = getIO();
        const detected = Math.random() < attackDef.baseDetectionProbability;

        if (detected) {
            const w = attackDef.impactLevel === 'Critical' ? 35 : attackDef.impactLevel === 'High' ? 25 : 15;
            this.threatScore = Math.min(100, this.threatScore + w);
            this.mitigationFactor = Math.min(0.4, this.mitigationFactor + 0.05);

            const sourceIP = `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

            // Update the persistent log
            const recentLogs = logStore.queryLogs({ attackType: attackDef.name, limit: 1 });
            if (recentLogs.length > 0) {
                const lastLog = recentLogs[recentLogs.length - 1];
                logStore.updateLog(lastLog.id, { detected: true, mitigationAction: 'IDS Detection + Auto-Mitigation' });
            }

            // Score update: Blue gets points
            logStore.updateScores(0, 8, `IDS detected: ${attackDef.name}`);
            logStore.addHealthSnapshot(100 - this.threatScore, this.threatScore);

            if (io) {
                io.emit('blue_team_alert', {
                    type: 'ids_detection',
                    message: `[IDS] 🚨 DETECTED: ${attackDef.name} | Threat Score: ${this.threatScore}/100`,
                    severity: attackDef.impactLevel, attackName: attackDef.name,
                    sourceIP, threatScore: this.threatScore, timestamp: Date.now()
                });
                io.emit('scores_update', logStore.getScores());
                io.emit('timeline_event', {
                    type: 'detection', team: 'blue', severity: 'warning',
                    message: `IDS Detected: ${attackDef.name} from ${sourceIP}`,
                    timestamp: Date.now(), attackName: attackDef.name
                });
                io.emit('network_event', {
                    type: 'detection', attackName: attackDef.name,
                    nodeStatus: 'under_attack', sourceIP, timestamp: Date.now()
                });
            }

            // Auto-mitigation
            autoMitigate(attackDef, this.threatScore, sourceIP);

            // Block IP if critical
            if (attackDef.impactLevel === 'Critical' || this.threatScore > 70) {
                this.blockedIPs.add(sourceIP);
                logStore.updateScores(0, 3, `IP blocked: ${sourceIP}`);
                setTimeout(() => {
                    if (io) {
                        io.emit('blue_team_alert', {
                            type: 'firewall_update',
                            message: `[FIREWALL] 🔥 IP ${sourceIP} BLOCKED`,
                            severity: 'critical', sourceIP, timestamp: Date.now()
                        });
                        io.emit('timeline_event', {
                            type: 'mitigation', team: 'blue', severity: 'info',
                            message: `Firewall blocked IP ${sourceIP}`, timestamp: Date.now()
                        });
                        io.emit('network_event', {
                            type: 'firewall_block', sourceIP, nodeStatus: 'defended', timestamp: Date.now()
                        });
                    }
                }, 2000);
            }
        } else {
            // Undetected
            logStore.updateScores(3, -1, `Undetected: ${attackDef.name}`);
            if (io) {
                io.emit('blue_team_alert', {
                    type: 'ids_miss', severity: 'info',
                    message: `[IDS] Monitoring... no signature match for recent activity`,
                    timestamp: Date.now()
                });
            }
        }

        // Decay
        setTimeout(() => {
            this.threatScore = Math.max(0, this.threatScore - 5);
            this.mitigationFactor = Math.max(0, this.mitigationFactor - 0.01);
        }, 15000);
    }

    getMitigationFactor() { return this.mitigationFactor; }

    getStatus() {
        return {
            threatScore: this.threatScore, mitigationFactor: this.mitigationFactor,
            totalDetections: logStore.getMetrics().totalDetections,
            blockedIPs: [...this.blockedIPs]
        };
    }
}

export const idsEngine = new IDSEngine();
