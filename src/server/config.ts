import { clamp } from './shell';

export type ServerConfig = {
	host: string;
	port: number;
	dataDir: string;
	checkoutApiUrl: string;
	checkoutMonitorUrl: string;
	customerProbeIntervalMs: number;
};

export function loadConfig(): ServerConfig {
	return {
		host: process.env.HOST || '0.0.0.0',
		port: Number(process.env.PORT || 8080),
		dataDir: process.env.LAB_DATA_DIR || '/app/data',
		checkoutApiUrl: process.env.CHECKOUT_API_URL || 'http://checkout-api:3000/checkout',
		checkoutMonitorUrl: process.env.CHECKOUT_MONITOR_URL || 'http://checkout-monitor:3001/sample',
		customerProbeIntervalMs: clamp(Number(process.env.CUSTOMER_PROBE_INTERVAL_MS || 750), 250, 5000)
	};
}
