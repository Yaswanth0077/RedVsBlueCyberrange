import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { setIO } from './utils/socketManager.js';
import { logStore } from './utils/LogStore.js';
import authRoutes from './routes/auth.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Set shared io reference before any module imports it
setIO(io);

app.use(cors());
app.use(express.json());

// Auth routes
app.use('/api/auth', authRoutes);

// Lazy-load attack routes (avoid circular deps — they import AttackManager which imports socketManager)
import('./engine/AttackManager.js').then(({ attackManager }) => {
    import('./defense/IDSEngine.js').then(({ idsEngine }) => {
        import('./engine/AttackManager.js').then(({ setIDSRef }) => {
            setIDSRef(idsEngine);
        });

        import('./routes/attacks.js').then(mod => {
            app.use('/api/attacks', mod.default);
            console.log('[BACKEND] Attack routes mounted');
        });
    });
});

// ---- API: Persistent Logs ----
app.get('/api/logs', (req, res) => {
    const filters = {};
    if (req.query.type) filters.attackType = req.query.type;
    if (req.query.result) filters.result = req.query.result;
    if (req.query.severity) filters.severity = req.query.severity;
    if (req.query.startDate) filters.startDate = parseInt(req.query.startDate);
    if (req.query.endDate) filters.endDate = parseInt(req.query.endDate);
    if (req.query.limit) filters.limit = parseInt(req.query.limit);
    res.json(logStore.queryLogs(filters));
});

// ---- API: Scores ----
app.get('/api/scores', (req, res) => res.json(logStore.getScores()));

// ---- API: Metrics ----
app.get('/api/metrics', (req, res) => res.json(logStore.getMetrics()));

// ---- API: Report ----
app.get('/api/report', (req, res) => res.json(logStore.getReport()));

// ---- API: System Health + Network State ----
app.get('/api/health', async (req, res) => {
    const { attackManager } = await import('./engine/AttackManager.js');
    const { idsEngine } = await import('./defense/IDSEngine.js');
    res.json({
        systemHealth: attackManager.getSystemHealth(),
        threatScore: idsEngine.threatScore,
        activeAttacks: attackManager.getActiveAttacks().length,
        blockedIPs: [...idsEngine.blockedIPs]
    });
});

// ---- Socket.io ----
io.on('connection', (socket) => {
    console.log('[BACKEND] Client connected:', socket.id);

    // Send initial state on connect
    socket.emit('initial_state', {
        scores: logStore.getScores(),
        report: logStore.getReport(),
        metrics: logStore.getMetrics(),
        recentLogs: logStore.queryLogs({ limit: 50 })
    });

    socket.on('join_role', (role) => {
        socket.join(role);
        console.log(`[BACKEND] ${socket.id} joined role: ${role}`);
    });

    socket.on('request_report', () => {
        socket.emit('report_update', logStore.getReport());
    });

    socket.on('request_scores', () => {
        socket.emit('scores_update', logStore.getScores());
    });

    socket.on('disconnect', () => {
        console.log('[BACKEND] Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`[BACKEND] Server on http://localhost:${PORT}`);
    console.log(`[BACKEND] APIs: /api/attacks/definitions, /api/logs, /api/scores, /api/report, /api/health`);
});

export { io };
