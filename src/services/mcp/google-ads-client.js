// Google Ads client — uses REST API via Google Ads API directly
// This avoids child_process issues with Next.js bundling

const GOOGLE_ADS_API_VERSION = 'v18';
const GOOGLE_ADS_BASE_URL = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

async function getAccessToken(config) {
    // Exchange refresh token for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            refresh_token: config.refreshToken,
            grant_type: 'refresh_token',
        }),
    });

    if (!tokenRes.ok) {
        const err = await tokenRes.text();
        throw new Error(`Failed to get Google Ads access token: ${err}`);
    }

    const tokenData = await tokenRes.json();
    return tokenData.access_token;
}

export async function executeGoogleAdsTool(toolName, args, config) {
    if (!config?.enabled || !config?.refreshToken) {
        return { error: 'Google Ads is not configured. Please add credentials in Settings.' };
    }

    try {
        const accessToken = await getAccessToken(config);
        const headers = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'developer-token': config.developerToken || '',
        };

        if (config.loginCustomerId) {
            headers['login-customer-id'] = config.loginCustomerId.replace(/-/g, '');
        }

        switch (toolName) {
            case 'google_ads_search': {
                const customerId = (args.customer_id || config.customerId || config.loginCustomerId || '').replace(/-/g, '');
                const res = await fetch(
                    `${GOOGLE_ADS_BASE_URL}/customers/${customerId}/googleAds:searchStream`,
                    {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ query: args.query }),
                    }
                );

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return { error: err.error?.message || `Google Ads API error: ${res.status}` };
                }

                const data = await res.json();
                // searchStream returns array of result batches
                const results = [];
                if (Array.isArray(data)) {
                    for (const batch of data) {
                        if (batch.results) {
                            results.push(...batch.results);
                        }
                    }
                }
                return { results, totalResults: results.length };
            }

            case 'google_ads_list_customers': {
                const res = await fetch(
                    `${GOOGLE_ADS_BASE_URL}/customers:listAccessibleCustomers`,
                    { headers }
                );

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return { error: err.error?.message || `Google Ads API error: ${res.status}` };
                }

                const data = await res.json();
                const customerIds = (data.resourceNames || []).map(rn => {
                    const id = rn.split('/').pop();
                    return { id, name: `Account ${id}` };
                });
                return { customers: customerIds };
            }

            default:
                return { error: `Unknown Google Ads tool: ${toolName}` };
        }
    } catch (err) {
        console.error('Google Ads API error:', err.message);
        return { error: `Google Ads error: ${err.message}` };
    }
}
