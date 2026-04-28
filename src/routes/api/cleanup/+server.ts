import { json } from '@sveltejs/kit';
import { cleanup } from '$lib/server/lab';

export async function POST() {
	return json(await cleanup());
}
