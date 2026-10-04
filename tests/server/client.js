/** One browser against a test server: its own cookies, and raw sockets for what fetch will not send. */
import { request } from 'node:http';
import { connect } from 'node:net';
import { randomUUID } from 'node:crypto';

function parse(status, headers, raw) {
  const isJson = /json/.test(headers['content-type'] ?? '') && raw.length;
  return { status, body: isJson ? JSON.parse(raw.toString('utf8')) : raw, headers };
}

export class Client {
  constructor(base) {
    this.base = new URL(base);
    this.cookies = new Map();
  }

  keep(setCookies = []) {
    for (const line of setCookies) {
      const [pair, ...attributes] = line.split(';').map((part) => part.trim());
      const at = pair.indexOf('=');
      const [name, value] = [pair.slice(0, at), pair.slice(at + 1)];
      const expired = attributes.some((attribute) => /^max-age=0$/i.test(attribute));
      if (expired || !value) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  cookieHeader() {
    return this.cookies.size ? { Cookie: [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ') } : {};
  }

  call(method, path, { body, headers = {}, raw } = {}) {
    const data = raw ?? (body === undefined ? null : Buffer.from(JSON.stringify(body)));
    const sent = {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...this.cookieHeader(),
      ...headers,
      ...(data ? { 'Content-Length': data.length } : {}),
    };
    return new Promise((resolve, reject) => {
      const outgoing = request(
        { host: this.base.hostname, port: this.base.port, method, path, headers: sent },
        (response) => {
          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => {
            this.keep(response.headers['set-cookie']);
            resolve(parse(response.statusCode, response.headers, Buffer.concat(chunks)));
          });
        },
      );
      outgoing.on('error', reject);
      if (data) outgoing.write(data);
      outgoing.end();
    });
  }

  /** Sends the body 50 ms after the headers, as a slow client would; reads the reply 50 ms later. */
  callWithLateBody(method, path, raw, headers = {}) {
    const head = [
      `${method} ${path} HTTP/1.1`,
      `Host: ${this.base.host}`,
      `Content-Length: ${raw.length}`,
      'Connection: close',
      ...Object.entries({ ...this.cookieHeader(), ...headers }).map(([name, value]) => `${name}: ${value}`),
    ];
    return new Promise((resolve, reject) => {
      const socket = connect(Number(this.base.port), this.base.hostname);
      const chunks = [];
      socket.on('data', (chunk) => chunks.push(chunk));
      socket.on('error', reject);
      socket.on('end', () => resolve(readReply(Buffer.concat(chunks))));
      socket.write(`${head.join('\r\n')}\r\n\r\n`);
      setTimeout(() => socket.write(raw), 50);
    });
  }

  async register({ email = `${randomUUID().slice(0, 10)}@example.com`, password = 'correct horse', name = 'Rahma' } = {}) {
    const reply = await this.call('POST', '/api/register', { body: { name, email, password } });
    return { ...reply, email };
  }
}

function readReply(buffer) {
  const split = buffer.indexOf('\r\n\r\n');
  const head = buffer.subarray(0, split).toString('latin1').split('\r\n');
  const headers = Object.fromEntries(
    head.slice(1).map((line) => {
      const at = line.indexOf(':');
      return [line.slice(0, at).trim().toLowerCase(), line.slice(at + 1).trim()];
    }),
  );
  let body = buffer.subarray(split + 4);
  if (/chunked/i.test(headers['transfer-encoding'] ?? '')) body = unchunk(body);
  return parse(Number(head[0].split(' ')[1]), headers, body);
}

function unchunk(body) {
  const parts = [];
  let at = 0;
  for (;;) {
    const line = body.indexOf('\r\n', at);
    const size = parseInt(body.subarray(at, line).toString('latin1'), 16);
    if (!size) return Buffer.concat(parts);
    parts.push(body.subarray(line + 2, line + 2 + size));
    at = line + 2 + size + 2;
  }
}

/** A request exactly as written, half-closed so a server reading to the end of the stream answers. */
export function sendRaw(port, text) {
  return new Promise((resolve, reject) => {
    const socket = connect(port, '127.0.0.1');
    const chunks = [];
    socket.on('data', (chunk) => chunks.push(chunk));
    socket.on('error', reject);
    socket.on('end', () => resolve(readReply(Buffer.concat(chunks))));
    socket.end(text);
  });
}
