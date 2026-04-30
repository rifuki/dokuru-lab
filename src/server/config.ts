import { clamp } from './shell';

export type ServerConfig = {
	host: string;
	port: number;
	dataDir: string;
	victimCheckoutUrl: string;
	customerProbeIntervalMs: number;
};

export function loadConfig(): ServerConfig {
	return {
		host: process.env.HOST || '0.0.0.0',
		port: Number(process.env.PORT || 8080),
		dataDir: process.env.LAB_DATA_DIR || '/app/data',
		victimCheckoutUrl: process.env.VICTIM_CHECKOUT_URL || 'http://victim-checkout:3000/checkout',
		customerProbeIntervalMs: clamp(Number(process.env.CUSTOMER_PROBE_INTERVAL_MS || 750), 250, 5000)
	};
}
