import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function POST(req) {
    try {
        let payload;
        const contentType = req.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            payload = await req.json();
        } else {
            const formData = await req.formData();
            payload = JSON.parse(formData.get('payload'));
        }

        const { rows = [], format } = payload;
        let columns = payload.columns;

        // Infer columns from first row if missing
        if (!columns?.length && rows.length > 0) {
            columns = Object.keys(rows[0]).map(name => ({ name }));
        }

        if (!rows.length || !columns?.length) {
            return NextResponse.json({ error: 'No data to download' }, { status: 400 });
        }

        const headers = columns.map(c => c.name);
        const timestamp = Date.now();

        if (format === 'xlsx') {
            const wsData = [headers, ...rows.map(row => headers.map(h => row[h] ?? ''))];
            const ws = XLSX.utils.aoa_to_sheet(wsData);

            // Auto-size columns
            ws['!cols'] = headers.map((h, i) => {
                const maxLen = Math.max(h.length, ...wsData.slice(1).map(r => String(r[i] ?? '').length));
                return { wch: Math.min(maxLen + 2, 40) };
            });

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Query Results');
            const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

            return new Response(buf, {
                status: 200,
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': `attachment; filename="query_results_${timestamp}.xlsx"`,
                },
            });
        }

        // Default: CSV
        const csvRows = [headers.join(',')];
        for (const row of rows) {
            const values = headers.map(h => {
                const val = row[h] ?? '';
                const str = String(val);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            });
            csvRows.push(values.join(','));
        }

        const BOM = '\uFEFF';
        const csvContent = BOM + csvRows.join('\n');

        return new Response(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="query_results_${timestamp}.csv"`,
            },
        });
    } catch (error) {
        console.error('Download API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
