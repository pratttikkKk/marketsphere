/**
 * Official Razorpay Checkout integration helper
 * Loads https://checkout.razorpay.com/v1/checkout.js and launches the modal
 */

export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      return resolve(true);
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function launchRazorpayModal({
  keyId,
  providerOrderId,
  amountInPaise,
  currency = 'INR',
  name = 'MarketSphere Marketplace',
  description = 'Order Payment',
  prefill = {},
  themeColor = '#f59e0b'
}) {
  const loaded = await loadRazorpayScript();
  if (!loaded || !window.Razorpay) {
    throw new Error('Razorpay SDK could not be loaded. Please check your network connection.');
  }

  return new Promise((resolve, reject) => {
    const options = {
      key: keyId,
      amount: amountInPaise,
      currency,
      name,
      description,
      order_id: providerOrderId,
      prefill: {
        name: prefill.fullName || '',
        email: prefill.email || '',
        contact: prefill.phone || ''
      },
      theme: {
        color: themeColor
      },
      handler: function (response) {
        // response: { razorpay_payment_id, razorpay_order_id, razorpay_signature }
        resolve(response);
      },
      modal: {
        ondismiss: function () {
          reject(new Error('PAYMENT_DISMISSED'));
        }
      }
    };

    const rzp = new window.Razorpay(options);

    rzp.on('payment.failed', function (response) {
      reject(new Error(response.error?.description || 'Payment failed at gateway'));
    });

    rzp.open();
  });
}
