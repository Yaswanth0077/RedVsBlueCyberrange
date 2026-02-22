#!/usr/bin/env node
// ============================================================
// BLUE TEAM AGENT — Runs on Ubuntu Server (Defender)
// Monitors system logs, network, firewall, and services
// Usage: sudo node blue-agent.js --port 4002
// ============================================================

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// ---- Config ----
const args = process.argv.slice(2);
const getArg = (flag, def) => { const i = args.indexOf(flag); return i !== -1 && args[i + 1] ? args[i + 1] : def; };

const AGENT_PORT = parseInt(getArg('--port', '4002'));

const MSG_TYPES = {
    HANDSHAKE: 'handshake', STATUS: 'status', HEARTBEAT: 'heartbeat',
    LOG_EVENT: 'log_event', ALERT: 'alert', NETWORK_EVENT: 'network_event',
    FIREWALL_EVENT: 'firewall_event', SERVICE_STATUS: 'service_status',
    COMMAND: 'command'
};

// ---- WebSocket Server ----
let dashboardWs = null;
const wss = new WebSocket.Server({ port: AGENT_PORT });

console.log(`[BLUE AGENT] Starting on port ${AGENT_PORT}`);

wss.on('connection', (ws) => {
    console.log('[BLUE AGENT] Dashboard connected');
    dashboardWs = ws;

    send(MSG_TYPES.HANDSHAKE, 'Blue Team Agent connected', {
        agent: 'blue',
        hostname: getHostname(),
        services: getRunningServices(),
        firewallStatus: getFirewallStatus()
    });

    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw);
            if (msg.type === MSG_TYPES.COMMAND) handleCommand(msg);
        } catch (e) {
            console.error('[BLUE AGENT] Bad message:', e.message);
        }
    });

    ws.on('close', () => {
        console.log('[BLUE AGENT] Dashboard disconnected');
        dashboardWs = null;
    });
});

function send(type, message, data = {}, severity = 'info') {
    if (!dashboardWs || dashboardWs.readyState !== WebSocket.OPEN) return;
    dashboardWs.send(JSON.stringify({
        type, team: 'blue', source: 'blue_agent', message, severity, data,
        timestamp: Date.now()
    }));
}

// ---- System Info ----
function getHostname() {
    try { return execSync('hostname').toString().trim(); } catch { return 'unknown'; }
}

function getRunningServices() {
    try {
        const output = execSync('systemctl list-units --type=service --state=running --no-pager --plain 2>/dev/null | head -20').toString();
        return output.split('\n').filter(l => l.includes('.service')).map(l => l.trim().split(/\s+/)[0]);
    } catch { return []; }
}

function getFirewallStatus() {
    try {
        const output = execSync('sudo ufw status 2>/dev/null').toString();
        return output.includes('active') ? 'active' : 'inactive';
    } catch { return 'unknown'; }
}

function getActiveConnections() {
    try {
        const output = execSync('ss -tunap 2>/dev/null | grep ESTAB | head -20').toString();
        return output.split('\n').filter(Boolean).map(line => {
            const parts = line.trim().split(/\s+/);
            return { proto: parts[0], local: parts[4], remote: parts[5], process: parts[6] || '' };
        });
    } catch { return []; }
}

function getFail2banStatus() {
    try {
        const output = execSync('sudo fail2ban-client status 2>/dev/null').toString();
        const jails = output.match(/Jail list:\s+(.+)/);
        if (jails) {
            const jailNames = jails[1].split(',').map(j => j.trim());
            return jailNames.map(jail => {
                try {
                    const status = execSync(`sudo fail2ban-client status ${jail} 2>/dev/null`).toString();
                    const banned = status.match(/Currently banned:\s+(\d+)/);
                    const total = status.match(/Total banned:\s+(\d+)/);
                    return { jail, currentlyBanned: banned ? parseInt(banned[1]) : 0, totalBanned: total ? parseInt(total[1]) : 0 };
                } catch { return { jail, currentlyBanned: 0, totalBanned: 0 }; }
            });
        }
        return [];
    } catch { return []; }
}

// ---- Log Monitoring ----
const LOG_FILES = [
    {
        path: '/var/log/auth.log', source: 'auth', patterns: [
            { regex: /Failed password/i, severity: 'warning', type: 'brute_force' },
            { regex: /Accepted password/i, severity: 'info', type: 'login_success' },
            { regex: /Invalid user/i, severity: 'warning', type: 'invalid_user' },
            { regex: /session opened for user root/i, severity: 'critical', type: 'root_login' },
            { regex: /sudo:.+COMMAND/i, severity: 'warning', type: 'sudo_command' },
            { regex: /authentication failure/i, severity: 'warning', type: 'auth_failure' },
            { regex: /Connection closed by .+ \[preauth\]/i, severity: 'info', type: 'ssh_preauth_close' },
            { regex: /maximum authentication attempts/i, severity: 'error', type: 'max_auth_attempts' }
        ]
    },
    {
        path: '/var/log/syslog', source: 'syslog', patterns: [
            { regex: /segfault/i, severity: 'error', type: 'segfault' },
            { regex: /error/i, severity: 'warning', type: 'system_error' },
            { regex: /kernel.*UFW BLOCK/i, severity: 'warning', type: 'ufw_block' }
        ]
    },
    {
        path: '/var/log/ufw.log', source: 'ufw', patterns: [
            { regex: /\[UFW BLOCK\]/i, severity: 'warning', type: 'firewall_block' },
            { regex: /\[UFW ALLOW\]/i, severity: 'info', type: 'firewall_allow' }
        ]
    },
    {
        path: '/var/log/apache2/access.log', source: 'apache', patterns: [
            { regex: /\s(4\d{2})\s/i, severity: 'warning', type: 'http_error' },
            { regex: /\s(5\d{2})\s/i, severity: 'error', type: 'server_error' },
            { regex: /(\.\.\/|\.\.\\|etc\/passwd|union\s+select|<script)/i, severity: 'critical', type: 'attack_signature' },
            { regex: /(nikto|sqlmap|gobuster|dirb|hydra)/i, severity: 'critical', type: 'scanner_detected' }
        ]
    },
    {
        path: '/var/log/nginx/access.log', source: 'nginx', patterns: [
            { regex: /\s(4\d{2})\s/i, severity: 'warning', type: 'http_error' },
            { regex: /\s(5\d{2})\s/i, severity: 'error', type: 'server_error' },
            { regex: /(\.\.\/|\.\.\\|etc\/passwd|union\s+select|<script)/i, severity: 'critical', type: 'attack_signature' },
            { regex: /(nikto|sqlmap|gobuster|dirb|hydra)/i, severity: 'critical', type: 'scanner_detected' }
        ]
    }
];

const fileWatchers = [];
const fileSizes = {};

function startLogMonitoring() {
    LOG_FILES.forEach(logConfig => {
        if (!fs.existsSync(logConfig.path)) {
            console.log(`[BLUE AGENT] Log not found: ${logConfig.path} (skipping)`);
            return;
        }

        console.log(`[BLUE AGENT] Monitoring: ${logConfig.path}`);

        try {
            const stat = fs.statSync(logConfig.path);
            fileSizes[logConfig.path] = stat.size;
        } catch {
            fileSizes[logConfig.path] = 0;
        }

        // Use polling-based watch (works on all Linux)
        const watcher = setInterval(() => {
            try {
                const stat = fs.statSync(logConfig.path);
                const currentSize = stat.size;
                const prevSize = fileSizes[logConfig.path] || 0;

                if (currentSize > prevSize) {
                    // Read new content
                    const stream = fs.createReadStream(logConfig.path, {
                        start: prevSize,
                        end: currentSize,
                        encoding: 'utf8'
                    });

                    let newData = '';
                    stream.on('data', chunk => { newData += chunk; });
                    stream.on('end', () => {
                        const lines = newData.split('\n').filter(Boolean);
                        lines.forEach(line => processLogLine(line, logConfig));
                    });
                }

                fileSizes[logConfig.path] = currentSize;
            } catch (err) {
                // File might have been rotated
            }
        }, 1000); // check every second

        fileWatchers.push(watcher);
    });
}

function processLogLine(line, logConfig) {
    const trimmed = line.trim();
    if (!trimmed) return;

    for (const pattern of logConfig.patterns) {
        if (pattern.regex.test(trimmed)) {
            const msgType = pattern.severity === 'critical' || pattern.severity === 'error'
                ? MSG_TYPES.ALERT : MSG_TYPES.LOG_EVENT;

            send(msgType, `[${logConfig.source.toUpperCase()}] ${trimmed.substring(0, 300)}`, {
                source: logConfig.source,
                type: pattern.type,
                logFile: logConfig.path,
                raw: trimmed.substring(0, 500)
            }, pattern.severity);

            // Only match first (most severe) pattern
            return;
        }
    }

    // Log everything from auth.log even without pattern match
    if (logConfig.source === 'auth') {
        send(MSG_TYPES.LOG_EVENT, `[AUTH] ${trimmed.substring(0, 300)}`, {
            source: 'auth', type: 'general', raw: trimmed.substring(0, 500)
        }, 'info');
    }
}

// ---- Network Monitoring ----
let prevConnections = [];

function monitorConnections() {
    setInterval(() => {
        const current = getActiveConnections();
        const newConns = current.filter(c =>
            !prevConnections.some(p => p.remote === c.remote && p.local === c.local)
        );

        newConns.forEach(conn => {
            const remoteIP = conn.remote?.split(':')[0] || '';
            if (remoteIP && remoteIP !== '127.0.0.1' && remoteIP !== '::1') {
                send(MSG_TYPES.NETWORK_EVENT, `New connection: ${conn.remote} -> ${conn.local} (${conn.process})`, {
                    source: 'network', type: 'new_connection',
                    remoteIP, local: conn.local, process: conn.process
                }, 'info');
            }
        });

        prevConnections = current;
    }, 5000); // check every 5 seconds
}

// ---- Periodic Status Report ----
function startStatusReports() {
    setInterval(() => {
        const connections = getActiveConnections();
        const fail2ban = getFail2banStatus();
        const services = getRunningServices();

        send(MSG_TYPES.SERVICE_STATUS, `Status: ${connections.length} connections, ${services.length} services`, {
            connections: connections.length,
            services: services.length,
            fail2ban,
            firewall: getFirewallStatus()
        }, 'info');
    }, 15000); // every 15 seconds
}

// ---- Command Handler ----
function handleCommand(msg) {
    const cmd = msg.data?.command;
    console.log(`[BLUE AGENT] Received command: ${cmd}`);

    switch (cmd) {
        case 'status':
            send(MSG_TYPES.STATUS, 'Blue Agent status report', {
                hostname: getHostname(),
                services: getRunningServices(),
                connections: getActiveConnections().length,
                firewall: getFirewallStatus(),
                fail2ban: getFail2banStatus()
            });
            break;

        case 'block_ip':
            if (msg.data?.ip) {
                try {
                    execSync(`sudo ufw deny from ${msg.data.ip} 2>/dev/null`);
                    send(MSG_TYPES.FIREWALL_EVENT, `Blocked IP: ${msg.data.ip}`, {
                        action: 'block', ip: msg.data.ip
                    }, 'warning');
                } catch (e) {
                    send(MSG_TYPES.ALERT, `Failed to block IP: ${msg.data.ip} -- ${e.message}`, {}, 'error');
                }
            }
            break;

        case 'unblock_ip':
            if (msg.data?.ip) {
                try {
                    execSync(`sudo ufw delete deny from ${msg.data.ip} 2>/dev/null`);
                    send(MSG_TYPES.FIREWALL_EVENT, `Unblocked IP: ${msg.data.ip}`, {
                        action: 'unblock', ip: msg.data.ip
                    }, 'info');
                } catch (e) {
                    send(MSG_TYPES.ALERT, `Failed to unblock IP: ${msg.data.ip} -- ${e.message}`, {}, 'error');
                }
            }
            break;

        case 'close_port':
            if (msg.data?.port) {
                try {
                    const proto = (msg.data.protocol || 'tcp').toLowerCase();
                    execSync(`sudo ufw deny ${msg.data.port}/${proto} 2>/dev/null`);
                    send(MSG_TYPES.FIREWALL_EVENT, `Closed port ${msg.data.port}/${proto}`, {
                        action: 'block', port: msg.data.port, protocol: proto
                    }, 'warning');
                } catch (e) {
                    send(MSG_TYPES.ALERT, `Failed to close port ${msg.data.port} -- ${e.message}`, {}, 'error');
                }
            }
            break;

        case 'open_port':
            if (msg.data?.port) {
                try {
                    const proto = (msg.data.protocol || 'tcp').toLowerCase();
                    execSync(`sudo ufw allow ${msg.data.port}/${proto} 2>/dev/null`);
                    send(MSG_TYPES.FIREWALL_EVENT, `Opened port ${msg.data.port}/${proto}`, {
                        action: 'allow', port: msg.data.port, protocol: proto
                    }, 'info');
                } catch (e) {
                    send(MSG_TYPES.ALERT, `Failed to open port ${msg.data.port} -- ${e.message}`, {}, 'error');
                }
            }
            break;

        case 'list_rules':
            try {
                const output = execSync('sudo ufw status numbered 2>/dev/null').toString();
                const rules = output.split('\n').filter(l => l.match(/^\[\s*\d+\]/)).map(l => l.trim());
                send(MSG_TYPES.STATUS, `Firewall rules: ${rules.length} active`, {
                    rules, raw: output
                }, 'info');
            } catch (e) {
                send(MSG_TYPES.ALERT, `Failed to list rules -- ${e.message}`, {}, 'error');
            }
            break;

        case 'toggle_firewall':
            try {
                const enable = msg.data?.enable !== false;
                if (enable) {
                    execSync('echo "y" | sudo ufw enable 2>/dev/null');
                    send(MSG_TYPES.FIREWALL_EVENT, 'Firewall enabled', { action: 'enable' }, 'info');
                } else {
                    execSync('sudo ufw disable 2>/dev/null');
                    send(MSG_TYPES.FIREWALL_EVENT, 'Firewall disabled', { action: 'disable' }, 'warning');
                }
            } catch (e) {
                send(MSG_TYPES.ALERT, `Failed to toggle firewall -- ${e.message}`, {}, 'error');
            }
            break;

        case 'enable_enhanced_logging':
            send(MSG_TYPES.STATUS, 'Enhanced logging enabled', {}, 'info');
            break;

        default:
            send(MSG_TYPES.STATUS, `Unknown command: ${cmd}`, {}, 'warning');
    }
}

// ---- Heartbeat ----
setInterval(() => {
    send(MSG_TYPES.HEARTBEAT, 'alive', { hostname: getHostname() });
}, 10000);

// ---- Start Everything ----
startLogMonitoring();
monitorConnections();
startStatusReports();

console.log(`[BLUE AGENT] Ready. Waiting for dashboard connection on port ${AGENT_PORT}...`);
console.log(`[BLUE AGENT] Monitoring ${LOG_FILES.filter(l => fs.existsSync(l.path)).length} log files`);
