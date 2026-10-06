import { ApiClient, safeError } from './apiClient.js';
import { validateInput, type SignupInput } from './inputs.js';
import { validateRegistrationEmail } from './services/verifyUser.js';
import { getClientContext } from './services/geoService.js';
import { getDashboardFeeds } from './services/dashboardFeed.js';

function outcome<T>(result: PromiseSettledResult<T>) {
  return result.status === 'fulfilled'
    ? { status: 'available' as const, data: result.value }
    : { status: 'unavailable' as const, error: safeError(result.reason) };
}

// This API tour shows every service even if email needs review.
// The separate signup workflow in pipeline.ts still gates subsequent requests.
export async function runExamples(client: ApiClient, input: SignupInput, securityEnabled: boolean) {
  const { email, userIp, primaryTicker } = validateInput(input, 'all');
  const [emailResult, contextResult, dashboardResult] = await Promise.allSettled([
    validateRegistrationEmail(client, email),
    getClientContext(client, userIp, securityEnabled),
    getDashboardFeeds(client, primaryTicker),
  ]);
  return { email: outcome(emailResult), context: outcome(contextResult), dashboard: outcome(dashboardResult) };
}

export function examplesComplete(result: Awaited<ReturnType<typeof runExamples>>): boolean {
  return result.email.status === 'available' && result.context.status === 'available' &&
    result.context.data.countryLookup === 'matched' && result.dashboard.status === 'available' &&
    result.dashboard.data.market.status === 'available' && result.dashboard.data.news.status === 'available';
}
