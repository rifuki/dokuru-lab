import type { WebSocket, WebSocketServer } from 'ws';
import { runtimeEvidence } from './evidence';
import { send } from './socket';

export function attachMonitorSocketServer(server: WebSocketServer): void {
	const monitorSockets = new Set<WebSocket>();

	server.on('connection', (socket) => {
		monitorSockets.add(socket);
		send(socket, 'monitor.evidence', { runtime: runtimeEvidence() });
		socket.on('close', () => {
			monitorSockets.delete(socket);
		});
	});

	setInterval(() => {
		const payload = { runtime: runtimeEvidence() };
		for (const socket of monitorSockets) {
			send(socket, 'monitor.evidence', payload);
		}
	}, 500);
}
