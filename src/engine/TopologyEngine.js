// TopologyEngine — Configurable network topologies

const NODE_TYPES = {
    ROUTER: 'router',
    FIREWALL: 'firewall',
    SERVER: 'server',
    WORKSTATION: 'workstation',
    DATABASE: 'database',
    WAP: 'wireless_ap'
};

const OS_TYPES = ['Linux', 'Windows Server 2019', 'Windows 10', 'Ubuntu 22.04', 'CentOS 8', 'pfSense'];

const SERVICE_CATALOG = [
    { name: 'SSH', port: 22, vulnChance: 0.2 },
    { name: 'HTTP', port: 80, vulnChance: 0.3 },
    { name: 'HTTPS', port: 443, vulnChance: 0.15 },
    { name: 'FTP', port: 21, vulnChance: 0.4 },
    { name: 'SMB', port: 445, vulnChance: 0.35 },
    { name: 'RDP', port: 3389, vulnChance: 0.3 },
    { name: 'MySQL', port: 3306, vulnChance: 0.25 },
    { name: 'DNS', port: 53, vulnChance: 0.1 },
    { name: 'SMTP', port: 25, vulnChance: 0.2 },
    { name: 'PostgreSQL', port: 5432, vulnChance: 0.2 }
];

const VULNERABILITY_CATALOG = [
    { id: 'CVE-2024-0001', name: 'Remote Code Execution in SSH', severity: 'critical', cvss: 9.8 },
    { id: 'CVE-2024-0002', name: 'SQL Injection in Web App', severity: 'high', cvss: 8.5 },
    { id: 'CVE-2024-0003', name: 'Buffer Overflow in FTP', severity: 'critical', cvss: 9.1 },
    { id: 'CVE-2024-0004', name: 'Privilege Escalation via SMB', severity: 'high', cvss: 8.0 },
    { id: 'CVE-2024-0005', name: 'Weak Credentials on RDP', severity: 'medium', cvss: 6.5 },
    { id: 'CVE-2024-0006', name: 'Directory Traversal in HTTP', severity: 'high', cvss: 7.5 },
    { id: 'CVE-2024-0007', name: 'Outdated TLS Configuration', severity: 'medium', cvss: 5.9 },
    { id: 'CVE-2024-0008', name: 'Default Credentials on DB', severity: 'critical', cvss: 9.0 },
    { id: 'CVE-2024-0009', name: 'Cross-Site Scripting in HTTPS', severity: 'medium', cvss: 6.1 },
    { id: 'CVE-2024-0010', name: 'DNS Zone Transfer Allowed', severity: 'low', cvss: 4.3 }
];

function generateIP(subnet, index) {
    return `${subnet}.${index + 10}`;
}

function generateNode(id, type, subnet, index, name) {
    const services = [];
    const vulns = [];

    const serviceCount = type === NODE_TYPES.SERVER ? 3 + Math.floor(Math.random() * 3)
        : type === NODE_TYPES.DATABASE ? 2
            : type === NODE_TYPES.WORKSTATION ? 1 + Math.floor(Math.random() * 2)
                : 1;

    const shuffled = [...SERVICE_CATALOG].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(serviceCount, shuffled.length); i++) {
        const svc = shuffled[i];
        services.push({ name: svc.name, port: svc.port, status: 'running' });
        if (Math.random() < svc.vulnChance) {
            const vuln = VULNERABILITY_CATALOG[Math.floor(Math.random() * VULNERABILITY_CATALOG.length)];
            vulns.push({ ...vuln, service: svc.name });
        }
    }

    return {
        id,
        name,
        type,
        ip: generateIP(subnet, index),
        os: OS_TYPES[Math.floor(Math.random() * OS_TYPES.length)],
        services,
        vulnerabilities: vulns,
        status: 'online',
        compromised: false,
        isolated: false,
        alerts: [],
        patchLevel: Math.random() > 0.5 ? 'current' : 'outdated'
    };
}

export function createTopology(preset = 'enterprise') {
    const topologies = {
        small_office: () => {
            const nodes = [
                generateNode('router-1', NODE_TYPES.ROUTER, '192.168.1', 0, 'Gateway Router'),
                generateNode('fw-1', NODE_TYPES.FIREWALL, '192.168.1', 1, 'Perimeter Firewall'),
                generateNode('srv-web', NODE_TYPES.SERVER, '192.168.1', 2, 'Web Server'),
                generateNode('srv-file', NODE_TYPES.SERVER, '192.168.1', 3, 'File Server'),
                generateNode('ws-1', NODE_TYPES.WORKSTATION, '192.168.1', 4, 'Workstation Alpha'),
                generateNode('ws-2', NODE_TYPES.WORKSTATION, '192.168.1', 5, 'Workstation Beta'),
                generateNode('db-1', NODE_TYPES.DATABASE, '192.168.1', 6, 'Database Server')
            ];
            const connections = [
                ['router-1', 'fw-1'],
                ['fw-1', 'srv-web'], ['fw-1', 'srv-file'], ['fw-1', 'db-1'],
                ['srv-file', 'ws-1'], ['srv-file', 'ws-2'],
                ['srv-web', 'db-1']
            ];
            return { nodes, connections };
        },

        enterprise: () => {
            const nodes = [
                // DMZ
                generateNode('router-ext', NODE_TYPES.ROUTER, '10.0.1', 0, 'External Router'),
                generateNode('fw-ext', NODE_TYPES.FIREWALL, '10.0.1', 1, 'External Firewall'),
                generateNode('srv-web1', NODE_TYPES.SERVER, '10.0.1', 2, 'Web Server 1'),
                generateNode('srv-web2', NODE_TYPES.SERVER, '10.0.1', 3, 'Web Server 2'),
                generateNode('srv-mail', NODE_TYPES.SERVER, '10.0.1', 4, 'Mail Server'),
                generateNode('srv-dns', NODE_TYPES.SERVER, '10.0.1', 5, 'DNS Server'),
                // Internal
                generateNode('fw-int', NODE_TYPES.FIREWALL, '10.0.2', 0, 'Internal Firewall'),
                generateNode('srv-ad', NODE_TYPES.SERVER, '10.0.2', 1, 'Active Directory'),
                generateNode('srv-file', NODE_TYPES.SERVER, '10.0.2', 2, 'File Server'),
                generateNode('db-primary', NODE_TYPES.DATABASE, '10.0.2', 3, 'Primary Database'),
                generateNode('db-backup', NODE_TYPES.DATABASE, '10.0.2', 4, 'Backup Database'),
                generateNode('ws-admin', NODE_TYPES.WORKSTATION, '10.0.2', 5, 'Admin Workstation'),
                generateNode('ws-dev1', NODE_TYPES.WORKSTATION, '10.0.2', 6, 'Dev Workstation 1'),
                generateNode('ws-dev2', NODE_TYPES.WORKSTATION, '10.0.2', 7, 'Dev Workstation 2'),
                generateNode('ws-hr', NODE_TYPES.WORKSTATION, '10.0.2', 8, 'HR Workstation'),
                generateNode('wap-1', NODE_TYPES.WAP, '10.0.2', 9, 'Wireless AP')
            ];
            const connections = [
                ['router-ext', 'fw-ext'],
                ['fw-ext', 'srv-web1'], ['fw-ext', 'srv-web2'], ['fw-ext', 'srv-mail'], ['fw-ext', 'srv-dns'],
                ['fw-ext', 'fw-int'],
                ['fw-int', 'srv-ad'], ['fw-int', 'srv-file'], ['fw-int', 'db-primary'],
                ['db-primary', 'db-backup'],
                ['srv-ad', 'ws-admin'], ['srv-ad', 'ws-dev1'], ['srv-ad', 'ws-dev2'], ['srv-ad', 'ws-hr'],
                ['srv-file', 'ws-dev1'], ['srv-file', 'ws-dev2'],
                ['wap-1', 'fw-int'],
                ['srv-web1', 'db-primary'], ['srv-web2', 'db-primary']
            ];
            return { nodes, connections };
        },

        dmz_network: () => {
            const nodes = [
                generateNode('router-1', NODE_TYPES.ROUTER, '172.16.0', 0, 'Border Router'),
                generateNode('fw-outer', NODE_TYPES.FIREWALL, '172.16.0', 1, 'Outer Firewall'),
                generateNode('srv-proxy', NODE_TYPES.SERVER, '172.16.1', 0, 'Reverse Proxy'),
                generateNode('srv-web', NODE_TYPES.SERVER, '172.16.1', 1, 'Public Web Server'),
                generateNode('srv-api', NODE_TYPES.SERVER, '172.16.1', 2, 'API Gateway'),
                generateNode('fw-inner', NODE_TYPES.FIREWALL, '172.16.2', 0, 'Inner Firewall'),
                generateNode('srv-app', NODE_TYPES.SERVER, '172.16.2', 1, 'App Server'),
                generateNode('db-main', NODE_TYPES.DATABASE, '172.16.2', 2, 'Main Database'),
                generateNode('srv-backup', NODE_TYPES.SERVER, '172.16.2', 3, 'Backup Server'),
                generateNode('ws-sec', NODE_TYPES.WORKSTATION, '172.16.2', 4, 'Security Ops'),
                generateNode('ws-mgmt', NODE_TYPES.WORKSTATION, '172.16.2', 5, 'Management Console')
            ];
            const connections = [
                ['router-1', 'fw-outer'],
                ['fw-outer', 'srv-proxy'], ['fw-outer', 'srv-web'], ['fw-outer', 'srv-api'],
                ['srv-proxy', 'fw-inner'], ['srv-api', 'fw-inner'],
                ['fw-inner', 'srv-app'], ['fw-inner', 'db-main'], ['fw-inner', 'srv-backup'],
                ['fw-inner', 'ws-sec'], ['fw-inner', 'ws-mgmt'],
                ['srv-app', 'db-main'], ['db-main', 'srv-backup']
            ];
            return { nodes, connections };
        }
    };

    const generator = topologies[preset] || topologies.enterprise;
    return generator();
}

export { NODE_TYPES, VULNERABILITY_CATALOG, SERVICE_CATALOG };
