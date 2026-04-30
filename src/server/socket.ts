import type { WebSocket } from 'ws';

export function send(socket: WebSocket, type: string, payload: Record<string, unknown> = {}): void {
	if (socket.readyState !== 1) return;
	socket.send(JSON.stringify({ type, ...payload, at: new Date().toISOString() }));
}

export function line(socket: WebSocket, stream: string, text: string): void {
	send(socket, 'terminal.line', { stream, text });
}
