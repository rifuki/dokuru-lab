import { json } from '@sveltejs/kit';
import { runtimeEvidence } from '$lib/server/lab';

export function GET() {
	return json({ ok: true, runtime: runtimeEvidence() });
}
