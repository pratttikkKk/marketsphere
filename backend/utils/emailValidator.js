const dns = require('dns').promises;

// Known disposable/temporary email domains
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'guerrillamailblock.com',
  'throwawaymail.com',
  'yopmail.com',
  'sharklasers.com',
  'dispostable.com',
  'trashmail.com',
  'trashmail.net',
  'getnada.com',
  'fake.com',
  'test.com',
  'example.com',
  'temp-mail.org',
  'generator.email',
  'emailondeck.com',
  'mohmal.com',
  'maildrop.cc',
  'inboxkitten.com',
  'crazymailing.com',
  'burnermail.io',
  'mytemp.email',
  'tempinbox.com',
  'spambox.us',
  'throwawayemailaddress.com',
  'mailnesia.com',
  'dropmail.me',
  'tempmailaddress.com',
  'fakeinbox.com'
]);

// Strict RFC 5322 compliant email regex
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Validates whether an email is structurally valid, not disposable,
 * and belongs to a real domain with active Mail Exchange (MX) records.
 *
 * @param {string} email
 * @returns {Promise<{ isValid: boolean, message?: string, normalizedEmail?: string }>}
 */
async function validateRealEmail(email) {
  if (!email || typeof email !== 'string') {
    return { isValid: false, message: 'Email address is required.' };
  }

  const normalizedEmail = email.trim().toLowerCase();

  // 1. Length validation
  if (normalizedEmail.length > 254) {
    return { isValid: false, message: 'Email address exceeds maximum length of 254 characters.' };
  }

  const parts = normalizedEmail.split('@');
  if (parts.length !== 2) {
    return { isValid: false, message: 'Please enter a valid email address containing a single @ symbol.' };
  }

  const [localPart, domain] = parts;

  if (localPart.length === 0 || localPart.length > 64) {
    return { isValid: false, message: 'The local part of the email must be between 1 and 64 characters.' };
  }

  // 2. Syntax validation
  if (!EMAIL_REGEX.test(normalizedEmail) || normalizedEmail.includes('..')) {
    return { isValid: false, message: 'Please enter a valid email format (e.g., yourname@domain.com).' };
  }

  // 3. Domain validation
  if (!domain.includes('.')) {
    return { isValid: false, message: 'Email domain must contain a valid top-level domain (e.g., .com, .org).' };
  }

  const tld = domain.split('.').pop();
  if (!tld || tld.length < 2) {
    return { isValid: false, message: 'Email domain has an invalid top-level domain.' };
  }

  // 4. Check against disposable / temporary email providers
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      isValid: false,
      message: 'Temporary or disposable email addresses are not permitted. Please use a permanent email address (e.g. Gmail, Outlook, Yahoo).'
    };
  }

  // 5. Check DNS MX Records (Verify real mail exchange server exists)
  try {
    const mxRecords = await Promise.race([
      dns.resolveMx(domain),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 4000))
    ]);

    if (!mxRecords || mxRecords.length === 0) {
      return {
        isValid: false,
        message: `The email domain "${domain}" has no mail servers configured to receive emails. Please use a valid, active email address.`
      };
    }
  } catch (err) {
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA' || err.code === 'SERVFAIL') {
      return {
        isValid: false,
        message: `The email domain "${domain}" does not exist or cannot receive mail. Please check your spelling and provide a real email address.`
      };
    }
    // If DNS query timed out, log warning and let standard delivery attempt proceed
    if (err.message === 'TIMEOUT') {
      console.warn(`[EMAIL VALIDATOR] DNS MX query timed out for domain ${domain}. Proceeding.`);
    } else {
      console.warn(`[EMAIL VALIDATOR] DNS MX resolution error for ${domain}:`, err.message);
    }
  }

  return { isValid: true, normalizedEmail };
}

/**
 * Validates mobile number format and normalizes it.
 * Supports standard 10-digit numbers and international format with country code (+91, etc.)
 *
 * @param {string} phone
 * @returns {{ isValid: boolean, message?: string, normalizedPhone?: string }}
 */
function validateMobileNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, message: 'Mobile number is required.' };
  }

  // Remove spaces, dashes, parentheses
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');

  // Must contain only digits or start with + followed by digits
  if (!/^\+?\d{10,15}$/.test(cleaned)) {
    return {
      isValid: false,
      message: 'Please enter a valid mobile number (10 to 15 digits, e.g. 9876543210 or +919876543210).'
    };
  }

  // If 10 digits without prefix, ensure it starts with valid mobile prefix (like 6-9 in India or 1-9 generally)
  if (/^\d{10}$/.test(cleaned)) {
    if (/^[0-5]/.test(cleaned)) {
      return {
        isValid: false,
        message: 'A 10-digit mobile number must start with a valid digit (6, 7, 8, or 9).'
      };
    }
  }

  return { isValid: true, normalizedPhone: cleaned };
}

module.exports = {
  validateRealEmail,
  validateMobileNumber
};
