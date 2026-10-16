-- Email Formats: designed HTML wrappers for form-submission emails.
-- A format is a reusable HTML design containing a {{message}} slot (where the
-- composed message goes) plus any {{submitter_*}} / {{Field Label}} tokens.

CREATE TABLE IF NOT EXISTS email_formats (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  html         TEXT NOT NULL,
  is_default   BOOLEAN NOT NULL DEFAULT false,
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM email_formats WHERE is_default = true) THEN
    INSERT INTO email_formats (name, description, html, is_default) VALUES
    (
      'Clean Branded',
      'Simple, professional layout with a colored header and your school name.',
      '<div style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
        <tr><td style="background:#4F46E5;padding:28px 32px;color:#ffffff;">
          <div style="font-size:20px;font-weight:700;letter-spacing:0.3px;">Grace Theological Seminary</div>
          <div style="font-size:13px;opacity:0.85;margin-top:4px;">A message for you</div>
        </td></tr>
        <tr><td style="padding:32px;color:#1f2937;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 16px;">Dear {{submitter_name}},</p>
          <div style="margin:0;">{{message}}</div>
          <p style="margin:24px 0 0;color:#6b7280;font-size:13px;">&mdash; Grace Theological Seminary</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</div>',
      true
    ),
    (
      'Card',
      'Modern card-style layout with a soft background and rounded content card.',
      '<div style="margin:0;padding:0;background:#eef2ff;font-family:''Segoe UI'',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;">
        <tr><td style="padding:0 16px 16px;">
          <h1 style="margin:0;font-size:22px;color:#3730a3;">Hello {{submitter_name}}</h1>
        </td></tr>
        <tr><td style="padding:0 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e0e7ff;border-radius:16px;padding:28px;">
            <tr><td style="color:#111827;font-size:15px;line-height:1.7;">{{message}}</td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 16px 0;text-align:center;color:#6366f1;font-size:12px;">Grace Theological Seminary &middot; Sent with care</td></tr>
      </table>
    </td></tr>
  </table>
</div>',
      true
    );
  END IF;
END $$;
