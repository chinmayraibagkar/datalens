import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const projectId = searchParams.get('projectId');

        // Get session for access token
        const session = await getServerSession();
        const accessToken =
            req.headers.get('x-access-token') || session?.accessToken;

        if (!accessToken) {
            return NextResponse.json(
                { error: 'Not authenticated. Please connect Google account.' },
                { status: 401 }
            );
        }

        if (!projectId) {
            return NextResponse.json(
                { error: 'projectId is required' },
                { status: 400 }
            );
        }

        const res = await fetch(
            `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/datasets`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            }
        );

        if (!res.ok) {
            const err = await res.text();
            return NextResponse.json(
                { error: `BigQuery error: ${err}` },
                { status: res.status }
            );
        }

        const data = await res.json();
        const datasets = (data.datasets || []).map((d) => ({
            id: d.datasetReference.datasetId,
            project: d.datasetReference.projectId,
            location: d.location,
        }));

        return NextResponse.json({ datasets });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
