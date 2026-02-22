// Scenarios — Pre-built simulation configurations

export const SCENARIOS = [
    {
        id: 'apt_attack',
        name: 'APT Attack',
        description: 'Advanced Persistent Threat targeting enterprise network. Multi-stage attack with sophisticated reconnaissance, targeted exploitation, and stealthy lateral movement.',
        topology: 'enterprise',
        difficulty: 'hard',
        duration: 120,
        icon: 'APT',
        tags: ['advanced', 'stealth', 'multi-stage'],
        config: {
            redSpeed: 1.0,
            blueDetectionBase: 0.4,
            monitoringLevel: 'standard',
            scoringWeights: {
                detectionLatency: 0.35,
                responseAccuracy: 0.25,
                containmentEffectiveness: 0.25,
                recoveryTime: 0.15
            }
        }
    },
    {
        id: 'ransomware',
        name: 'Ransomware Outbreak',
        description: 'Fast-spreading ransomware attack against small office network. Focus on quick detection and containment before encryption spreads.',
        topology: 'small_office',
        difficulty: 'medium',
        duration: 80,
        icon: 'RAN',
        tags: ['fast', 'destructive', 'containment'],
        config: {
            redSpeed: 1.5,
            blueDetectionBase: 0.55,
            monitoringLevel: 'enhanced',
            scoringWeights: {
                detectionLatency: 0.3,
                responseAccuracy: 0.2,
                containmentEffectiveness: 0.35,
                recoveryTime: 0.15
            }
        }
    },
    {
        id: 'insider_threat',
        name: 'Insider Threat',
        description: 'Compromised insider with legitimate credentials operating within DMZ network. Subtle activity requiring behavioral analysis detection.',
        topology: 'dmz_network',
        difficulty: 'expert',
        duration: 100,
        icon: 'INT',
        tags: ['stealth', 'insider', 'behavioral'],
        config: {
            redSpeed: 0.8,
            blueDetectionBase: 0.3,
            monitoringLevel: 'standard',
            scoringWeights: {
                detectionLatency: 0.4,
                responseAccuracy: 0.3,
                containmentEffectiveness: 0.15,
                recoveryTime: 0.15
            }
        }
    },
    {
        id: 'supply_chain',
        name: 'Supply Chain Attack',
        description: 'Attack through compromised third-party software update in enterprise environment. Tests deep inspection and verification capabilities.',
        topology: 'enterprise',
        difficulty: 'expert',
        duration: 140,
        icon: 'SCA',
        tags: ['supply-chain', 'sophisticated', 'multi-vector'],
        config: {
            redSpeed: 0.7,
            blueDetectionBase: 0.35,
            monitoringLevel: 'standard',
            scoringWeights: {
                detectionLatency: 0.3,
                responseAccuracy: 0.3,
                containmentEffectiveness: 0.2,
                recoveryTime: 0.2
            }
        }
    },
    {
        id: 'training_basic',
        name: 'Training — Basics',
        description: 'Introductory scenario for new analysts. Simple attack patterns with high-visibility indicators. Perfect for learning the platform.',
        topology: 'small_office',
        difficulty: 'easy',
        duration: 60,
        icon: 'TRN',
        tags: ['training', 'beginner', 'guided'],
        config: {
            redSpeed: 0.6,
            blueDetectionBase: 0.7,
            monitoringLevel: 'maximum',
            scoringWeights: {
                detectionLatency: 0.25,
                responseAccuracy: 0.25,
                containmentEffectiveness: 0.25,
                recoveryTime: 0.25
            }
        }
    }
];

export function getScenario(id) {
    return SCENARIOS.find(s => s.id === id) || SCENARIOS[0];
}
