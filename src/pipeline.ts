import { ApiClient, safeError } from './apiClient.js';
import { validateInput, type SignupInput } from './inputs.js';
import { validateRegistrationEmail } from './services/verifyUser.js';
import { getClientContext, type ClientContext } from './services/geoService.js';
import { getDashboardFeeds } from './services/dashboardFeed.js';

export async function handleUserSignup(client: ApiClient, input: SignupInput, securityEnabled: boolean) {
  const { email, userIp, primaryTicker } = validateInput(input);
  const emailCheck = await validateRegistrationEmail(client, email);
  // Stop before spending more requests on a rejected or uncertain address.
  if (emailCheck.decision !== 'pass') {
    return { status: emailCheck.decision === 'reject' ? 'rejected' : 'review_required', emailCheck,
      nextAction: emailCheck.decision === 'reject' ? 'Use a different email address' : 'Resolve email uncertainty before continuing',
      context: null, dashboard: null, warnings: [] };
  }

  let context: ClientContext | null = null;
  const warnings: string[] = [];
  try {
    context = await getClientContext(client, userIp, securityEnabled);
    warnings.push(...context.warnings);
  } catch (error) {
    warnings.push(safeError(error));
  }
  const requiresReview = securityEnabled && (!context || ['review', 'unavailable'].includes(context.security.status));
  if (requiresReview) {
    return { status: 'review_required', emailCheck, context, dashboard: null, warnings,
      nextAction: 'Complete additional verification before continuing; no automatic proxy ban' };
  }

  const dashboard = await getDashboardFeeds(client, primaryTicker);
  warnings.push(...dashboard.warnings);
  // This example prepares data. It does not persist a user or send a verification email.
  return { status: 'ready_for_verification', emailCheck, context, dashboard, warnings,
    nextAction: 'Verify email ownership before activating the account' };
}
