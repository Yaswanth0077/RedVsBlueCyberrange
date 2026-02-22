# Red vs Blue -- Virtual Network Setup Guide

## Network Architecture

```
+------------------+      VirtualBox Internal Network      +------------------+
|  Kali Linux VM   |  <------ 192.168.56.0/24 ------>      | Ubuntu Server VM |
|  (Red Team)      |           Host-Only Adapter            |  (Blue Team)     |
|  192.168.56.101  |                                        |  192.168.56.102  |
+------------------+                                        +------------------+
         |                                                          |
         +------------------------+  +--------------------------+
                                  |  |
                          +------------------+
                          |   Host Machine   |
                          |   (Dashboard)    |
                          |  192.168.56.1    |
                          |  localhost:3000   |
                          +------------------+
```

---

## Step 1: VirtualBox Network Setup

1. Open VirtualBox > File > Host Network Manager
2. Create a new Host-Only Network (e.g., `vboxnet0`)
   - IP: `192.168.56.1`
   - Mask: `255.255.255.0`
   - DHCP: Enabled (range 192.168.56.100-200)

3. For **both VMs**, go to Settings > Network:
   - **Adapter 1**: NAT (for internet access)
   - **Adapter 2**: Host-Only Adapter > `vboxnet0`

---

## Step 2: Kali Linux VM (Red Team)

### Install Node.js
```bash
sudo apt update
sudo apt install -y nodejs npm
node -v   # Should be 16+
```

### Verify Attack Tools
```bash
# These should be pre-installed on Kali
which nmap hydra nikto gobuster
```

### Copy Project Files
```bash
# From host machine, copy the project:
scp -r RedvsBlue/ kali@192.168.56.101:~/

# Or clone from git if hosted
```

### Install Dependencies
```bash
cd ~/RedvsBlue
npm install
```

### Configure Network
```bash
# Verify connectivity to Ubuntu
ping 192.168.56.102

# Check adapter
ip addr show | grep 192.168.56
```

### Start Red Agent
```bash
node server/red-agent.js --target 192.168.56.102 --port 4001
```

---

## Step 3: Ubuntu Server VM (Blue Team)

### Install Node.js
```bash
sudo apt update
sudo apt install -y nodejs npm
```

### Install Defensive Services
```bash
# SSH Server (usually pre-installed)
sudo apt install -y openssh-server

# Web Server
sudo apt install -y apache2

# Firewall
sudo ufw enable
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 4002/tcp # Blue Agent WebSocket

# Fail2Ban
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Enable logging
sudo systemctl enable rsyslog
```

### Configure Fail2Ban
```bash
sudo tee /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 600
findtime = 600
EOF

sudo systemctl restart fail2ban
```

### Copy Project Files
```bash
scp -r RedvsBlue/ ubuntu@192.168.56.102:~/
cd ~/RedvsBlue
npm install
```

### Start Blue Agent
```bash
sudo node server/blue-agent.js --port 4002
```
> Note: `sudo` is needed to read system logs

---

## Step 4: Host Machine (Dashboard)

```bash
cd RedvsBlue
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## Step 5: Connect Everything

1. Open the dashboard at `http://localhost:3000`
2. Click **"Live"** toggle in the sidebar
3. Go to **"Live Mode"** tab
4. Enter Kali IP: `192.168.56.101`, Port: `4001` > Click **Connect**
5. Enter Ubuntu IP: `192.168.56.102`, Port: `4002` > Click **Connect**
6. Click **"Full Attack"** to launch the Red Team attack sequence
7. Watch real-time events on the Dashboard, Timeline, and Log Viewer

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Can't connect to agents | Check firewall allows ports 4001/4002 |
| No logs from Blue Agent | Run with `sudo`: `sudo node server/blue-agent.js` |
| Agent tools missing | Install: `sudo apt install -y nmap hydra nikto` |
| VMs can't ping each other | Verify Host-Only adapter is on same network |
| WebSocket connection fails | Check VMs have correct IPs with `ip addr` |

---

## Security Warning

> This platform uses real penetration testing tools.
> Only use on networks you own and control.
> Never run against production systems.
> The virtual network is isolated by design.
