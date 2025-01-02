import { Router } from "express";
import dotenv from "dotenv";
import { Telegraf } from "telegraf";
import { retry } from "../controllers/retry.js";
import { extractCountryCodeAndPhoneNumber } from "../controllers/extractPhoneNumber.js";
import { Member } from "../database/schema.js";

dotenv.config();

const router = Router();

const bot = new Telegraf(process.env.BOT_TOKEN);
let payMonthly;
let payYearly;

bot.start(async (ctx) => {
  try {
    ctx.reply(
      `👋Hello there 🎉\n\nI am the community bot for the Virtual Real Estate community.\n\nWould you like to be a member of the community?`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Yes, i want to be a member",
                callback_data: "yes_i_do",
              },
              {
                text: "No, i don't want to ",
                callback_data: "no_i_dont",
              },
            ],
          ],
        },
      }
    );
  } catch (error) {
    console.error("Error in bot start command:", error);
  }
});

bot.action("no_i_don't", (ctx) => {});
bot.action("yes_i_do", (ctx) => {
  const communtiyName = "Virtual Real Estate Community";
  const monthlyPlan = "₦3,000";
  const yearlyPlan = "₦30,000";
  try {
    ctx.reply(
      `Lovely😁, future community member! 🎉\n\nBeing part of the **${communtiyName}** comes with exciting perks and opportunities. To join, we have the following membership plans:\n\n💰 **monthly Plan:**${monthlyPlan}\n💰 **Yearly Plan:**${yearlyPlan} (Best Value!)\n\n👇 Kindly choose your payment plan below to get started:`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Pay Monthly (₦5,000)", callback_data: "pay_monthly" },
              {
                text: "Pay Yearly (₦50,000)",
                callback_data: "pay_yearly",
              },
            ],
          ],
        },
      }
    );
  } catch (error) {
    console.error("Error in bot start command:", error);
  }
});

const userStates = new Map();

bot.action("pay_monthly", async (ctx) => {
  try {
    await ctx.answerCbQuery(); // Acknowledge callback query
    const userId = ctx.from.id;

    payMonthly = true;
    payYearly = false;
    // Initialize user state
    userStates.set(userId, { step: "firstName" });

    // Ask for the user's first name
    await ctx.reply("Great choice! 😊 What's your first name?");
  } catch (error) {
    console.error("Error handling payment plan selection:", error);
  }
});

bot.action("pay_yearly", async (ctx) => {
  try {
    await ctx.answerCbQuery(); // Acknowledge callback query
    const userId = ctx.from.id;

    payMonthly = false;
    payYearly = true;
    // Initialize user state
    userStates.set(userId, { step: "firstName" });

    // Ask for the user's first name
    await ctx.reply("Great choice! 😊 What's your first name?");
  } catch (error) {
    console.error("Error handling payment plan selection:", error);
  }
});

bot.action(["pay_monthly", "pay_yearly"], async (ctx) => {
  try {
    await ctx.answerCbQuery(); // Acknowledge callback query
    const userId = ctx.from.id;

    // Initialize user state
    userStates.set(userId, { step: "firstName" });

    // Ask for the user's first name
    await ctx.reply("Great choice! 😊 What's your first name?");
  } catch (error) {
    console.error("Error handling payment plan selection:", error);
  }
});

bot.on("text", async (ctx) => {
  try {
    const userId = ctx.from.id;
    let userState = userStates.get(userId);

    if (!userState) {
      // If the user state is not found, start the flow
      userState = { step: "firstName" };
      userStates.set(userId, userState);
    }

    const userInput = ctx.message.text;

    if (userState.step === "firstName") {
      userState.firstName = userInput;
      userState.step = "lastName";
      await ctx.reply("Thanks! Now, what's your last name?");
    } else if (userState.step === "lastName") {
      userState.lastName = userInput;
      userState.step = "email";
      await ctx.reply("Great! Now, please provide your best email address.");
    } else if (userState.step === "email") {
      userState.email = userInput;
      userState.step = "phoneNumber";
      await ctx.reply(
        "Got it! Lastly, could you please share your phone number in country code format? (e.g +2347048268704)"
      );
    } else if (userState.step === "phoneNumber") {
      userState.phoneNumber = userInput;

      // Acknowledge and finalize the process
      await ctx.reply(
        `Thanks, ${userState.firstName} ${userState.lastName}! 🎉\n` +
          `We have your phone number as ${userState.phoneNumber} and your email as ${userState.email}. Our team will contact you shortly to complete your registration.`
      );

      // Show the "Are your details correct?" button
      await ctx.reply(
        `Are your details correct?\n\n` +
          `First Name: ${userState.firstName}\n` +
          `Last Name: ${userState.lastName}\n` +
          `Email: ${userState.email}\n` +
          `Phone Number: ${userState.phoneNumber}`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Yes, everything is correct",
                  callback_data: "confirm_details",
                },
                {
                  text: "No, I want to change something",
                  callback_data: "change_details",
                },
              ],
            ],
          },
        }
      );

      // Log the user data
      console.log(userState);
    }
  } catch (error) {
    console.error("Error handling user input:", error);
  }
});

bot.action("confirm_details", async (ctx) => {
  const userId = ctx.from.id;
  const userState = userStates.get(userId);

  if (!userState) {
    // Fallback if userState is missing
    await ctx.reply(
      "It looks like your session has expired. Please start the registration process again."
    );
    return;
  }

  await ctx.answerCbQuery(); // Acknowledge the callback query

  try {
    // Extract country code and phone number without the country code
    const { countryCode, phoneNumberWithoutCode } =
      extractCountryCodeAndPhoneNumber(userState.phoneNumber);

    // Create the member in the database
    const newMember = new Member({
      firstName: userState.firstName,
      lastName: userState.lastName,
      email: userState.email,
      phoneNumber: phoneNumberWithoutCode, // Set the phone number without the country code
      telegramId: userId,
      countryCode: countryCode, // Set the extracted country code
      subscriptionStatus: "inactive", // Set initial status to inactive
      user: userId, // Link the user ID
      subscriptionStart: null, // Subscription start date will be set later
      subscriptionExpiry: null, // Subscription expiry date will be set later
      paid: false, // Initially, payment is false
    });

    // Save the new member to the database
    await newMember.save();

    const customData = {
      user_id: userId,
      email: userState.email,
      phone: userState.phoneNumber,
    };

      // Encode custom data as a query parameter
      const encodedCustomData = encodeURIComponent(JSON.stringify(customData));

      // Build the payment URL dynamically
      const url = payMonthly
        ? `https://telegram-bot-custom-demo.lemonsqueezy.com/buy/134d7d0c-a594-4578-9abf-1ce9d08ad81d?custom_data=${encodedCustomData}`
        : `https://telegram-bot-custom-demo.lemonsqueezy.com/buy/134d7d0c-a594-4578-9abf-1ce9d08ad81d?custom_data=${encodedCustomData}`;
  
    await ctx.reply(
      `Thanks for confirming, ${userState.firstName} ${userState.lastName}! 🎉\nWe have your details saved. Please follow this url to make payment to gain access to the community👉:${url}`
    );
  } catch (error) {
    console.error("Error saving member:", error);
    await ctx.reply(
      `There was an error processing your details. Please use the "/start" command to start again.`
    );
  }

  // Final confirmation message

  // Clear user state after confirmation
  userStates.delete(userId);
});

bot.action("change_details", async (ctx) => {
  const userId = ctx.from.id;
  const userState = userStates.get(userId);

  if (!userState) {
    // Fallback if userState is missing
    await ctx.reply(
      "It looks like your session has expired. Please start the registration process again. Just write the `start `command to start again. "
    );
    return;
  }

  await ctx.answerCbQuery(); // Acknowledge the callback query

  // Ask which detail they want to change
  await ctx.reply(
    `Which detail would you like to change? Please choose one below:`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "First Name", callback_data: "change_first_name" },
            { text: "Last Name", callback_data: "change_last_name" },
          ],
          [
            { text: "Email", callback_data: "change_email" },
            { text: "Phone Number", callback_data: "change_phone_number" },
          ],
        ],
      },
    }
  );
});

bot.action("change_first_name", async (ctx) => {
  const userId = ctx.from.id;
  const userState = userStates.get(userId);

  if (!userState) {
    // Fallback if userState is missing
    await ctx.reply(
      "It looks like your session has expired. Please start the registration process again."
    );
    return;
  }

  await ctx.answerCbQuery(); // Acknowledge the callback query

  // Ask for the new first name
  userState.step = "firstName"; // Reset the step
  await ctx.reply("Please provide your new first name.");
});

bot.action("change_last_name", async (ctx) => {
  const userId = ctx.from.id;
  const userState = userStates.get(userId);

  if (!userState) {
    // Fallback if userState is missing
    await ctx.reply(
      "It looks like your session has expired. Please start the registration process again."
    );
    return;
  }

  await ctx.answerCbQuery(); // Acknowledge the callback query

  // Ask for the new last name
  userState.step = "lastName"; // Reset the step
  await ctx.reply("Please provide your new last name.");
});

bot.action("change_email", async (ctx) => {
  const userId = ctx.from.id;
  const userState = userStates.get(userId);

  if (!userState) {
    // Fallback if userState is missing
    await ctx.reply(
      "It looks like your session has expired. Please start the registration process again."
    );
    return;
  }

  await ctx.answerCbQuery(); // Acknowledge the callback query

  // Ask for the new email
  userState.step = "email"; // Reset the step
  await ctx.reply("Please provide your new email.");
});

bot.action("change_phone_number", async (ctx) => {
  const userId = ctx.from.id;
  const userState = userStates.get(userId);

  if (!userState) {
    // Fallback if userState is missing
    await ctx.reply(
      "It looks like your session has expired. Please start the registration process again."
    );
    return;
  }

  await ctx.answerCbQuery(); // Acknowledge the callback query

  // Ask for the new phone number
  userState.step = "phoneNumber"; // Reset the step
  await ctx.reply("Please provide your new phone number.");
});

// Write create member logic here

bot.on("new_chat_members", async (ctx) => {
  const groupId = ctx.chat?.id;
  const groupName = ctx.chat?.title;
  const userTelegramId = ctx.from?.id;
  const newMember = ctx.message.new_chat_member;

  console.log(
    "groupId: ",
    groupId,
    "groupName: ",
    groupName,
    "userTelegramId: ",
    userTelegramId,
    "newMember: ",
    newMember
  );

  try {
    ctx.reply();
  } catch (error) {}
});

retry(() => bot.launch(), 5, 3000)
  .then(() => console.log("Bot launched successfully!"))
  .catch((err) => {
    console.error("Failed to launch bot after multiple retries:", err.message);
    process.exit(1); // Exit the app if retries are exhausted
  });
export { bot };
export default router;

// listen for webhook
