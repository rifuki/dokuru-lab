import type { WebSocket, WebSocketServer } from 'ws';
import type { CustomerSample } from '../lib/types/lab';
import { send } from './socket';

export type CustomerRuntimeOptions = {
	checkoutApiUrl: string;
	checkoutMonitorUrl: string;
	probeIntervalMs: number;
};

export type CustomerRuntime = {
	attach(server: WebSocketServer): void;
	directCustomerProbe(): Promise<CustomerSample>;
};

export function createCustomerRuntime(options: CustomerRuntimeOptions): CustomerRuntime {
	const customerSockets = new Set<WebSocket>();

	async function broadcastCustomerSample(): Promise<void> {
		if (customerSockets.size === 0) return;
		const sample = await customerProbe();
		for (const socket of customerSockets) {
			send(socket, 'customer.sample', { sample });
		}
	}

	async function sendCustomerSample(socket: WebSocket): Promise<void> {
		const sample = await customerProbe();
		send(socket, 'customer.sample', { sample });
	}

	async function customerProbe(): Promise<CustomerSample> {
		return (await checkoutMonitorProbe(options.checkoutMonitorUrl, options.checkoutApiUrl)) ?? directCustomerProbe(options.checkoutApiUrl);
	}

	function attach(server: WebSocketServer): void {
		server.on('connection', (socket) => {
			customerSockets.add(socket);
			send(socket, 'customer.config', { url: options.checkoutApiUrl, monitorUrl: options.checkoutMonitorUrl });
			void sendCustomerSample(socket);
			socket.on('close', () => {
				customerSockets.delete(socket);
			});
		});

		setInterval(() => {
			void broadcastCustomerSample();
		}, options.probeIntervalMs);
	}

	return {
		attach,
		directCustomerProbe: () => directCustomerProbe(options.checkoutApiUrl)
	};
}

async function checkoutMonitorProbe(checkoutMonitorUrl: string, checkoutApiUrl: string): Promise<CustomerSample | null> {
	if (!checkoutMonitorUrl) return null;

	const started = Date.now();
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 900);

	try {
		const response = await fetch(checkoutMonitorUrl, { signal: controller.signal });
		if (!response.ok) return null;

		const sample = (await response.json()) as Partial<CustomerSample>;
		const observedAt = typeof sample.observed_at === 'string' ? sample.observed_at : new Date().toISOString();
		const observedAtMs = Date.parse(observedAt);
		const ageMs = Number.isFinite(observedAtMs) ? Date.now() - observedAtMs : 0;
		if (ageMs > 5000) return null;

		return {
			ok: Boolean(sample.ok),
			status: coerceStatus(sample.status),
			latency_ms: coerceLatency(sample.latency_ms, Date.now() - started),
			url: typeof sample.url === 'string' ? sample.url : checkoutApiUrl,
			source: 'checkout-monitor',
			observed_at: observedAt,
			body: typeof sample.body === 'string' ? sample.body : undefined,
			error: typeof sample.error === 'string' ? sample.error : undefined
		};
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
}

async function directCustomerProbe(checkoutApiUrl: string): Promise<CustomerSample> {
	const started = Date.now();
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 1800);

	try {
		const response = await fetch(checkoutApiUrl, { signal: controller.signal });
		const body = (await response.text()).trim().slice(0, 240);
		return {
			ok: response.ok,
			status: response.status,
			latency_ms: Date.now() - started,
			url: checkoutApiUrl,
			source: 'direct-probe',
			body
		};
	} catch (error) {
		return {
			ok: false,
			status: 'ERR',
			latency_ms: Date.now() - started,
			url: checkoutApiUrl,
			source: 'direct-probe',
			error: error instanceof Error ? error.message : String(error)
		};
	} finally {
		clearTimeout(timeout);
	}
}

function coerceStatus(value: unknown): number | string {
	return typeof value === 'number' || typeof value === 'string' ? value : 'ERR';
}

function coerceLatency(value: unknown, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : fallback;
}
