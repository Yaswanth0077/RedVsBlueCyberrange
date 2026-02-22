// Shared WebSocket message protocol between agents and dashboard

const MSG_TYPES = {
    // Connection
    HANDSHAKE: 'handshake',
    STATUS: 'status',
    HEARTBEAT: 'heartbeat',

    // Red Team
    ATTACK_START: 'attack_start',
    ATTACK_RESULT: 'attack_result',
    ATTACK_OUTPUT: 'attack_output',
    SCAN_RESULT: 'scan_result',

    // Blue Team
    LOG_EVENT: 'log_event',
    ALERT: 'alert',
    NETWORK_EVENT: 'network_event',
    FIREWALL_EVENT: 'firewall_event',
    SERVICE_STATUS: 'service_status',

    // Control
    COMMAND: 'command',
    RESPONSE: 'response'
};

const SEVERITY = {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical'
};

function createMessage(type, team, source, message, data = {}, severity = 'info') {
    return JSON.stringify({
        type,
        team,
        source,
        message,
        severity,
        data,
        timestamp: Date.now(),
        tick: Math.floor((Date.now() % 100000000) / 1000) // relative timestamp as tick
    });
}

function parseMessage(raw) {
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

// Export for both ESM and CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MSG_TYPES, SEVERITY, createMessage, parseMessage };
}

export { MSG_TYPES, SEVERITY, createMessage, parseMessage };
