/**
 * lib/emailService.ts
 *
 * Frontend email service for ETAM.
 *
 * All emails are sent via the backend /api/send-email endpoint.
 * The JWT token is attached automatically so the `authenticate` middleware passes.
 *
 * NOTE: Student welcome emails are now also sent directly from studentController.js
 * on the backend (after createStudent succeeds), so even if this frontend call
 * fails the student still receives their credentials.
 *
 * Exported functions:
 *   sendStudentWelcomeEmail  — called from the Add Student dialog on create
 *   sendOtpEmail             — called from OTP verification flows
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WelcomeEmailPayload {
  toEmail:         string;
  studentName:     string;
  username:        string;       // same as toEmail — used as login ID
  tempPassword:    string;
  institutionName: string;
}

export interface OtpEmailPayload {
  toEmail:          string;
  otp:              string;
  expiresInMinutes?: number;
}

// ─── Helper: get stored JWT token ────────────────────────────────────────────

function getAuthToken(): string {
  // Adjust the key name to match wherever your app stores the JWT
  // Common locations: 'token', 'authToken', 'jwt', 'access_token'
  return (
    localStorage.getItem('token') ||
    localStorage.getItem('authToken') ||
    localStorage.getItem('jwt') ||
    ''
  );
}

// ─── Internal: POST to /api/send-email with auth header ──────────────────────

async function callSendEmailAPI(payload: {
  to:      string;
  subject: string;
  html:    string;
}): Promise<void> {
  const token = getAuthToken();

  const response = await fetch('/api/send-email', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      // Attach the JWT so the `authenticate` middleware on the backend accepts the request
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).message || `Email send failed (${response.status})`);
  }
}

// ─── 1. Welcome email with temporary password ─────────────────────────────────

export async function sendStudentWelcomeEmail(
  payload: WelcomeEmailPayload
): Promise<void> {
  const { toEmail, studentName, username, tempPassword, institutionName } = payload;

  const html = buildWelcomeEmailHtml({
    studentName,
    username,
    tempPassword,
    institutionName,
  });

  await callSendEmailAPI({
    to:      toEmail,
    subject: `Welcome to ${institutionName} — Your Login Credentials`,
    html,
  });
}

// ─── 2. OTP / verification email ─────────────────────────────────────────────

export async function sendOtpEmail(payload: OtpEmailPayload): Promise<void> {
  const { toEmail, otp, expiresInMinutes = 10 } = payload;

  const html = buildOtpEmailHtml({ otp, expiresInMinutes });

  await callSendEmailAPI({
    to:      toEmail,
    subject: 'Your Verification Code',
    html,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML Templates
// ─────────────────────────────────────────────────────────────────────────────

function buildWelcomeEmailHtml({
  studentName,
  username,
  tempPassword,
  institutionName,
}: Omit<WelcomeEmailPayload, 'toEmail'>): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Welcome to ${institutionName}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:16px;overflow:hidden;
                 box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#3b82f6 100%);
                       padding:36px 40px;text-align:center;">
              <div style="display:inline-flex;align-items:center;justify-content:center;
                          width:56px;height:56px;background:rgba(255,255,255,0.2);
                          border-radius:14px;margin-bottom:16px;">
                <span style="font-size:28px;">✅</span>
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;
                         letter-spacing:-0.3px;">
                Welcome to ${institutionName}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 8px;color:#374151;font-size:15px;">
                Dear <strong>${studentName}</strong>,
              </p>
              <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6;">
                Congratulations on joining <strong>${institutionName}</strong>!
                Here are your login credentials to access your account on our mobile app.
              </p>

              <!-- Credentials box -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#f8faff;border:1.5px solid #e0e7ff;
                       border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom:12px;">
                          <span style="font-size:11px;font-weight:600;color:#6366f1;
                                       text-transform:uppercase;letter-spacing:1px;">
                            Username
                          </span><br/>
                          <span style="font-size:14px;font-weight:600;color:#4f46e5;">
                            ${username}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td style="border-top:1px solid #e0e7ff;padding-top:12px;">
                          <span style="font-size:11px;font-weight:600;color:#6366f1;
                                       text-transform:uppercase;letter-spacing:1px;">
                            Temporary Password
                          </span><br/>
                          <span style="font-size:22px;font-weight:700;color:#111827;
                                       letter-spacing:3px;font-family:'Courier New',monospace;">
                            ${tempPassword}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Security note -->
              <div style="background:#fff7ed;border:1px solid #fed7aa;
                          border-radius:10px;padding:14px 18px;">
                <p style="margin:0;color:#92400e;font-size:12px;line-height:1.5;">
                  🔒 <strong>Security tip:</strong> Please change your password after your
                  first login. Do not share your credentials with anyone.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #f3f4f6;
                       padding:20px 40px;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                This is an automated message from ${institutionName}.
                If you did not expect this email, please contact your institution admin.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function buildOtpEmailHtml({
  otp,
  expiresInMinutes,
}: {
  otp:              string;
  expiresInMinutes: number;
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Verification Code</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:16px;overflow:hidden;
                 box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#3b82f6 100%);
                       padding:32px 40px;text-align:center;">
              <span style="font-size:36px;">📬</span>
              <h1 style="margin:12px 0 0;color:#ffffff;font-size:20px;font-weight:700;">
                Email Verification
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;text-align:center;">
              <p style="margin:0 0 8px;color:#374151;font-size:15px;">
                Your one-time verification code is:
              </p>

              <!-- OTP display -->
              <div style="margin:24px auto;display:inline-block;
                          background:#f0f4ff;border:2px dashed #a5b4fc;
                          border-radius:14px;padding:20px 40px;">
                <span style="font-size:36px;font-weight:800;letter-spacing:10px;
                             color:#4f46e5;font-family:'Courier New',monospace;">
                  ${otp}
                </span>
              </div>

              <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">
                This code expires in <strong>${expiresInMinutes} minutes</strong>.
                Do not share this code with anyone.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #f3f4f6;
                       padding:20px 40px;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                If you didn't request this code, you can safely ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}