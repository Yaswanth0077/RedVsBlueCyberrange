// EventBus — Pub/sub event system with structured logging and timeline

class EventBus {
    constructor() {
        this.listeners = {};
        this.timeline = [];
        this.logs = [];
        this.idCounter = 0;
    }

    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
        return () => {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        };
    }

    emit(event, data) {
        const entry = {
            id: ++this.idCounter,
            event,
            timestamp: Date.now(),
            tick: data?.tick || 0,
            ...data
        };

        this.timeline.push(entry);

        if (data?.log) {
            this.logs.push({
                id: entry.id,
                tick: entry.tick,
                timestamp: entry.timestamp,
                severity: data.severity || 'info',
                source: data.source || 'system',
                team: data.team || 'system',
                message: data.log,
                details: data.details || null
            });
        }

        (this.listeners[event] || []).forEach(cb => cb(entry));
        (this.listeners['*'] || []).forEach(cb => cb(entry));

        return entry;
    }

    getTimeline() {
        return [...this.timeline];
    }

    getLogs(filter = {}) {
        let result = [...this.logs];
        if (filter.team) result = result.filter(l => l.team === filter.team);
        if (filter.severity) result = result.filter(l => l.severity === filter.severity);
        if (filter.source) result = result.filter(l => l.source === filter.source);
        if (filter.search) {
            const s = filter.search.toLowerCase();
            result = result.filter(l => l.message.toLowerCase().includes(s));
        }
        return result;
    }

    reset() {
        this.timeline = [];
        this.logs = [];
        this.idCounter = 0;
    }
}

export default EventBus;
