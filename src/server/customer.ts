import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { WebSocket, WebSocketServer } from 'ws';
import type { CustomerSample } from '../lib/types/lab';
import { send } from './socket';

export type CustomerRuntimeOptions = {
	dataDir: string;
	victimCheckoutUrl: string;
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
		const trafficSample = customerTrafficSample(options);
		if (trafficSample) return trafficSample;
		return directCustomerProbe(options.victimCheckoutUrl);
	}

	function attach(server: WebSocketServer): void {
		server.on('connection', (socket) => {
			customerSockets.add(socket);
			send(socket, 'customer.config', { url: options.victimCheckoutUrl });
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
		directCustomerProbe: () => directCustomerProbe(options.victimCheckoutUrl)
	};
}

async function directCustomerProbe(victimCheckoutUrl: string): Promise<CustomerSample> {
	const started = Date.now();
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 1800);

	try {
		const response = await fetch(victimCheckoutUrl, { signal: controller.signal });
		const body = (await response.text()).trim().slice(0, 240);
		return {
			ok: response.ok,
			status: response.status,
			latency_ms: Date.now() - started,
			url: victimCheckoutUrl,
			body
		};
	} catch (error) {
		return {
			ok: false,
			status: 'ERR',
			latency_ms: Date.now() - started,
			url: victimCheckoutUrl,
			error: error instanceof Error ? error.message : String(error)
		};
	} finally {
		clearTimeout(timeout);
	}
}

function customerTrafficSample(options: CustomerRuntimeOptions): CustomerSample | null {
	const path = join(options.dataDir, 'customer-traffic.log');

	try {
		const lines = readFileSync(path, 'utf8')
			.trim()
			.split('\n')
			.filter(Boolean);
		const latest = lines[lines.length - 1];
		if (!latest) return null;

		const match = /^(\S+)\s+status=([^\s]+)\s+latency_s=([0-9.]+)(?:\s+error=(.*))?$/.exec(latest);
		if (!match) return null;

		const observedAt = match[1];
		const statusText = match[2];
		const latencyMs = Math.round(Number(match[3]) * 1000);
		const status = /^\d+$/.test(statusText) ? Number(statusText) : statusText;
		const timestamp = Date.parse(observedAt);
		const ageMs = Number.isFinite(timestamp) ? Date.now() - timestamp : 0;

		if (ageMs > 5000) {
			return {
				ok: false,
				status: 'STALE',
				latency_ms: ageMs,
				url: options.victimCheckoutUrl,
				source: 'customer-traffic',
				observed_at: observedAt,
				error: `customer-traffic sample is stale (${ageMs}ms old)`
			};
		}

		return {
			ok: typeof status === 'number' && status >= 200 && status < 400,
			status,
			latency_ms: Number.isFinite(latencyMs) ? latencyMs : 0,
			url: options.victimCheckoutUrl,
			source: 'customer-traffic',
			observed_at: observedAt,
			error: match[4]
		};
	} catch {
		return null;
	}
}
