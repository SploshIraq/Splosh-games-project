const active = new Map(); // channelId -> game state

function start(ch, owner) {
  const s = {
    owner, stopped: false, cols: new Set(),
    track(c) { this.cols.add(c); c.on('end', () => this.cols.delete(c)); return c; },
    stop() { this.stopped = true; [...this.cols].forEach(c => c.stop('stop')); },
  };
  active.set(ch.id, s);
  return s;
}
function end(ch, s) { if (active.get(ch.id) === s) active.delete(ch.id); }

module.exports = { active, start, end };
