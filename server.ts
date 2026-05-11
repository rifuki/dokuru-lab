import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadConfig } from './src/server/config';
import { createCustomerRuntime } from './src/server/customer';
import { attachMonitorSocketServer } from './src/server/monitor';
import { TerminalController } from './src/server/terminal';

type SvelteKitHandler = (request: IncomingMessage, response: ServerResponse) => void;

const handlerModulePath = './build/handler.js';
const { handler } = (await import(handlerModulePath)) as { handler: SvelteKitHandler };
const config = loadConfig();

const server = createServer((request, response) => {
	handler(request, response);
});

const terminalServer = new WebSocketServer({ noServer: true });
const monitorServer = new WebSocketServer({ noServer: true });
const customerServer = new WebSocketServer({ noServer: true });

const customerRuntime = createCustomerRuntime({
	dataDir: config.dataDir,
	checkoutApiUrl: config.checkoutApiUrl,
	probeIntervalMs: config.customerProbeIntervalMs
});

new TerminalController(terminalServer, {
	dataDir: config.dataDir,
	checkoutApiUrl: config.checkoutApiUrl,
	directCustomerProbe: customerRuntime.directCustomerProbe
}).attach();
attachMonitorSocketServer(monitorServer);
customerRuntime.attach(customerServer);

server.on('upgrade', (request, socket, head) => {
	const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

	if (url.pathname === '/ws/terminal') {
		terminalServer.handleUpgrade(request, socket, head, (websocket) => {
			terminalServer.emit('connection', websocket, request);
		});
		return;
	}

	if (url.pathname === '/ws/monitor') {
		monitorServer.handleUpgrade(request, socket, head, (websocket) => {
			monitorServer.emit('connection', websocket, request);
		});
		return;
	}

	if (url.pathname === '/ws/customer') {
		customerServer.handleUpgrade(request, socket, head, (websocket) => {
			customerServer.emit('connection', websocket, request);
		});
		return;
	}

	socket.destroy();
});

server.listen(config.port, config.host, () => {
	console.log(`Listening on http://${config.host}:${config.port}`);
});
