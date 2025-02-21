const axios = require("axios");
const moment = require("moment");

// ACCESS TOKEN FUNCTION
async function getAccessToken() {
  const consumer_key = "frmypHgIJYc7mQuUu5NBvnYc0kF1StP3"; 
  const consumer_secret = "UAeJAJLNUkV5MLpL"; 
  const url = "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";

  const auth = "Basic " + Buffer.from(consumer_key + ":" + consumer_secret).toString("base64");

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: auth,
      },
    });
    const accessToken = response.data.access_token;
    return accessToken;
  } catch (error) {
    throw error;
  }
}

// STK Push Function
async function initiateSTKPush(phoneNumber, amount) {
  try {
    // Debug log
    console.log("Initiating STK Push for:", { phoneNumber, amount });
    
    // Validate required fields
    if (!phoneNumber || !amount) {
      throw new Error("Missing required fields. Please provide both 'phone' and 'amount'");
    }

    // Format the phone number
    phoneNumber = phoneNumber.toString().trim();
    // Remove leading zeros, plus, or spaces
    phoneNumber = phoneNumber.replace(/^\+|^0+|\s+/g, "");
    // Add country code if not present
    if (!phoneNumber.startsWith("254")) {
      phoneNumber = "254" + phoneNumber;
    }

    const accessToken = await getAccessToken();
    const url = "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest";
    const auth = "Bearer " + accessToken;
    const timestampx = moment().format("YYYYMMDDHHmmss");
    const password = Buffer.from(
      "4121151" +
      "68cb945afece7b529b4a0901b2d8b1bb3bd9daa19bfdb48c69bec8dde962a932" +
      timestampx
    ).toString("base64");

    const response = await axios.post(
      url,
      {
        BusinessShortCode: "4121151",
        Password: password,
        Timestamp: timestampx,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phoneNumber,
        PartyB: "4121151",
        PhoneNumber: phoneNumber,
        CallBackURL: "https://github.com/BotCoder254",
        AccountReference: "KIOTA",
        TransactionDesc: "Mpesa Daraja API stk push test",
      },
      {
        headers: {
          Authorization: auth,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("STK Push Error:", error);
    throw error;
  }
}

// Query STK Status Function
async function querySTKStatus(queryCode) {
  try {
    const accessToken = await getAccessToken();
    const url = "https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query";
    const auth = "Bearer " + accessToken;
    const timestampx = moment().format("YYYYMMDDHHmmss");
    const password = Buffer.from(
      "4121151" +
      "68cb945afece7b529b4a0901b2d8b1bb3bd9daa19bfdb48c69bec8dde962a932" +
      timestampx
    ).toString("base64");

    const response = await axios.post(
      url,
      {
        BusinessShortCode: "4121151",
        Password: password,
        Timestamp: moment().format("YYYYMMDDHHmmss"),
        CheckoutRequestID: queryCode,
      },
      {
        headers: {
          Authorization: auth,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Query STK Status Error:", error);
    throw error;
  }
}

// Helper function to get timestamp
function getTimestamp() {
  return moment().format("YYYYMMDDHHmmss");
}

module.exports = {
  getAccessToken,
  initiateSTKPush,
  querySTKStatus,
  getTimestamp
};