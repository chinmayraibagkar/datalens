import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        const { sql, projectId, accessToken: bodyToken, dryRun } = await req.json();
        const accessToken =
            req.headers.get('x-access-token') || bodyToken;

        if (!accessToken) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        if (!sql || !projectId) {
            return NextResponse.json(
                { error: 'sql and projectId are required' },
                { status: 400 }
            );
        }

        const body = {
            query: sql,
            useLegacySql: false,
            maxResults: 1000,
        };

        if (dryRun) {
            body.dryRun = true;
        }

        const res = await fetch(
            `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            }
        );

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const message =
                err.error?.message || err.error?.errors?.[0]?.message || 'Query failed';
            return NextResponse.json({ error: message }, { status: res.status });
        }

        const data = await res.json();

        if (dryRun) {
            return NextResponse.json({
                valid: true,
                totalBytesProcessed: data.totalBytesProcessed,
            });
        }

        // Parse results
        const fields = data.schema?.fields || [];
        const rows = (data.rows || []).map((row) => {
            const obj = {};
            row.f.forEach((cell, i) => {
                obj[fields[i].name] = cell.v;
            });
            return obj;
        });

        return NextResponse.json({
            columns: fields.map((f) => ({ name: f.name, type: f.type })),
            rows,
            totalRows: data.totalRows,
            totalBytesProcessed: data.totalBytesProcessed,
            jobComplete: data.jobComplete,
        });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
