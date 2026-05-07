import { json } from '@sveltejs/kit';
import { dumpAppData } from '$lib/server/lab';

export async function POST() {
	return json(await dumpAppData());
}
