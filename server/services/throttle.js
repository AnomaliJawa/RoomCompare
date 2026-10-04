/** Refuses logins after too many failures per address and email; in memory, so a restart forgets. */
export class MemoryThrottle {
  constructor(limit, windowSeconds) {
    this.limit = limit;
    this.windowMs = windowSeconds * 1000;
    this.failures = new Map();
  }

  recent(key) {
    const cutoff = performance.now() - this.windowMs;
    const kept = (this.failures.get(key) ?? []).filter((moment) => moment > cutoff);
    this.failures.set(key, kept);
    return kept;
  }

  async blocked(key) {
    return this.recent(key).length >= this.limit;
  }

  async fail(key) {
    this.recent(key).push(performance.now());
  }

  async reset(key) {
    this.failures.delete(key);
  }
}

/** Kept in Redis: Vercel runs many copies at once, each with its own memory. */
export class RedisThrottle {
  constructor(send, limit, windowSeconds) {
    this.send = send;
    this.limit = limit;
    this.window = windowSeconds;
  }

  async blocked(key) {
    const [count] = await this.send([['GET', `rc:throttle:${key}`]]);
    return Number(count ?? 0) >= this.limit;
  }

  async fail(key) {
    const [count] = await this.send([['INCR', `rc:throttle:${key}`]]);
    if (count === 1) await this.send([['EXPIRE', `rc:throttle:${key}`, String(this.window)]]);
  }

  async reset(key) {
    await this.send([['DEL', `rc:throttle:${key}`]]);
  }
}
