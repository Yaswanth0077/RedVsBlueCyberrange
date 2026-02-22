// Shared socket.io reference — avoids circular dependency between index.js and engine modules
let _io = null;

export function setIO(io) {
    _io = io;
}

export function getIO() {
    return _io;
}
