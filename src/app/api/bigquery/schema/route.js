import { NextResponse } from 'next/server';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const projectId = searchParams.get('projectId');
        const datasetId = searchParams.get('datasetId');
        const tableId = searchParams.get('tableId');
        const accessToken = req.headers.get('x-access-token');

        if (!accessToken) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        if (!projectId || !datasetId || !tableId) {
            return NextResponse.json(
                { error: 'projectId, datasetId, and tableId are required' },
                { status: 400 }
            );
        }

        const res = await fetch(
            `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/datasets/${datasetId}/tables/${tableId}`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            }
        );

        if (!res.ok) {
            const err = await res.text();
            return NextResponse.json({ error: err }, { status: res.status });
        }

        const data = await res.json();
        const schema = (data.schema?.fields || []).map((f) => ({
            name: f.name,
            type: f.type,
            mode: f.mode,
            description: f.description || '',
        }));

        return NextResponse.json({
            schema,
            numRows: data.numRows,
            numBytes: data.numBytes,
            tableId: data.tableReference.tableId,
            datasetId: data.tableReference.datasetId,
            projectId: data.tableReference.projectId,
        });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
