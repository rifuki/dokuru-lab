import { json } from '@sveltejs/kit';
import { health } from '$lib/server/lab';

export function GET() {
	return json(health());
}
