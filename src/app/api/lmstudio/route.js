// Server-side proxy for LM Studio API to avoid CORS issues
// Browser → Next.js API route → LM Studio local server

export async function POST(req) {
    try {
        const { action, baseUrl, modelKey, instanceId } = await req.json();
        const base = baseUrl || 'http://127.0.0.1:1234';

        switch (action) {
            case 'list': {
                const res = await fetch(`${base}/api/v1/models`);
                if (!res.ok) {
                    const err = await res.text();
                    return Response.json({ error: `LM Studio error (${res.status}): ${err}` }, { status: res.status });
                }
                const data = await res.json();
                return Response.json(data);
            }

            case 'load': {
                const res = await fetch(`${base}/api/v1/models/load`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: modelKey }),
                });
                if (!res.ok) {
                    const err = await res.text();
                    return Response.json({ error: `Failed to load model (${res.status}): ${err}` }, { status: res.status });
                }
                const data = await res.json();
                return Response.json(data);
            }

            case 'unload': {
                const res = await fetch(`${base}/api/v1/models/unload`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ instance_id: instanceId }),
                });
                if (!res.ok) {
                    const err = await res.text();
                    return Response.json({ error: `Failed to unload model (${res.status}): ${err}` }, { status: res.status });
                }
                const data = await res.json();
                return Response.json(data);
            }

            default:
                return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
        }
    } catch (err) {
        console.error('[LM Studio Proxy]', err);
        return Response.json(
            { error: err.message || 'Failed to connect to LM Studio' },
            { status: 502 }
        );
    }
}
