import express from "express";
import dotenv from "dotenv";
import connectDB from "./database/connectDB.js";
import cors from "cors";
import bodyParser from "body-parser";
import axios from "axios";
import crypto from "crypto";
import telegramRoutes, { bot } from "./routes/telegramRoutes.js";
import cron from "node-cron";
import { Member } from "./database/schema.js";

dotenv.config();

const dbUrl = process.env.DB_URL;

connectDB(dbUrl);
const app = express();
app.use(express.json());
app.use(bodyParser.json());
const port = process.env.PORT || 4000;

app.use(telegramRoutes);

app.get("/", (req, res) => {
  res.send("Hello World");
});

cron.schedule("0 * * * *", async () => {
  console.log("Checking for expired subscriptions...");

  const expiredMembers = await Member.find({
    subscriptionStatus: "active",
    subscriptionExpiry: { $lt: new Date() },
  });

  for (const member of expiredMembers) {
    try {
      await bot.telegram.banChatMember("1002444344905", member.telegramId);
      console.log(`Kicked ${member.telegramId} from the group`);

      await Member.updateOne(
        { _id: member._id },
        { subscriptionStatus: "expired", groupAccessGranted: false }
      );
    } catch (error) {
      console.error(`Failed to kick ${member.telegramId}:`, error);
    }
  }
});

app.post("/webhook", async (req, res) => {
  try {
    const event = req.body;
    const eventName = event.meta.event_name;
    const eventData = event.data;
    const customData = eventData.attributes.custom_data
      ? JSON.parse(decodeURIComponent(eventData.attributes.custom_data))
      : null;

    if (!customData) {
      console.error("Missing custom data in webhook event");
      return res.status(400).send({ error: "Invalid webhook event" });
    }

    const userId = customData.user_id;

    switch (eventName) {
      case "subscription_created":
        await Member.updateOne(
          { telegramId: userId },
          {
            subscriptionStatus: "active",
            subscriptionStart: new Date(eventData.attributes.created_at),
            subscriptionExpiry: new Date(eventData.attributes.ends_at),
            paid: true,
            groupAccessGranted: true,
          }
        );

        // Add user to the group
        await bot.telegram.unbanChatMember("1002444344905", userId);
        console.log(`Added ${userId} to the group`);
        break;

      case "subscription_cancelled":
        await Member.updateOne(
          { telegramId: userId },
          { subscriptionStatus: "cancelled" }
        );
        console.log(`Subscription cancelled for ${userId}`);
        break;

      case "subscription_expired":
        await Member.updateOne(
          { telegramId: userId },
          { subscriptionStatus: "expired", groupAccessGranted: false }
        );

        // Kick user from the group
        await bot.telegram.banChatMember("1002444344905", userId);
        console.log(`Removed ${userId} from the group`);
        break;

      case "subscription_resumed":
        await Member.updateOne(
          { telegramId: userId },
          {
            subscriptionStatus: "active",
            subscriptionExpiry: new Date(eventData.attributes.ends_at),
          }
        );

        // Add user back to the group
        await bot.telegram.unbanChatMember("1002444344905", userId);
        console.log(`Resumed subscription for ${userId}`);
        break;

      case "subscription_payment_failed":
        console.log(`Payment failed for ${userId}`);
        break;

      case "subscription_payment_success":
        await Member.updateOne(
          { telegramId: userId },
          { subscriptionStatus: "active", paid: true }
        );
        console.log(`Payment successful for ${userId}`);
        break;

      default:
        console.log("Unhandled event:", eventName);
    }

    res.status(200).send({ success: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).send({ error: "Webhook processing failed" });
  }
});

app.listen(port, () => {
  console.log(`server is running on ${port}`);
});
