import { getIO } from '../utils/socketManager.js';
import { logStore } from '../utils/LogStore.js';

export const autoMitigate = (attackDef, threatScore, sourceIP) => {
    const io = getIO();
    let actions = [];
    let sev = 'info';

    if (threatScore > 80 || attackDef.impactLevel === 'Critical') {
        sev = 'critical';
        actions = [`Network isolation for ${sourceIP}`, 'Non-essential services suspended', 'SOC team notified', 'Packet capture enabled'];
    } else if (threatScore > 50) {
        sev = 'warning';
        actions = [`Rate limiting: 50 req/min from ${sourceIP}`, 'Suspicious processes quarantined', 'Enhanced logging enabled'];
    } else {
        actions = [`Firewall rule for ${attackDef.name} signatures`, `Monitoring intensified for ${sourceIP}`];
    }

    // Blue team gets score for mitigation
    logStore.updateScores(0, actions.length * 2, `Auto-mitigation: ${attackDef.name}`);

    actions.forEach((action, i) => {
        setTimeout(() => {
            if (io) {
                io.emit('blue_team_alert', {
                    type: 'auto_mitigation',
                    message: `[Mitigation] ⚡ ${action}`,
                    severity: sev, mitigation: action, attackName: attackDef.name,
                    sourceIP, threatScore, timestamp: Date.now()
                });
                io.emit('timeline_event', {
                    type: 'mitigation', team: 'blue', severity: sev,
                    message: `Mitigation: ${action}`, timestamp: Date.now()
                });
            }
        }, 1500 + i * 600);
    });

    // Health restoration
    setTimeout(() => {
        if (io) {
            io.emit('system_metrics_update', { healthRestored: true, threatScore: Math.max(0, threatScore - 10) });
            io.emit('blue_team_alert', {
                type: 'health_update', severity: 'info',
                message: `[SYSTEM] ✅ Health restoration in progress`, timestamp: Date.now()
            });
            io.emit('network_event', { type: 'recovery', nodeStatus: 'stable', timestamp: Date.now() });
        }
    }, 1500 + actions.length * 600 + 1000);
};
