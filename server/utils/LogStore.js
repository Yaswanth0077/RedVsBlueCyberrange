import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const LOGS_FILE = path.join(DATA_DIR, 'attack_logs.json');
const SCORES_FILE = path.join(DATA_DIR, 'scores.json');
const METRICS_FILE = path.join(DATA_DIR, 'metrics.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readJSON(file, fallback) {
    try {
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch { }
    return fallback;
}

function writeJSON(file, data) {
    try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch (e) { console.error('[LogStore] Write error:', e.message); }
}

class LogStore {
    constructor() {
        this.logs = readJSON(LOGS_FILE, []);
        this.scores = readJSON(SCORES_FILE, { red: 0, blue: 0, history: [] });
        this.metrics = readJSON(METRICS_FILE, {
            totalAttacks: 0, successfulAttacks: 0, blockedAttacks: 0,
            totalDetections: 0, avgSystemHealth: 100, attackTypes: {},
            healthHistory: [], threatHistory: []
        });
        this._dirty = false;
        // Auto-flush every 2 seconds
        setInterval(() => this.flush(), 2000);
    }

    addLog(logEntry) {
        const entry = {
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            ...logEntry,
            timestamp: logEntry.timestamp || Date.now()
        };
        this.logs.push(entry);
        this._dirty = true;

        // Update metrics
        this.metrics.totalAttacks++;
        this.metrics.attackTypes[entry.attackName] = (this.metrics.attackTypes[entry.attackName] || 0) + 1;

        return entry;
    }

    updateLog(logId, updates) {
        const log = this.logs.find(l => l.id === logId);
        if (log) {
            Object.assign(log, updates, { updatedAt: Date.now() });
            if (updates.result === 'Success') this.metrics.successfulAttacks++;
            if (updates.result === 'Blocked' || updates.result === 'Failed') this.metrics.blockedAttacks++;
            if (updates.detected) this.metrics.totalDetections++;
            this._dirty = true;
        }
        return log;
    }

    updateScores(redDelta, blueDelta, reason) {
        this.scores.red += redDelta;
        this.scores.blue += blueDelta;
        this.scores.history.push({ red: this.scores.red, blue: this.scores.blue, reason, timestamp: Date.now() });
        // Keep last 500 entries
        if (this.scores.history.length > 500) this.scores.history = this.scores.history.slice(-500);
        this._dirty = true;
    }

    addHealthSnapshot(health, threatLevel) {
        this.metrics.healthHistory.push({ health, timestamp: Date.now() });
        this.metrics.threatHistory.push({ threat: threatLevel, timestamp: Date.now() });
        if (this.metrics.healthHistory.length > 500) this.metrics.healthHistory = this.metrics.healthHistory.slice(-500);
        if (this.metrics.threatHistory.length > 500) this.metrics.threatHistory = this.metrics.threatHistory.slice(-500);
        this.metrics.avgSystemHealth = Math.round(
            this.metrics.healthHistory.slice(-20).reduce((s, h) => s + h.health, 0) /
            Math.min(20, this.metrics.healthHistory.length)
        );
        this._dirty = true;
    }

    queryLogs(filters = {}) {
        let result = [...this.logs];
        if (filters.attackType) result = result.filter(l => l.attackName === filters.attackType);
        if (filters.result) result = result.filter(l => l.result === filters.result);
        if (filters.severity) result = result.filter(l => l.impactLevel === filters.severity);
        if (filters.startDate) result = result.filter(l => l.timestamp >= filters.startDate);
        if (filters.endDate) result = result.filter(l => l.timestamp <= filters.endDate);
        if (filters.limit) result = result.slice(-filters.limit);
        return result;
    }

    getScores() { return { ...this.scores }; }
    getMetrics() { return { ...this.metrics }; }

    getReport() {
        const logs = this.logs;
        const total = logs.length;
        const successful = logs.filter(l => l.result === 'Success').length;
        const detected = logs.filter(l => l.detected).length;
        const typeCount = {};
        logs.forEach(l => { typeCount[l.attackName] = (typeCount[l.attackName] || 0) + 1; });
        const topTypes = Object.entries(typeCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

        return {
            totalAttacks: total,
            successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
            detectionRate: total > 0 ? Math.round((detected / total) * 100) : 0,
            topAttackTypes: topTypes.map(([name, count]) => ({ name, count })),
            avgSystemHealth: this.metrics.avgSystemHealth,
            scores: this.getScores(),
            healthHistory: this.metrics.healthHistory.slice(-50),
            threatHistory: this.metrics.threatHistory.slice(-50),
            attackTimeline: logs.slice(-30).map(l => ({
                id: l.id, name: l.attackName, result: l.result, detected: l.detected,
                timestamp: l.timestamp, impactLevel: l.impactLevel
            }))
        };
    }

    flush() {
        if (!this._dirty) return;
        writeJSON(LOGS_FILE, this.logs.slice(-1000));
        writeJSON(SCORES_FILE, this.scores);
        writeJSON(METRICS_FILE, this.metrics);
        this._dirty = false;
    }

    clearAll() {
        this.logs = [];
        this.scores = { red: 0, blue: 0, history: [] };
        this.metrics = {
            totalAttacks: 0, successfulAttacks: 0, blockedAttacks: 0,
            totalDetections: 0, avgSystemHealth: 100, attackTypes: {},
            healthHistory: [], threatHistory: []
        };
        this._dirty = true;
        this.flush();
    }
}

export const logStore = new LogStore();
