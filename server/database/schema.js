import mongoose, { Schema } from "mongoose";

const userSchema = new Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    telegramId: { type: String },
    revenue: { type: Schema.Types.ObjectId, ref: "Revenue" },
    members: [{ type: Schema.Types.ObjectId, ref: "Member" }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

const memberSchema = new Schema(
  {
    firstName: { type: String, required: true }, // Member's first name
    lastName: { type: String, required: true }, // Member's last name
    countryCode: { type: String },
    phoneNumber: { type: String }, // Member's phone number (optional)
    email: { type: String }, // Member's email (optional)
    telegramId: { type: String }, // Member's unique Telegram ID
    subscriptionStatus: {
      type: String,
      enum: ["active", "inactive", "expired"],
      default: "inactive",
    }, // Current status of the subscription

    // user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    joinedDate: { type: Date, default: Date.now }, // When the member joined the group
    subscriptionStart: { type: Date }, // Start date of their subscription
    subscriptionExpiry: { type: Date }, // Expiry date of the subscription
    paid: { type: Boolean, default: false }, // Has the member paid?
  },
  { timestamps: true }
);

const Member= mongoose.model("Member", memberSchema);


const revenueSchema = new Schema(
  {
    totalEarned: { type: Number, default: 0 }, // Total earnings
    totalWithdrawn: { type: Number, default: 0 }, // Total amount withdrawn
    remainingBalance: { type: Number, default: 0 }, // Remaining balance to withdraw
    payments: [
      {
        amount: { type: Number, required: true }, // Payment amount
        date: { type: Date, default: Date.now }, // Payment date
        method: {
          type: String,
          enum: ["card", "bank", "crypto"],
          default: "card",
        }, // Payment method
        transactionId: { type: String, required: true }, // Unique transaction ID
      },
    ],
    lastDatePaid: { type: Date, default: Date.now }, // Last date the user was paid
    currency: { type: String, default: "NGN" }, // Currency type
  },
  { timestamps: true }
);

const Revenue = mongoose.model("Revenue", revenueSchema);

export { User, Member, Revenue };