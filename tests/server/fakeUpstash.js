/** An in-memory Upstash Redis behind its REST API, so the tests exercise the real upstashTransport. */
import { createServer } from 'node:http';

export class FakeRedis {
  constructor() {
    this.data = new Map();
    this.expires = new Map();
  }

  live(key) {
    if (this.expires.has(key) && this.expires.get(key) <= performance.now()) {
      this.data.delete(key);
      this.expires.delete(key);
    }
    return this.data.has(key);
  }

  run(name, ...args) {
    switch (name.toUpperCase()) {
      case 'SET': {
        const [key, value, ...options] = args;
        const flags = options.map((option) => String(option).toUpperCase());
        if (flags.includes('NX') && this.live(key)) return null;
        this.data.set(key, String(value));
        this.expires.delete(key);
        if (flags.includes('EX')) this.expires.set(key, performance.now() + Number(options[flags.indexOf('EX') + 1]) * 1000);
        return 'OK';
      }
      case 'GET':
        return this.live(args[0]) ? this.data.get(args[0]) : null;
      case 'DEL':
        return args.filter((key) => this.live(key) && this.data.delete(key)).length;
      case 'HSET': {
        const [key, field, value] = args;
        if (!this.data.has(key)) this.data.set(key, new Map());
        const fields = this.data.get(key);
        const added = !fields.has(field);
        fields.set(field, String(value));
        return Number(added);
      }
      case 'HGET':
        return this.live(args[0]) ? this.data.get(args[0]).get(args[1]) ?? null : null;
      case 'HDEL': {
        const [key, ...fields] = args;
        const table = this.data.get(key);
        return table ? fields.filter((field) => table.delete(field)).length : 0;
      }
      case 'HGETALL':
        return this.live(args[0]) ? [...this.data.get(args[0])].flat() : [];
      case 'INCR': {
        const [key] = args;
        const value = Number(this.live(key) ? this.data.get(key) : 0) + 1;
        this.data.set(key, String(value));
        return value;
      }
      case 'EXPIRE': {
        const [key, seconds] = args;
        if (!this.live(key)) return 0;
        this.expires.set(key, performance.now() + Number(seconds) * 1000);
        return 1;
      }
      default:
        throw new Error(`ERR unknown command '${name}'`);
    }
  }

  /** Let every key under a prefix run out, as if its time had passed. */
  expire(prefix) {
    for (const key of this.data.keys()) if (key.startsWith(prefix)) this.expires.set(key, 0);
  }
}

/** Upstash's REST API in front of `fake`. Resolves to { server, url }. */
export function serveUpstash(fake, token) {
  const server = createServer(async (req, res) => {
    const reply = (status, payload) => {
      const body = JSON.stringify(payload);
      res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
      res.end(body);
    };
    if (req.headers.authorization !== `Bearer ${token}`) return reply(401, { error: 'Unauthorized' });
    if (req.url !== '/pipeline') return reply(404, { error: 'Not found' });
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const replies = JSON.parse(Buffer.concat(chunks)).map((command) => {
      try {
        return { result: fake.run(...command) };
      } catch (error) {
        return { error: error.message };
      }
    });
    reply(200, replies);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
  });
}
