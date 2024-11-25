const Razorpay = require("razorpay");
require("dotenv").config();
// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RZP_KEY_ID, // Add your Razorpay Key ID here
  key_secret: process.env.RZP_SECRET_KEY, // Add your Razorpay Secret here
});


const createOrder = async (req, res) => {

  const { amount } = req.body; // Amount in INR
  try {
    const options = {
      amount: amount * 100, // Razorpay processes in paise (100 paise = 1 INR)
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    res.status(200).json({
      success: true,
      orderId: order.id,
      amount: options.amount,
      currency: options.currency,
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ success: false, message: "Order creation failed" });
  }
};

module.exports = { createOrder };
