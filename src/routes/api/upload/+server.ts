import { json } from '@sveltejs/kit';
import { uploadDemoFile } from '$lib/server/lab';

export async function POST({ request }) {
	const formData = await request.formData();
	const file = formData.get('file');

	if (!(file instanceof File)) {
		return json({ ok: false, error: 'Expected multipart form field named file' }, { status: 400 });
	}

	return json(await uploadDemoFile(file));
}
