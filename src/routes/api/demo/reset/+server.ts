import { json } from '@sveltejs/kit';
import { resetDemoState } from '$lib/server/lab';

export async function POST() {
	return json(await resetDemoState());
}
