import { NextResponse } from 'next/server';
import { executeGoogleAdsTool } from '@/services/mcp/google-ads-client';

export async function POST(req) {
    try {
        const body = await req.json();
        const { action, config } = body;

        if (!config?.enabled) {
            return NextResponse.json({ error: 'Google Ads is not enabled' }, { status: 400 });
        }

        switch (action) {
            case 'test': {
                const result = await executeGoogleAdsTool('google_ads_list_customers', {}, config);
                console.log('Google Ads test result:', JSON.stringify(result, null, 2));
                if (result.error) {
                    return NextResponse.json({ success: false, error: result.error });
                }
                const customers = result.customers || result.data || [];
                return NextResponse.json({
                    success: true,
                    customerCount: Array.isArray(customers) ? customers.length : 1,
                });
            }

            case 'list_customers': {
                const result = await executeGoogleAdsTool('google_ads_list_customers', {}, config);
                if (result.error) {
                    return NextResponse.json({ error: result.error }, { status: 500 });
                }
                const customers = result.customers || [];
                return NextResponse.json({ customers });
            }

            case 'search': {
                const result = await executeGoogleAdsTool('google_ads_search', body.args || {}, config);
                return NextResponse.json(result);
            }

            default:
                return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
        }
    } catch (error) {
        console.error('Google Ads API error:', error.message, error.stack);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
