// Meta Ads client — uses Meta Marketing API REST endpoints directly
// This avoids child_process issues with Next.js bundling

const META_API_VERSION = 'v21.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

export async function executeMetaAdsTool(toolName, args, config) {
    if (!config?.enabled || !config?.accessToken) {
        return { error: 'Meta Ads is not configured. Please add credentials in Settings.' };
    }

    const accessToken = config.accessToken;

    try {
        switch (toolName) {
            case 'meta_ads_get_accounts': {
                const userId = args.user_id || 'me';
                const res = await fetch(
                    `${META_BASE_URL}/${userId}/adaccounts?fields=id,name,account_status,currency,timezone_name&access_token=${accessToken}`
                );

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return { error: err.error?.message || `Meta API error: ${res.status}` };
                }

                const data = await res.json();
                return { accounts: data.data || [], paging: data.paging };
            }

            case 'meta_ads_get_campaigns': {
                const accountId = args.account_id;
                if (!accountId) return { error: 'account_id is required' };

                const limit = args.limit || 50;
                const res = await fetch(
                    `${META_BASE_URL}/${accountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time&limit=${limit}&access_token=${accessToken}`
                );

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return { error: err.error?.message || `Meta API error: ${res.status}` };
                }

                const data = await res.json();
                return { campaigns: data.data || [], paging: data.paging };
            }

            case 'meta_ads_get_insights': {
                const objectId = args.object_id;
                if (!objectId) return { error: 'object_id is required' };

                let url = `${META_BASE_URL}/${objectId}/insights?fields=spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,cost_per_action_type,campaign_name,adset_name,ad_name`;

                if (args.level) {
                    url += `&level=${args.level}`;
                }
                if (args.date_preset) {
                    url += `&date_preset=${args.date_preset}`;
                }
                if (args.breakdowns) {
                    url += `&breakdowns=${args.breakdowns}`;
                }

                url += `&access_token=${accessToken}`;

                const res = await fetch(url);

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return { error: err.error?.message || `Meta API error: ${res.status}` };
                }

                const data = await res.json();
                return { insights: data.data || [], paging: data.paging };
            }

            case 'meta_ads_get_ad_sets': {
                const campaignId = args.campaign_id;
                if (!campaignId) return { error: 'campaign_id is required' };

                const res = await fetch(
                    `${META_BASE_URL}/${campaignId}/adsets?fields=id,name,status,daily_budget,lifetime_budget,targeting,optimization_goal,bid_strategy&access_token=${accessToken}`
                );

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return { error: err.error?.message || `Meta API error: ${res.status}` };
                }

                const data = await res.json();
                return { adSets: data.data || [], paging: data.paging };
            }

            case 'meta_ads_get_ads': {
                const parentId = args.parent_id;
                if (!parentId) return { error: 'parent_id is required' };

                const res = await fetch(
                    `${META_BASE_URL}/${parentId}/ads?fields=id,name,status,effective_status,creative&access_token=${accessToken}`
                );

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return { error: err.error?.message || `Meta API error: ${res.status}` };
                }

                const data = await res.json();
                return { ads: data.data || [], paging: data.paging };
            }

            default:
                return { error: `Unknown Meta Ads tool: ${toolName}` };
        }
    } catch (err) {
        console.error('Meta Ads API error:', err.message);
        return { error: `Meta Ads error: ${err.message}` };
    }
}
