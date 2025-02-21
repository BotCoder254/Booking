const mpesaConfig = {
    consumerKey: process.env.MPESA_CONSUMER_KEY || "frmypHgIJYc7mQuUu5NBvnYc0kF1StP3",
    consumerSecret: process.env.MPESA_CONSUMER_SECRET || "UAeJAJLNUkV5MLpL",
    businessShortCode: process.env.MPESA_SHORTCODE || "4121151",
    passkey: process.env.MPESA_PASSKEY || "68cb945afece7b529b4a0901b2d8b1bb3bd9daa19bfdb48c69bec8dde962a932",
    callbackUrl: process.env.NODE_ENV === 'production' 
        ? `${process.env.BASE_URL_PROD}/api/mpesa/callback`
        : `${process.env.BASE_URL_DEV}/api/mpesa/callback`,
    transactionType: "CustomerPayBillOnline",
    accountReference: "KIOTA",
    transactionDesc: "Mpesa Payment"
};

module.exports = mpesaConfig;
