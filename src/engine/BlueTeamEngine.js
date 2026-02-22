// BlueTeamEngine — Monitoring, detection, incident response, and mitigation

const DETECTION_METHODS = {
    SIGNATURE: 'signature',
    ANOMALY: 'anomaly',
    HEURISTIC: 'heuristic',
    BEHAVIORAL: 'behavioral'
};

const RESPONSE_STATUS = {
    DETECTED: 'detected',
    TRIAGED: 'triaged',
    CONTAINED: 'contained',
    REMEDIATED: 'remediated',
    CLOSED: 'closed'
};

const IDS_RULES = [
    { name: 'Suspicious Port Scan', pattern: 'Port Scan', severity: 'medium', method: DETECTION_METHODS.SIGNATURE },
    { name: 'Brute Force Attempt', pattern: 'Brute Force', severity: 'high', method: DETECTION_METHODS.BEHAVIORAL },
    { name: 'SQL Injection Detected', pattern: 'SQL Injection', severity: 'critical', method: DETECTION_METHODS.SIGNATURE },
    { name: 'Abnormal Network Traffic', pattern: 'Sweep', severity: 'low', method: DETECTION_METHODS.ANOMALY },
    { name: 'Privilege Escalation Alert', pattern: 'Privilege Escalation', severity: 'critical', method: DETECTION_METHODS.BEHAVIORAL },
    { name: 'Lateral Movement Detected', pattern: 'Lateral Movement', severity: 'critical', method: DETECTION_METHODS.HEURISTIC },
    { name: 'Data Exfiltration Alert', pattern: 'Exfiltration', severity: 'critical', method: DETECTION_METHODS.ANOMALY },
    { name: 'Malware Signature Match', pattern: 'Payload', severity: 'high', method: DETECTION_METHODS.SIGNATURE },
    { name: 'Ransomware Behavior', pattern: 'Ransomware', severity: 'critical', method: DETECTION_METHODS.BEHAVIORAL },
    { name: 'Unauthorized Access Attempt', pattern: 'Exploit', severity: 'high', method: DETECTION_METHODS.HEURISTIC },
    { name: 'Credential Dump Detected', pattern: 'Credential Harvesting', severity: 'critical', method: DETECTION_METHODS.BEHAVIORAL },
    { name: 'Web Shell Activity', pattern: 'Web Shell', severity: 'high', method: DETECTION_METHODS.SIGNATURE },
    { name: 'DNS Anomaly', pattern: 'DNS Enumeration', severity: 'low', method: DETECTION_METHODS.ANOMALY },
    { name: 'Persistence Mechanism', pattern: 'Persistence', severity: 'high', method: DETECTION_METHODS.HEURISTIC }
];

const RESPONSE_ACTIONS = [
    { name: 'Isolate Host', type: 'containment', duration: 2, effectiveness: 0.85 },
    { name: 'Block IP Address', type: 'containment', duration: 1, effectiveness: 0.7 },
    { name: 'Kill Process', type: 'containment', duration: 1, effectiveness: 0.6 },
    { name: 'Apply Emergency Patch', type: 'remediation', duration: 4, effectiveness: 0.8 },
    { name: 'Reset Credentials', type: 'remediation', duration: 2, effectiveness: 0.75 },
    { name: 'Restore from Backup', type: 'recovery', duration: 6, effectiveness: 0.9 },
    { name: 'Reconfigure Firewall', type: 'remediation', duration: 3, effectiveness: 0.8 },
    { name: 'Deploy YARA Rules', type: 'detection', duration: 2, effectiveness: 0.65 },
    { name: 'Enable Enhanced Logging', type: 'detection', duration: 1, effectiveness: 0.5 }
];

class BlueTeamEngine {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.alerts = [];
        this.incidents = [];
        this.incidentIdCounter = 0;
        this.detectionRate = 0.5; // base detection rate
        this.siemEnabled = true;
        this.activeResponses = [];
        this.resolvedIncidents = 0;
        this.totalDetections = 0;
        this.falsePositives = 0;
        this.monitoringLevel = 'standard'; // standard, enhanced, maximum
        this.firewallRules = [];
        this.firewallBlocked = [];

        this._setupListeners();
    }

    addFirewallRule(rule) {
        this.firewallRules.push(rule);
    }

    removeFirewallRule(id) {
        this.firewallRules = this.firewallRules.filter(r => r.id !== id);
    }

    getFirewallState() {
        return {
            rules: [...this.firewallRules],
            blocked: [...this.firewallBlocked],
            enabled: this.firewallRules.length > 0
        };
    }

    _setupListeners() {
        this.eventBus.on('*', (event) => {
            if (event.team === 'red' && event.detectChance !== undefined) {
                // Check firewall rules first
                const blocked = this._checkFirewallRules(event);
                if (blocked) return; // Attack blocked by firewall
                this._attemptDetection(event);
            }
        });
    }

    _checkFirewallRules(event) {
        if (this.firewallRules.length === 0) return false;

        const blockRules = this.firewallRules.filter(r => r.action === 'Block');
        for (const rule of blockRules) {
            const ipMatch = rule.ip === '*' || (event.details?.source && event.details.source.includes(rule.ip));
            const portMatch = rule.port === '*' || (event.details?.port && String(event.details.port) === String(rule.port));

            if (ipMatch || portMatch) {
                this.firewallBlocked.push({
                    id: Date.now() + Math.random(),
                    timestamp: Date.now(),
                    tick: event.tick,
                    sourceIP: event.details?.source || 'attacker',
                    port: rule.port,
                    protocol: rule.protocol || 'TCP',
                    reason: `Firewall rule: ${rule.action} IP:${rule.ip} Port:${rule.port}`
                });

                this.eventBus.emit('blue.firewall_block', {
                    tick: event.tick, team: 'blue', source: 'firewall',
                    log: `FIREWALL BLOCK: ${event.log || event.event} -- Rule: ${rule.action} IP:${rule.ip} Port:${rule.port}`,
                    severity: 'warning',
                    details: { ruleId: rule.id, blockedEvent: event.event }
                });

                this.totalDetections++;
                return true;
            }
        }
        return false;
    }




    _attemptDetection(event) {
        let detectChance = event.detectChance * this.detectionRate;
        if (this.monitoringLevel === 'enhanced') detectChance *= 1.3;
        if (this.monitoringLevel === 'maximum') detectChance *= 1.6;

        // Check IDS rules
        const matchingRule = IDS_RULES.find(rule =>
            event.log && event.log.includes(rule.pattern)
        );

        if (matchingRule) detectChance += 0.15;

        const detected = Math.random() < detectChance;

        if (detected) {
            this.totalDetections++;
            const alert = {
                id: ++this.incidentIdCounter,
                tick: event.tick,
                timestamp: Date.now(),
                detectedEvent: event.event,
                severity: matchingRule?.severity || 'medium',
                method: matchingRule?.method || DETECTION_METHODS.ANOMALY,
                rule: matchingRule?.name || 'Anomaly Detection',
                message: event.log,
                details: event.details
            };

            this.alerts.push(alert);

            // Create incident
            const incident = {
                id: alert.id,
                tick: event.tick,
                detectedAt: event.tick,
                status: RESPONSE_STATUS.DETECTED,
                severity: alert.severity,
                title: matchingRule?.name || 'Suspicious Activity Detected',
                description: event.log,
                method: alert.method,
                responseActions: [],
                timeline: [{ tick: event.tick, status: RESPONSE_STATUS.DETECTED, action: 'Alert generated' }],
                containedAt: null,
                remediatedAt: null,
                closedAt: null,
                targetNodeId: event.details?.target || event.details?.source || null
            };

            this.incidents.push(incident);

            this.eventBus.emit('blue.detection', {
                tick: event.tick, team: 'blue', source: 'siem',
                log: `ALERT: ${alert.rule} -- ${alert.severity.toUpperCase()} severity [${alert.method}]`,
                severity: alert.severity === 'critical' ? 'error' : 'warning',
                details: { alertId: alert.id, rule: alert.rule, method: alert.method }
            });
        }
    }

    tick(tickNum, topology) {
        const events = [];

        // Process active responses
        this.activeResponses = this.activeResponses.filter(resp => {
            resp.ticksRemaining--;
            if (resp.ticksRemaining <= 0) {
                this._resolveResponse(resp, tickNum, topology);
                return false;
            }
            return true;
        });

        // Auto-triage detected incidents
        this.incidents.forEach(incident => {
            if (incident.status === RESPONSE_STATUS.DETECTED && tickNum - incident.detectedAt >= 2) {
                incident.status = RESPONSE_STATUS.TRIAGED;
                incident.timeline.push({ tick: tickNum, status: RESPONSE_STATUS.TRIAGED, action: 'Incident triaged by SOC analyst' });

                this.eventBus.emit('blue.triage', {
                    tick: tickNum, team: 'blue', source: 'soc',
                    log: `Incident #${incident.id} triaged: ${incident.title}`,
                    severity: 'info',
                    details: { incidentId: incident.id }
                });

                // Auto-initiate response
                this._initiateResponse(incident, tickNum, topology);
            }
        });

        // Periodic monitoring logs
        if (tickNum % 5 === 0) {
            const compromisedCount = topology.nodes.filter(n => n.compromised).length;
            const isolatedCount = topology.nodes.filter(n => n.isolated).length;
            this.eventBus.emit('blue.monitoring', {
                tick: tickNum, team: 'blue', source: 'monitoring',
                log: `Status: ${compromisedCount} compromised, ${isolatedCount} isolated, ${this.incidents.filter(i => i.status !== RESPONSE_STATUS.CLOSED).length} open incidents`,
                severity: 'info'
            });
        }

        return events;
    }

    _initiateResponse(incident, tickNum, topology) {
        // Choose appropriate response based on severity
        let actions = [];

        if (incident.severity === 'critical') {
            actions = RESPONSE_ACTIONS.filter(a => a.type === 'containment').slice(0, 2);
            actions.push(...RESPONSE_ACTIONS.filter(a => a.type === 'remediation').slice(0, 1));
        } else if (incident.severity === 'high') {
            actions = RESPONSE_ACTIONS.filter(a => a.type === 'containment').slice(0, 1);
            actions.push(...RESPONSE_ACTIONS.filter(a => a.type === 'remediation').slice(0, 1));
        } else {
            actions = [RESPONSE_ACTIONS.find(a => a.type === 'detection')];
        }

        actions.filter(Boolean).forEach(action => {
            const response = {
                incidentId: incident.id,
                action: action.name,
                type: action.type,
                ticksRemaining: action.duration,
                effectiveness: action.effectiveness,
                startTick: tickNum,
                targetNodeId: incident.targetNodeId
            };

            this.activeResponses.push(response);
            incident.responseActions.push({ action: action.name, type: action.type, startedAt: tickNum });

            this.eventBus.emit('blue.response_start', {
                tick: tickNum, team: 'blue', source: 'ir_team',
                log: `Initiating response: ${action.name} for Incident #${incident.id}`,
                severity: 'info',
                details: { incidentId: incident.id, action: action.name, type: action.type }
            });
        });
    }

    _resolveResponse(response, tickNum, topology) {
        const success = Math.random() < response.effectiveness;
        const incident = this.incidents.find(i => i.id === response.incidentId);

        if (success && response.type === 'containment') {
            // Isolate the compromised node
            if (response.targetNodeId) {
                const node = topology.nodes.find(n => n.id === response.targetNodeId);
                if (node) {
                    node.isolated = true;
                    node.compromised = false;
                }
            }

            if (incident && incident.status !== RESPONSE_STATUS.CONTAINED) {
                incident.status = RESPONSE_STATUS.CONTAINED;
                incident.containedAt = tickNum;
                incident.timeline.push({ tick: tickNum, status: RESPONSE_STATUS.CONTAINED, action: response.action });
            }

            this.eventBus.emit('blue.containment', {
                tick: tickNum, team: 'blue', source: 'ir_team',
                log: `Containment successful: ${response.action} -- Incident #${response.incidentId}`,
                severity: 'info',
                details: { incidentId: response.incidentId, action: response.action, success: true }
            });
        }

        if (success && response.type === 'remediation') {
            if (response.targetNodeId) {
                const node = topology.nodes.find(n => n.id === response.targetNodeId);
                if (node) {
                    node.patchLevel = 'current';
                    node.vulnerabilities = [];
                }
            }

            if (incident) {
                incident.status = RESPONSE_STATUS.REMEDIATED;
                incident.remediatedAt = tickNum;
                incident.timeline.push({ tick: tickNum, status: RESPONSE_STATUS.REMEDIATED, action: response.action });
            }

            this.eventBus.emit('blue.remediation', {
                tick: tickNum, team: 'blue', source: 'ir_team',
                log: `Remediation complete: ${response.action} -- Incident #${response.incidentId}`,
                severity: 'info',
                details: { incidentId: response.incidentId, action: response.action, success: true }
            });
        }

        if (success && response.type === 'recovery') {
            if (response.targetNodeId) {
                const node = topology.nodes.find(n => n.id === response.targetNodeId);
                if (node) {
                    node.status = 'online';
                    node.isolated = false;
                    node.compromised = false;
                }
            }

            if (incident) {
                incident.status = RESPONSE_STATUS.CLOSED;
                incident.closedAt = tickNum;
                incident.timeline.push({ tick: tickNum, status: RESPONSE_STATUS.CLOSED, action: response.action });
                this.resolvedIncidents++;
            }

            this.eventBus.emit('blue.recovery', {
                tick: tickNum, team: 'blue', source: 'ir_team',
                log: `Recovery complete: ${response.action} -- Incident #${response.incidentId} CLOSED`,
                severity: 'info',
                details: { incidentId: response.incidentId, action: response.action, success: true }
            });
        }

        if (!success) {
            this.eventBus.emit('blue.response_failed', {
                tick: tickNum, team: 'blue', source: 'ir_team',
                log: `Response failed: ${response.action} -- Incident #${response.incidentId}`,
                severity: 'warning',
                details: { incidentId: response.incidentId, action: response.action, success: false }
            });
        }
    }

    // Auto-close remediated incidents after delay
    closeRemediated(tickNum) {
        this.incidents.forEach(incident => {
            if (incident.status === RESPONSE_STATUS.REMEDIATED && tickNum - incident.remediatedAt >= 3) {
                incident.status = RESPONSE_STATUS.CLOSED;
                incident.closedAt = tickNum;
                incident.timeline.push({ tick: tickNum, status: RESPONSE_STATUS.CLOSED, action: 'Incident closed after verification' });
                this.resolvedIncidents++;
            }
        });
    }

    setMonitoringLevel(level) {
        this.monitoringLevel = level;
    }

    getState() {
        return {
            totalDetections: this.totalDetections,
            openIncidents: this.incidents.filter(i => i.status !== RESPONSE_STATUS.CLOSED).length,
            resolvedIncidents: this.resolvedIncidents,
            alerts: [...this.alerts],
            incidents: [...this.incidents],
            activeResponses: this.activeResponses.length,
            monitoringLevel: this.monitoringLevel
        };
    }
}

export default BlueTeamEngine;
export { RESPONSE_STATUS, DETECTION_METHODS };
