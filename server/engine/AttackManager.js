import { ATTACK_DEFINITIONS } from '../attacks/AttackDefinitions.js';
import { getIO } from '../utils/socketManager.js';
import { logStore } from '../utils/LogStore.js';

let idsEngineRef = null;
export function setIDSRef(ids) { idsEngineRef = ids; }

class AttackManager {
    constructor() {
        this.activeAttacks = new Map();
        this.systemHealth = 100;
    }

    startAttack(attackId) {
        const io = getIO();
        if (this.activeAttacks.has(attackId)) return { error: 'Attack already running' };

        const attackDef = ATTACK_DEFINITIONS.find(a => a.id === attackId);
        if (!attackDef) return { error: 'Unknown attack' };

        const healthBefore = this.systemHealth;

        // Persist log entry immediately
        const logEntry = logStore.addLog({
            attackId, attackName: attackDef.name,
            attackerRole: 'RedTeam', target: 'Primary Network',
            startTime: Date.now(), endTime: null,
            duration: attackDef.duration, result: 'Running',
            detected: false, mitigationAction: null,
            impactScore: attackDef.impactLevel === 'Critical' ? 10 : attackDef.impactLevel === 'High' ? 7 : attackDef.impactLevel === 'Medium' ? 4 : 2,
            impactLevel: attackDef.impactLevel,
            systemHealthBefore: healthBefore, systemHealthAfter: null,
            resourceImpact: attackDef.resourceImpact
        });

        // Update scores: Red gets points for launching
        logStore.updateScores(2, 0, `Attack launched: ${attackDef.name}`);

        const attackState = {
            id: attackId, definition: attackDef,
            startTime: Date.now(), logId: logEntry.id,
            timer: null, progressInterval: null
        };

        // Progress updates
        attackState.progressInterval = setInterval(() => {
            const elapsed = Date.now() - attackState.startTime;
            const progress = Math.min(100, Math.round((elapsed / attackDef.duration) * 100));
            if (io) io.emit('attack_progress', { attackId, name: attackDef.name, progress, elapsed, duration: attackDef.duration });
        }, 500);

        // Simulate resource drain
        this.systemHealth = Math.max(5, this.systemHealth - (attackDef.resourceImpact?.cpu || 0) * 0.1);
        logStore.addHealthSnapshot(this.systemHealth, idsEngineRef?.threatScore || 0);

        attackState.timer = setTimeout(() => this.finishAttack(attackId), attackDef.duration);
        this.activeAttacks.set(attackId, attackState);

        const logs = this._generateAttackLogs(attackDef);

        if (io) {
            io.emit('attack_started', {
                attackId, name: attackDef.name, duration: attackDef.duration,
                description: attackDef.description, impactLevel: attackDef.impactLevel,
                logs, logId: logEntry.id
            });
            io.emit('system_metrics_update', {
                impact: attackDef.resourceImpact, attackId, attackName: attackDef.name,
                systemHealth: this.systemHealth
            });
            // Broadcast updated scores
            io.emit('scores_update', logStore.getScores());
            // Broadcast timeline event
            io.emit('timeline_event', {
                type: 'attack_start', team: 'red', severity: 'warning',
                message: `Attack Started: ${attackDef.name}`, timestamp: Date.now(), attackName: attackDef.name
            });
        }

        console.log(`[ATTACK ENGINE] Started: ${attackDef.name}`);
        return { success: true, message: `Attack ${attackDef.name} started`, duration: attackDef.duration };
    }

    stopAttack(attackId) {
        const io = getIO();
        if (!this.activeAttacks.has(attackId)) return { error: 'Attack not running' };

        const attack = this.activeAttacks.get(attackId);
        clearTimeout(attack.timer);
        clearInterval(attack.progressInterval);
        this.activeAttacks.delete(attackId);

        // Update persistent log
        logStore.updateLog(attack.logId, { result: 'Cancelled', endTime: Date.now(), systemHealthAfter: this.systemHealth });
        logStore.updateScores(-1, 2, `Attack cancelled: ${attack.definition.name}`);

        // Recover health
        this.systemHealth = Math.min(100, this.systemHealth + 5);
        logStore.addHealthSnapshot(this.systemHealth, idsEngineRef?.threatScore || 0);

        if (io) {
            io.emit('attack_stopped', { attackId, name: attack.definition.name });
            io.emit('scores_update', logStore.getScores());
            io.emit('system_metrics_update', { systemHealth: this.systemHealth, healthRestored: true });
            io.emit('timeline_event', {
                type: 'attack_cancel', team: 'red', severity: 'info',
                message: `Attack Cancelled: ${attack.definition.name}`, timestamp: Date.now()
            });
        }
        return { success: true };
    }

    finishAttack(attackId) {
        const io = getIO();
        if (!this.activeAttacks.has(attackId)) return;

        const attack = this.activeAttacks.get(attackId);
        clearInterval(attack.progressInterval);
        this.activeAttacks.delete(attackId);

        // Factor in IDS mitigation
        let effectiveProb = attack.definition.baseSuccessProbability;
        if (idsEngineRef) effectiveProb = Math.max(0.05, effectiveProb - idsEngineRef.getMitigationFactor());
        const isSuccess = Math.random() < effectiveProb;
        const result = isSuccess ? 'Success' : 'Failed';

        // Update scores
        if (isSuccess) {
            logStore.updateScores(10, -3, `Attack succeeded: ${attack.definition.name}`);
            this.systemHealth = Math.max(5, this.systemHealth - 5);
        } else {
            logStore.updateScores(-2, 5, `Attack blocked: ${attack.definition.name}`);
            this.systemHealth = Math.min(100, this.systemHealth + 3);
        }

        // Update persistent log
        logStore.updateLog(attack.logId, { result, endTime: Date.now(), systemHealthAfter: this.systemHealth });
        logStore.addHealthSnapshot(this.systemHealth, idsEngineRef?.threatScore || 0);

        if (io) {
            io.emit('attack_completed', {
                attackId, name: attack.definition.name, result,
                impactLevel: attack.definition.impactLevel,
                effectiveProbability: Math.round(effectiveProb * 100)
            });
            io.emit('scores_update', logStore.getScores());
            io.emit('system_metrics_update', { systemHealth: this.systemHealth });
            io.emit('report_update', logStore.getReport());
            io.emit('timeline_event', {
                type: isSuccess ? 'attack_success' : 'attack_blocked', team: 'red',
                severity: isSuccess ? 'error' : 'info',
                message: isSuccess ? `BREACH: ${attack.definition.name} succeeded!` : `BLOCKED: ${attack.definition.name} failed`,
                timestamp: Date.now(), attackName: attack.definition.name
            });
            // Trigger network map update
            io.emit('network_event', {
                type: 'attack_result', attackName: attack.definition.name, result,
                nodeStatus: isSuccess ? 'compromised' : 'defended', timestamp: Date.now()
            });
        }

        // Trigger IDS
        if (idsEngineRef) idsEngineRef.handleAttackCheck(attack.definition, isSuccess);

        console.log(`[ATTACK ENGINE] ${attack.definition.name} -> ${result}`);
    }

    _generateAttackLogs(def) {
        const t = {
            'Stored XSS': ['Injecting payload into comment field...', 'Payload: <script>document.cookie</script>', 'Checking for WAF bypass...'],
            'Reflected XSS': ['Crafting malicious URL...', 'Testing parameter reflection...', 'Sending phishing link with embedded XSS...'],
            'CSRF': ['Analyzing session token...', 'Creating forged request...', 'Deploying CSRF exploit page...'],
            'Ransomware Simulation': ['Enumerating filesystem...', 'Generating AES-256 keys...', 'Encrypting /home/user/documents...', 'Dropping ransom note...'],
            'Privilege Escalation': ['Scanning SUID binaries...', 'Checking kernel CVEs...', 'Attempting sudo misconfiguration...'],
            'Reverse Shell': ['Setting up listener on 4444...', 'Crafting reverse shell payload...', 'Attempting connection back...'],
            'SYN Flood (DDoS)': ['Spoofing source IPs...', 'Flooding port 80 with SYN...', '100,000 pps...', 'Target saturating...'],
            'Zero-Day Exploit': ['Fuzzing inputs...', 'Crash at offset 0x7FF3...', 'Crafting ROP chain...'],
            'DNS Spoofing': ['ARP poisoning gateway...', 'Intercepting DNS queries...', 'Injecting forged responses...'],
            'Man-in-the-Middle': ['ARP spoofing target...', 'SSLstrip on HTTPS...', 'Capturing credentials...'],
            'Phishing Campaign': ['Cloning login page...', 'Sending 500 phishing emails...', 'Tracking click-through...'],
            'Malware Beaconing': ['Installing backdoor...', 'Establishing C2 channel...', 'Beaconing every 30s...'],
            'Data Exfiltration': ['Identifying sensitive stores...', 'Compressing files...', 'Uploading via HTTPS...']
        };
        return t[def.name] || [`Executing ${def.name}...`];
    }

    getActiveAttacks() {
        const a = [];
        this.activeAttacks.forEach((v, k) => {
            const e = Date.now() - v.startTime;
            a.push({ id: k, name: v.definition.name, elapsed: e, duration: v.definition.duration, progress: Math.min(100, Math.round((e / v.definition.duration) * 100)) });
        });
        return a;
    }

    getHistory() {
        return logStore.queryLogs({ limit: 100 });
    }

    getSystemHealth() { return this.systemHealth; }
}

export const attackManager = new AttackManager();
