// RedTeamEngine — Simulates reconnaissance, exploitation, and post-exploitation

const ATTACK_PHASES = {
    RECON: 'reconnaissance',
    EXPLOIT: 'exploitation',
    POST_EXPLOIT: 'post_exploitation'
};

const RECON_ACTIONS = [
    { name: 'Network Sweep', description: 'ICMP sweep to discover live hosts', duration: 2, detectChance: 0.15 },
    { name: 'Port Scan', description: 'TCP SYN scan on discovered hosts', duration: 3, detectChance: 0.3 },
    { name: 'Service Enumeration', description: 'Banner grabbing and version detection', duration: 2, detectChance: 0.25 },
    { name: 'Vulnerability Scan', description: 'Automated vulnerability assessment', duration: 4, detectChance: 0.45 },
    { name: 'DNS Enumeration', description: 'DNS zone transfer and subdomain discovery', duration: 2, detectChance: 0.1 },
    { name: 'OSINT Gathering', description: 'Open-source intelligence collection', duration: 1, detectChance: 0.0 }
];

const EXPLOIT_ACTIONS = [
    { name: 'Credential Brute Force', description: 'Dictionary attack on authentication services', duration: 5, detectChance: 0.6, successBase: 0.4 },
    { name: 'SQL Injection', description: 'Exploiting SQL injection in web application', duration: 3, detectChance: 0.35, successBase: 0.5 },
    { name: 'Buffer Overflow', description: 'Memory corruption exploit on vulnerable service', duration: 4, detectChance: 0.4, successBase: 0.35 },
    { name: 'Phishing Payload', description: 'Spear-phishing email with malicious payload', duration: 2, detectChance: 0.2, successBase: 0.45 },
    { name: 'RDP Exploit', description: 'Exploiting RDP vulnerability (BlueKeep variant)', duration: 3, detectChance: 0.5, successBase: 0.3 },
    { name: 'Web Shell Upload', description: 'Uploading web shell via file upload vulnerability', duration: 3, detectChance: 0.3, successBase: 0.4 },
    // --- Advanced Attack Extensions ---
    { id: '1', name: 'Stored XSS', description: 'Injects malicious script persistently into target database.', duration: 4, detectChance: 0.4, successBase: 0.6 },
    { id: '2', name: 'Reflected XSS', description: 'Injects script via crafted URL to target victims.', duration: 3, detectChance: 0.5, successBase: 0.5 },
    { id: '3', name: 'CSRF', description: 'Forces user to execute unwanted actions on auth session.', duration: 3, detectChance: 0.3, successBase: 0.5 },
    { id: '4', name: 'Ransomware Simulation', description: 'Simulates encrypting filesystem and demanding ransom.', duration: 8, detectChance: 0.8, successBase: 0.3 },
    { id: '5', name: 'Privilege Escalation', description: 'Attempts to gain root/admin access via misconfigurations.', duration: 6, detectChance: 0.5, successBase: 0.4 },
    { id: '6', name: 'Reverse Shell', description: 'Opens interactive shell connection back to attacker.', duration: 5, detectChance: 0.7, successBase: 0.45 },
    { id: '7', name: 'SYN Flood (DDoS)', description: 'Simulates massive volumetric TCP SYN attack.', duration: 10, detectChance: 0.9, successBase: 0.8 },
    { id: '8', name: 'Zero-Day Exploit', description: 'Randomized unknown vulnerability exploitation.', duration: 7, detectChance: 0.1, successBase: 0.2 },
    { id: '9', name: 'DNS Spoofing', description: 'Poisons DNS cache to redirect traffic.', duration: 4, detectChance: 0.6, successBase: 0.5 },
    { id: '10', name: 'Man-in-the-Middle', description: 'Intercepts traffic passing through the network.', duration: 6, detectChance: 0.5, successBase: 0.4 },
    { id: '11', name: 'Phishing Campaign', description: 'Sends deceptive emails to harvest credentials.', duration: 5, detectChance: 0.2, successBase: 0.6 },
    { id: '12', name: 'Malware Beaconing', description: 'Simulates C2 callbacks from compromised host.', duration: 10, detectChance: 0.6, successBase: 0.7 },
    { id: '13', name: 'Data Exfiltration', description: 'Steals sensitive data over encrypted channels.', duration: 9, detectChance: 0.7, successBase: 0.5 }
];

const POST_EXPLOIT_ACTIONS = [
    { name: 'Privilege Escalation', description: 'Escalating to root/admin privileges', duration: 3, detectChance: 0.35, successBase: 0.5 },
    { name: 'Lateral Movement', description: 'Moving to adjacent network hosts via pass-the-hash', duration: 4, detectChance: 0.45, successBase: 0.4 },
    { name: 'Data Exfiltration', description: 'Extracting sensitive data from compromised host', duration: 5, detectChance: 0.5, successBase: 0.6 },
    { name: 'Persistence Install', description: 'Installing backdoor for persistent access', duration: 3, detectChance: 0.3, successBase: 0.55 },
    { name: 'Credential Harvesting', description: 'Dumping credentials from memory (Mimikatz)', duration: 2, detectChance: 0.4, successBase: 0.65 },
    { name: 'Ransomware Deploy', description: 'Encrypting files on compromised systems', duration: 6, detectChance: 0.7, successBase: 0.5 }
];

class RedTeamEngine {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.phase = ATTACK_PHASES.RECON;
        this.attackLog = [];
        this.compromisedNodes = new Set();
        this.discoveredNodes = new Set();
        this.discoveredVulns = [];
        this.currentTarget = null;
        this.actionQueue = [];
        this.activeAction = null;
        this.ticksRemaining = 0;
        this.totalAttacks = 0;
        this.successfulAttacks = 0;
    }

    initialize(topology) {
        this.topology = topology;
        this.phase = ATTACK_PHASES.RECON;
        this.compromisedNodes.clear();
        this.discoveredNodes.clear();
        this.discoveredVulns = [];
        this.attackLog = [];
        this.actionQueue = [];
        this.activeAction = null;
        this.ticksRemaining = 0;
        this.totalAttacks = 0;
        this.successfulAttacks = 0;

        // Plan initial recon
        this._planRecon();
    }

    _planRecon() {
        const actions = RECON_ACTIONS.map(a => ({ ...a, phase: ATTACK_PHASES.RECON }));
        this.actionQueue.push(...actions);
    }

    _planExploitation() {
        const targets = this.topology.nodes.filter(n =>
            !n.isolated && !this.compromisedNodes.has(n.id) &&
            (this.discoveredNodes.has(n.id) || this.discoveredVulns.some(v => v.nodeId === n.id))
        );

        if (targets.length === 0) return;

        // Prioritize nodes with known vulns
        const vulnTargets = targets.filter(t => this.discoveredVulns.some(v => v.nodeId === t.id));
        const primary = vulnTargets.length > 0 ? vulnTargets : targets;
        const target = primary[Math.floor(Math.random() * primary.length)];
        this.currentTarget = target;

        const actions = EXPLOIT_ACTIONS
            .sort(() => Math.random() - 0.5)
            .slice(0, 2 + Math.floor(Math.random() * 2))
            .map(a => ({ ...a, phase: ATTACK_PHASES.EXPLOIT, targetId: target.id, targetName: target.name }));

        this.actionQueue.push(...actions);
    }

    _planPostExploitation() {
        const compromised = this.topology.nodes.filter(n => this.compromisedNodes.has(n.id) && !n.isolated);
        if (compromised.length === 0) return;

        const source = compromised[Math.floor(Math.random() * compromised.length)];
        const actions = POST_EXPLOIT_ACTIONS
            .sort(() => Math.random() - 0.5)
            .slice(0, 1 + Math.floor(Math.random() * 2))
            .map(a => ({ ...a, phase: ATTACK_PHASES.POST_EXPLOIT, sourceId: source.id, sourceName: source.name }));

        this.actionQueue.push(...actions);
    }

    tick(tickNum) {
        const events = [];

        // Continue active action
        if (this.activeAction) {
            this.ticksRemaining--;
            if (this.ticksRemaining <= 0) {
                const result = this._resolveAction(this.activeAction, tickNum);
                events.push(result);
                this.activeAction = null;
            } else {
                return events; // Still executing
            }
        }

        // Pick next action
        if (this.actionQueue.length === 0) {
            // Transition phases
            if (this.phase === ATTACK_PHASES.RECON) {
                this.phase = ATTACK_PHASES.EXPLOIT;
                this._planExploitation();
                this.eventBus.emit('red.phase_change', {
                    tick: tickNum, team: 'red', source: 'red_team',
                    log: `Red Team advancing to EXPLOITATION phase`,
                    severity: 'warning', phase: this.phase
                });
            } else if (this.phase === ATTACK_PHASES.EXPLOIT && this.compromisedNodes.size > 0) {
                this.phase = ATTACK_PHASES.POST_EXPLOIT;
                this._planPostExploitation();
                this.eventBus.emit('red.phase_change', {
                    tick: tickNum, team: 'red', source: 'red_team',
                    log: `Red Team advancing to POST-EXPLOITATION phase`,
                    severity: 'error', phase: this.phase
                });
            } else {
                // Re-plan current phase
                if (this.phase === ATTACK_PHASES.EXPLOIT) this._planExploitation();
                else if (this.phase === ATTACK_PHASES.POST_EXPLOIT) this._planPostExploitation();
                if (this.actionQueue.length === 0) return events;
            }
        }

        if (this.actionQueue.length > 0) {
            this.activeAction = this.actionQueue.shift();
            this.ticksRemaining = this.activeAction.duration;

            this.eventBus.emit('red.action_start', {
                tick: tickNum, team: 'red', source: 'red_team',
                log: `[${this.activeAction.phase.toUpperCase()}] Starting: ${this.activeAction.name} -- ${this.activeAction.description}`,
                severity: 'warning',
                action: this.activeAction.name,
                phase: this.activeAction.phase,
                targetId: this.activeAction.targetId,
                details: { duration: this.activeAction.duration }
            });
        }

        return events;
    }

    _resolveAction(action, tickNum) {
        this.totalAttacks++;
        const phase = action.phase;

        if (phase === ATTACK_PHASES.RECON) {
            // Recon always succeeds — discovers nodes
            const undiscovered = this.topology.nodes.filter(n => !this.discoveredNodes.has(n.id));
            const discovered = undiscovered.slice(0, 1 + Math.floor(Math.random() * 3));
            discovered.forEach(n => this.discoveredNodes.add(n.id));

            // Discover vulnerabilities
            discovered.forEach(n => {
                n.vulnerabilities.forEach(v => {
                    if (Math.random() < 0.6) {
                        this.discoveredVulns.push({ ...v, nodeId: n.id, nodeName: n.name });
                    }
                });
            });

            const result = {
                success: true,
                action: action.name,
                discovered: discovered.map(n => n.name),
                vulnsFound: this.discoveredVulns.length
            };

            this.eventBus.emit('red.recon_complete', {
                tick: tickNum, team: 'red', source: 'red_team',
                log: `Recon complete: ${action.name} -- discovered ${discovered.length} hosts, ${result.vulnsFound} vulnerabilities known`,
                severity: 'info',
                details: result,
                detectChance: action.detectChance
            });

            this.successfulAttacks++;
            return result;
        }

        if (phase === ATTACK_PHASES.EXPLOIT) {
            const target = this.topology.nodes.find(n => n.id === action.targetId);
            let successChance = action.successBase;

            if (target) {
                if (target.isolated) {
                    successChance = 0;
                } else {
                    const hasVuln = this.discoveredVulns.some(v => v.nodeId === target.id);
                    if (hasVuln) successChance += 0.2;
                    if (target.patchLevel === 'outdated') successChance += 0.15;
                }
            }

            const success = Math.random() < successChance;

            if (success && target) {
                target.compromised = true;
                this.compromisedNodes.add(target.id);
                this.successfulAttacks++;
            }

            this.eventBus.emit('red.exploit_result', {
                tick: tickNum, team: 'red', source: 'red_team',
                log: success
                    ? `EXPLOIT SUCCESS: ${action.name} on ${action.targetName} -- system compromised!`
                    : `Exploit failed: ${action.name} on ${action.targetName}`,
                severity: success ? 'error' : 'info',
                details: { action: action.name, target: action.targetName, success },
                detectChance: action.detectChance,
                compromised: success
            });

            return { success, action: action.name, target: action.targetName };
        }

        if (phase === ATTACK_PHASES.POST_EXPLOIT) {
            const source = this.topology.nodes.find(n => n.id === action.sourceId);
            let successChance = action.successBase;
            if (source?.isolated) successChance = 0;

            const success = Math.random() < successChance;

            if (success) {
                this.successfulAttacks++;
                // Lateral movement can compromise new nodes
                if (action.name === 'Lateral Movement') {
                    const adjacent = this.topology.nodes.filter(n =>
                        !n.isolated && !this.compromisedNodes.has(n.id)
                    );
                    if (adjacent.length > 0) {
                        const newTarget = adjacent[Math.floor(Math.random() * adjacent.length)];
                        newTarget.compromised = true;
                        this.compromisedNodes.add(newTarget.id);
                    }
                }
            }

            this.eventBus.emit('red.post_exploit_result', {
                tick: tickNum, team: 'red', source: 'red_team',
                log: success
                    ? `POST-EXPLOIT: ${action.name} from ${action.sourceName} -- successful`
                    : `Post-exploitation failed: ${action.name} from ${action.sourceName}`,
                severity: success ? 'error' : 'warning',
                details: { action: action.name, source: action.sourceName, success },
                detectChance: action.detectChance
            });

            return { success, action: action.name, source: action.sourceName };
        }

        return { success: false };
    }

    getState() {
        return {
            phase: this.phase,
            compromisedNodes: [...this.compromisedNodes],
            discoveredNodes: [...this.discoveredNodes],
            discoveredVulns: this.discoveredVulns.length,
            totalAttacks: this.totalAttacks,
            successfulAttacks: this.successfulAttacks,
            activeAction: this.activeAction?.name || null,
            queueLength: this.actionQueue.length
        };
    }
}

export default RedTeamEngine;
export { ATTACK_PHASES };
