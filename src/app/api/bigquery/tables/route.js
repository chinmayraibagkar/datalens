import { NextResponse } from 'next/server';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const projectId = searchParams.get('projectId');
        const datasetId = searchParams.get('datasetId');
        const accessToken = req.headers.get('x-access-token');

        if (!accessToken) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        if (!projectId || !datasetId) {
            return NextResponse.json(
                { error: 'projectId and datasetId are required' },
                { status: 400 }
            );
        }

        const res = await fetch(
            `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/datasets/${datasetId}/tables`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            }
        );

        if (!res.ok) {
            const err = await res.text();
            return NextResponse.json({ error: err }, { status: res.status });
        }

        const data = await res.json();
        const tables = (data.tables || []).map((t) => ({
            id: t.tableReference.tableId,
            type: t.type,
            dataset: t.tableReference.datasetId,
            project: t.tableReference.projectId,
        }));

        return NextResponse.json({ tables });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
