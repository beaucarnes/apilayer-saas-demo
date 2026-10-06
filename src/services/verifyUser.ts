import { ApiClient, ApiError } from '../apiClient.js';
import { endpoints } from '../config.js';
import { emailSchema } from '../schemas.js';

export interface EmailCheck {
  decision: 'pass' | 'reject' | 'review';
  reason: string;
  score: number | null;
}

export async function validateRegistrationEmail(client: ApiClient, email: string): Promise<EmailCheck> {
  const data = await client.get('mailboxlayer', endpoints.mailboxlayer, { email, smtp: '1' }, emailSchema);
  if (data.email.toLowerCase() !== email.toLowerCase()) {
    throw new ApiError('mailboxlayer', 'invalid_response');
  }
  const result = (decision: EmailCheck['decision'], reason: string): EmailCheck => ({
    decision, reason, score: data.score,
  });
  if (data.format_valid === false) return result('reject', 'Invalid email syntax');
  if (data.disposable === true) return result('reject', 'Disposable address rejected by this demo policy');
  if (data.mx_found === false) return result('reject', 'No MX records found');

  // SMTP and scores are evidence, not proof of ownership or guaranteed delivery.
  // 0.6 is an illustrative app policy, not an APILayer recommendation.
  if (data.format_valid !== true || data.disposable !== false || data.mx_found !== true ||
      data.smtp_check !== true || data.score === null || data.score < 0.6 || data.catch_all === true) {
    return result('review', 'Email checks are uncertain; additional verification required');
  }
  return result('pass', 'Deliverability checks passed; email ownership still needs verification');
}
