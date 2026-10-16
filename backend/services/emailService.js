/**
 * MarketSphere Email Service Provider Abstraction
 * Supports SMTP/SendGrid configuration with transparent development console logging.
 */
class EmailService {
  constructor() {
    this.provider = process.env.EMAIL_PROVIDER || 'CONSOLE';
    this.isConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
  }

  async sendEmail(to, subject, body, templateType = 'GENERAL', customHtml = null) {
    if (this.isConfigured && process.env.NODE_ENV === 'production') {
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });

        await transporter.sendMail({
          from: process.env.EMAIL_FROM || '"MarketSphere" <no-reply@marketsphere.com>',
          to,
          subject,
          text: body,
          html: customHtml || `<div style="font-family: Arial, sans-serif; padding: 20px;">
                  <h2>${subject}</h2>
                  <p>${body.replace(/\n/g, '<br/>')}</p>
                  <hr style="margin-top: 30px; border: 0; border-top: 1px solid #eee;" />
                  <small style="color: #888;">MarketSphere Multi-Vendor Marketplace</small>
                 </div>`
        });
        return { delivered: true, provider: 'SMTP' };
      } catch (err) {
        console.error('[EMAIL] Failed sending email via SMTP:', err.message);
        return { delivered: false, error: err.message };
      }
    }

    // Development / Test Mode: Clearly logged without claiming external delivery
    console.log(`[EMAIL DEVELOPMENT DISPATCH] [Template: ${templateType}]`);
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Body preview: ${body.substring(0, 100)}...`);
    console.log('  Status: Logged to dev console (no SMTP provider credentials configured)');
    return { delivered: false, mode: 'DEVELOPMENT_SIMULATION' };
  }

  async sendOrderConfirmation(to, order) {
    const subject = `Order Confirmation #${order._id.toString().slice(-6)}`;
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

  async sendOtpEmail(to, otp) {
    const subject = `Your MarketSphere Verification Code is ${otp}`;
    const body = `Welcome to MarketSphere! Your one-time verification code (OTP) is: ${otp}. It is valid for 10 minutes. Please enter this code on the registration page to verify your email address.`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #f59e0b; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">MarketSphere</h1>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Empowering Independent Commerce</p>
        </div>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <p style="color: #334155; font-size: 15px; font-weight: 600; margin: 0 0 16px 0;">Verify Your Email Address</p>
          <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0f172a; font-family: monospace; padding: 12px 20px; background-color: #ffffff; border: 2px dashed #cbd5e1; border-radius: 8px; display: inline-block;">
            ${otp}
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin: 16px 0 0 0;">This code is valid for 10 minutes. Do not share it with anyone.</p>
        </div>
        <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0;">
          If you did not request this verification code, please ignore this email. Your account will not be activated without this verification.
        </p>
        <hr style="margin-top: 28px; border: 0; border-top: 1px solid #f1f5f9;" />
        <p style="text-align: center; color: #94a3b8; font-size: 11px; margin: 16px 0 0 0;">
          © ${new Date().getFullYear()} MarketSphere Inc. All rights reserved.
        </p>
      </div>
    `;
    return this.sendEmail(to, subject, body, 'EMAIL_OTP_VERIFICATION', html);
  }
}

module.exports = new EmailService();