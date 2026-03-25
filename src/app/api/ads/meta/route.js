import { NextResponse } from 'next/server';
import { executeMetaAdsTool } from '@/services/mcp/meta-ads-client';

export async function POST(req) {
    try {
        const body = await req.json();
        const { action, config } = body;

        if (!config?.enabled) {
            return NextResponse.json({ error: 'Meta Ads is not enabled' }, { status: 400 });
        }

        switch (action) {
            case 'test': {
                const result = await executeMetaAdsTool('meta_ads_get_accounts', { user_id: 'me' }, config);
                if (result.error) {
                    return NextResponse.json({ success: false, error: result.error });
                }
                const accounts = result.data || result.accounts || [];
                return NextResponse.json({
                    success: true,
                    accountCount: Array.isArray(accounts) ? accounts.length : 1,
                });
            }

            case 'list_accounts': {
                const result = await executeMetaAdsTool('meta_ads_get_accounts', { user_id: 'me' }, config);
                if (result.error) {
                    return NextResponse.json({ error: result.error }, { status: 500 });
                }
                const rawAccounts = result.data || result.accounts || result;
                const accounts = Array.isArray(rawAccounts)
                    ? rawAccounts.map(a => ({
                        id: a.id || a.account_id || a,
                        name: a.name || a.account_name || a.id || a,
                    }))
                    : [{ id: String(rawAccounts), name: String(rawAccounts) }];
                return NextResponse.json({ accounts });
            }

            case 'get_campaigns': {
                const result = await executeMetaAdsTool('meta_ads_get_campaigns', body.args || {}, config);
                return NextResponse.json(result);
            }

            case 'get_insights': {
                const result = await executeMetaAdsTool('meta_ads_get_insights', body.args || {}, config);
                return NextResponse.json(result);
            }

            default:
                return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
        }
    } catch (error) {
        console.error('Meta Ads API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
