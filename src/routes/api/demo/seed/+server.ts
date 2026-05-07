import { json } from '@sveltejs/kit';
import { seedDemoState } from '$lib/server/lab';

export async function POST() {
	return json(await seedDemoState());
}
