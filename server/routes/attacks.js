import express from 'express';
import { attackManager } from '../engine/AttackManager.js';
import { authenticateToken, requireRole } from '../auth/authMiddleware.js';
import { ATTACK_DEFINITIONS } from '../attacks/AttackDefinitions.js';
import { idsEngine } from '../defense/IDSEngine.js';

const router = express.Router();

// Get all attack definitions (any authenticated user)
router.get('/definitions', authenticateToken, (req, res) => {
    res.json(ATTACK_DEFINITIONS);
});

// Get currently active attacks
router.get('/active', authenticateToken, (req, res) => {
    res.json(attackManager.getActiveAttacks());
});

// Get attack history
router.get('/history', authenticateToken, (req, res) => {
    res.json(attackManager.getHistory());
});

// Get defense status
router.get('/defense-status', authenticateToken, (req, res) => {
    res.json(idsEngine.getStatus());
});

// Start an attack (Red Team / Admin only)
router.post('/start', authenticateToken, requireRole(['RedTeam', 'Admin']), (req, res) => {
    const { attackId } = req.body;
    if (!attackId) return res.status(400).json({ error: 'attackId is required' });
    const result = attackManager.startAttack(attackId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
});

// Stop an attack (Red Team / Admin only)
router.post('/stop', authenticateToken, requireRole(['RedTeam', 'Admin']), (req, res) => {
    const { attackId } = req.body;
    if (!attackId) return res.status(400).json({ error: 'attackId is required' });
    const result = attackManager.stopAttack(attackId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
});

export default router;
