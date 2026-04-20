const notImplemented = (name) => {
  throw new Error(`paymentService: ${name} is not implemented/configured yet`);
};

const createPaymentOrder = async () => notImplemented('createPaymentOrder');
const verifyPayment = async () => notImplemented('verifyPayment');

export { createPaymentOrder, verifyPayment };
