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
                // Normalize the response
                const rawCustomers = result.customers || result.data || result;
                const customers = Array.isArray(rawCustomers) 
                    ? rawCustomers.map(c => ({
                        id: c.id || c.customerId || c,
                        name: c.name || c.descriptive_name || c.id || c,
                    }))
                    : [{ id: String(rawCustomers), name: String(rawCustomers) }];
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
        console.error('Google Ads API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
