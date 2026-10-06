/**
 * MarketSphere Email Service Provider Abstraction
 * Supports SMTP/SendGrid configuration with transparent development console logging.
 */
class EmailService {
  constructor() {
    this.provider = process.env.EMAIL_PROVIDER || 'CONSOLE';
    this.isConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
  }

  async sendEmail(to, subject, body, templateType = 'GENERAL') {
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
          html: `<div style="font-family: Arial, sans-serif; padding: 20px;">
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
}

module.exports = new EmailService();