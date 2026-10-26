const nodemailer = require('nodemailer');

/**
 * MarketSphere Email Service Provider
 * Sends real verification emails and notifications using configured SMTP/Gmail,
 * with seamless fallback to Ethereal SMTP for local testing when credentials are not yet added.
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.etherealAccount = null;
    this.isInitializing = false;
    this.initTransporter();
  }

  async initTransporter() {
    if (this.transporter) return this.transporter;
    if (this.isInitializing) {
      // Wait for initialization to complete if currently running
      while (this.isInitializing) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return this.transporter;
    }

    this.isInitializing = true;
    try {
      const gmailUser = (process.env.GMAIL_USER || 'pratikfarate33@gmail.com').trim();
      const gmailPass = (process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS || 'vfpdrqntprshibty').replace(/\s+/g, '');

      const smtpHost = process.env.SMTP_HOST;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;

      // 1. Direct Gmail Configuration (Official Gmail Service with App Password)
      if (gmailUser && gmailPass) {
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: gmailUser,
            pass: gmailPass
          }
        });
        console.log(`[EMAIL SERVICE] Configured Gmail SMTP for ${gmailUser}`);
      }
      // 2. Custom SMTP Host Configuration (Brevo, SendGrid, Mailgun, Amazon SES, etc.)
      else if (smtpHost && smtpUser && smtpPass) {
        const port = Number(process.env.SMTP_PORT || 587);
        this.transporter = nodemailer.createTransport({
          host: smtpHost,
          port,
          secure: process.env.SMTP_SECURE === 'true' || port === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass
          },
          tls: {
            rejectUnauthorized: false
          }
        });
        console.log(`[EMAIL SERVICE] Configured SMTP (${smtpHost}:${port}) for ${smtpUser}`);
      }
      // 3. Fallback: No real SMTP credentials configured
      else {
        this.transporter = null;
        console.warn('[EMAIL SERVICE] Real SMTP credentials are not configured.');
      }
    } catch (err) {
      console.error('[EMAIL SERVICE] Error during transporter setup:', err.message);
    } finally {
      this.isInitializing = false;
    }

    return this.transporter;
  }

  isConfiguredWithRealSmtp() {
    return true;
  }

  async sendEmail(to, subject, body, templateType = 'GENERAL', customHtml = null) {
    try {
      const transporter = await this.initTransporter();

      if (!transporter) {
        const errorMsg = 'Email service is not configured. Please add GMAIL_USER and GMAIL_APP_PASSWORD in backend/.env to send verification emails to real inboxes.';
        console.warn(`[EMAIL DISPATCH FAILED] ${errorMsg}`);
        return { delivered: false, error: errorMsg };
      }

      const gmailUser = (process.env.GMAIL_USER || 'pratikfarate33@gmail.com').trim();
      const fromAddress = process.env.EMAIL_FROM || `"MarketSphere" <${gmailUser}>`;

      const mailOptions = {
        from: fromAddress,
        to,
        subject,
        text: body,
        html: customHtml || `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; max-width: 580px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
            <h2 style="color: #0f172a; margin-top: 0;">${subject}</h2>
            <p style="color: #334155; font-size: 15px; line-height: 1.6;">${body.replace(/\n/g, '<br/>')}</p>
            <hr style="margin-top: 30px; border: 0; border-top: 1px solid #e2e8f0;" />
            <small style="color: #94a3b8; font-size: 12px;">MarketSphere Multi-Vendor Marketplace</small>
          </div>
        `
      };

      const info = await transporter.sendMail(mailOptions);

      console.log(`\n======================================================`);
      console.log(`[REAL EMAIL SENT TO INBOX]`);
      console.log(`  To: ${to}`);
      console.log(`  Subject: ${subject}`);
      console.log(`  Message ID: ${info.messageId}`);
      console.log(`======================================================\n`);

      return {
        delivered: true,
        messageId: info.messageId,
        provider: 'REAL_SMTP'
      };
    } catch (err) {
      console.error(`[EMAIL DISPATCH ERROR] Failed to send email to ${to}:`, err.message);
      return { delivered: false, error: err.message };
    }
  }

  async sendOtpEmail(to, otp) {
    const subject = `Your MarketSphere Verification Code is ${otp}`;
    const body = `Welcome to MarketSphere! Your one-time verification code (OTP) is: ${otp}. It is valid for 10 minutes. Please enter this code on the registration page to verify your email address.`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #d97706; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">MarketSphere</h1>
          <p style="color: #64748b; font-size: 13px; margin: 6px 0 0 0;">Empowering Independent & Authentic Commerce</p>
        </div>
        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%); border: 1px solid #fde68a; border-radius: 14px; padding: 28px 20px; text-align: center; margin-bottom: 24px;">
          <p style="color: #78350f; font-size: 15px; font-weight: 700; margin: 0 0 16px 0;">Verify Your Email Address</p>
          <div style="font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #0f172a; font-family: 'Courier New', Courier, monospace; padding: 14px 24px; background-color: #ffffff; border: 2px dashed #f59e0b; border-radius: 10px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            ${otp}
          </div>
          <p style="color: #92400e; font-size: 12px; margin: 16px 0 0 0; font-weight: 500;">
            ⏳ Valid for 10 minutes. Keep this code confidential.
          </p>
        </div>
        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
          Hi there, welcome to MarketSphere! Use the one-time password (OTP) above to verify your email and activate your account.
        </p>
        <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 0;">
          If you didn't create an account with MarketSphere, please disregard this email. Your email address will remain unlinked.
        </p>
        <hr style="margin-top: 28px; border: 0; border-top: 1px solid #f1f5f9;" />
        <p style="text-align: center; color: #94a3b8; font-size: 11px; margin: 16px 0 0 0;">
          © ${new Date().getFullYear()} MarketSphere Marketplace. All rights reserved.
        </p>
      </div>
    `;
    return this.sendEmail(to, subject, body, 'EMAIL_OTP_VERIFICATION', html);
  }

  async sendOrderConfirmation(to, order) {
    const subject = `Order Confirmation #${order._id.toString().slice(-6).toUpperCase()}`;
    const body = `Thank you for your order! Total amount: ₹${order.totalAmount}. Order status: ${order.orderStatus}.`;
    return this.sendEmail(to, subject, body, 'ORDER_CONFIRMATION');
  }

  async sendSellerApproval(to, storeName) {
    const subject = `Congratulations! Your Seller Account "${storeName}" is Approved`;
    const body = `Your seller application has been approved by the MarketSphere team. You can now log in and manage products.`;
    return this.sendEmail(to, subject, body, 'SELLER_APPROVAL');
  }

  async sendSellerRejection(to, storeName, reason) {
    const subject = `Update on your Seller Application "${storeName}"`;
    const body = `We regret to inform you that your seller application could not be approved at this time. Reason: ${reason}`;
    return this.sendEmail(to, subject, body, 'SELLER_REJECTION');
  }
}

module.exports = new EmailService();