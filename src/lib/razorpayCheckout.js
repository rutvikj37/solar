/** Shared Razorpay Checkout.js helpers (subscriptions + one-time orders). */

export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function describeRazorpayFailure(resp) {
  const desc = String(resp?.error?.description || resp?.error?.reason || '').trim();
  const code = String(resp?.error?.code || '').trim();
  const statusCode = Number(resp?.error?.statusCode || resp?.statusCode || 0);
  const blob = `${desc} ${code} ${statusCode}`.toLowerCase();
  const isOtpLockout =
    statusCode === 429 ||
    /429|rate limit|too many.*otp|otp.*too many|failed otp verification attempts|otp.*locked|too many attempts/.test(
      blob,
    );
  if (isOtpLockout) {
    return {
      message:
        'OTP verification locked after too many attempts. Wait 30–60 minutes, then retry in incognito with OTP 123456.',
      isOtpLockout: true,
    };
  }
  if (/incorrect otp|invalid otp|otp verification failed/.test(blob)) {
    return {
      message:
        'OTP verification failed. In Razorpay test mode, enter exactly 123456 (not random digits).',
      isOtpLockout: false,
    };
  }
  return {
    message: desc || 'Payment failed. Please try again.',
    isOtpLockout: false,
  };
}

export async function openRazorpayOrderCheckout({
  keyId,
  orderId,
  amount,
  currency = 'USD',
  name = 'SolarX.live',
  description = 'Payment',
  prefill = {},
  onSuccess,
  onDismiss,
  onFailure,
}) {
  const ok = await loadRazorpayScript();
  if (!ok || !window.Razorpay) {
    throw new Error('Could not load Razorpay checkout');
  }

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: keyId,
      amount,
      currency,
      order_id: orderId,
      name,
      description,
      prefill,
      theme: { color: '#22c55e' },
      modal: {
        ondismiss: () => {
          onDismiss?.();
          resolve({ dismissed: true });
        },
      },
      handler: async (response) => {
        try {
          const result = await onSuccess?.(response);
          resolve({ dismissed: false, response, result });
        } catch (err) {
          reject(err);
        }
      },
    });

    rzp.on('payment.failed', (resp) => {
      const { message, isOtpLockout } = describeRazorpayFailure(resp);
      onFailure?.({ message, isOtpLockout, resp });
      reject(new Error(message));
    });

    rzp.open();
  });
}

export async function openRazorpaySubscriptionCheckout({
  keyId,
  subscriptionId,
  name = 'SolarX.live',
  description = 'Monthly plan',
  prefill = {},
  onSuccess,
  onDismiss,
  onFailure,
}) {
  const ok = await loadRazorpayScript();
  if (!ok || !window.Razorpay) {
    throw new Error('Could not load Razorpay checkout');
  }

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: keyId,
      subscription_id: subscriptionId,
      name,
      description,
      prefill,
      theme: { color: '#22c55e' },
      modal: {
        ondismiss: () => {
          onDismiss?.();
          resolve({ dismissed: true });
        },
      },
      handler: async (response) => {
        try {
          const result = await onSuccess?.(response);
          resolve({ dismissed: false, response, result });
        } catch (err) {
          reject(err);
        }
      },
    });

    rzp.on('payment.failed', (resp) => {
      const { message, isOtpLockout } = describeRazorpayFailure(resp);
      onFailure?.({ message, isOtpLockout, resp });
      reject(new Error(message));
    });

    rzp.open();
  });
}
