import type { WebSocket } from 'ws';

export function send(socket: WebSocket, type: string, payload: Record<string, unknown> = {}): void {
	if (socket.readyState !== 1) return;
	try {
		socket.send(JSON.stringify({ type, ...payload, at: new Date().toISOString() }));
	} catch {
		// Socket may close between readyState check and send while payloads stress the runtime.
	}
}

export function line(socket: WebSocket, stream: string, text: string): void {
	send(socket, 'terminal.line', { stream, text });
}
