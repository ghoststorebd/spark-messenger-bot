// 🚀 Ghost Store BD & SPARK AI BD - Centralized 24/7 Messenger Bot (server.js)
const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');
const app = express();
app.use(express.json());

// 🔑 ১. পেজ এক্সেস টোকেন (নতুন টোকেনটি এখানে বসাবেন)
let PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || "EAAMR7ZCs6lokBSBYsHKVCZCWYstvgqeTFPhTQJTi0GjZBZCQceicRnPYZCbVLSmeFIdvngTJ5mGQcHhquPLWpkKZA1DObT0UpQLiHkbLgGoI5NNWfNQ6jIbtlmKyxBcQzHS74rIOfclQAipzb1aV4tig3xmRfqoUAgx0dODaaZAXYMFLAH10WEdPPkboK7oN6j9brajMBrDZArBlGbndqp2cIoQUlgs34rHxWbDfC2ZBB7QEZD";
const VERIFY_TOKEN = "ghost_store_secret_token";

// 🔑 ২. ফায়ারবেজ ডাটাবেজ ইন্টিগ্রেশন
let serviceAccount;
try {
    serviceAccount = require('./serviceAccountKey.json');
} catch (e) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try { serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); } catch (err) {}
    }
}

if (serviceAccount && !admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.apps.length ? admin.firestore() : null;

// ৩. মেটা ওয়েবহুক ভেরিফিকেশন (GET Request)
app.get('/webhook', (req, res) => {
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log("WEBHOOK_VERIFIED");
        res.status(200).send(challenge);
    } else if (challenge) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// ৪. ইনকামিং মেসেঞ্জার মেসেজ প্রসেসিং (POST Request)
app.post('/webhook', async (req, res) => {
    let body = req.body;

    if (body.object === 'page') {
        for (let entry of body.entry) {
            if (entry.messaging && entry.messaging[0]) {
                let webhook_event = entry.messaging[0];
                let sender_psid = webhook_event.sender.id;

                if (webhook_event.message && webhook_event.message.text) {
                    let userMsg = webhook_event.message.text;

                    // এডমিন প্যানেল থেকে লাইভ প্রম্পট ও সেটিংস রিড করা
                    let apiKey = "AQ.Ab8RN6KZTeYGim8_lqesCfsnjEm5j22QCxNRtkKeK1f3IC0ZVA";
                    let botName = "S.P.A.R.K. (Ghost AI)";
                    let customAdminPrompt = "";

                    if (db) {
                        try {
                            let doc = await db.collection("settings").doc("general").get();
                            if (doc.exists) {
                                let data = doc.data();
                                if (data.aiEnabled === false) return;
                                if (data.aiApiKey && data.aiApiKey.trim().length > 10) apiKey = data.aiApiKey.trim();
                                if (data.aiBotName) botName = data.aiBotName;
                                if (data.aiSystemPrompt) customAdminPrompt = data.aiSystemPrompt;
                            }
                        } catch (e) {
                            console.error("Firestore read error:", e);
                        }
                    }

                    // জেমিনি ৩.৬ এআই থেকে উত্তর আনা
                    let aiReply = await getGeminiReply(userMsg, apiKey, botName, customAdminPrompt);
                    await sendMessengerMessage(sender_psid, aiReply);
                }
            }
        }
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

// ৫. জেমিনি ৩.৬ ও ৩.৫ মডেল চেইন (Gemini 3.6 & 3.5 Models)
async function getGeminiReply(userMsg, apiKey, botName, customAdminPrompt) {
    let systemInstructionText = `তুমি "Ghost Store BD" এর কাস্টমার সাপোর্ট বট ${botName}। 
মেসেঞ্জারে ইউজারকে অত্যন্ত বিনয়ী ও মার্জিত প্রমিত বাংলা/ইংরেজি/বাংলিশে সমাধান দেবে।

${customAdminPrompt ? `[এডমিন প্যানেলের লাইভ ইনস্ট্রাকশন ও নিয়মাবলি]:\n${customAdminPrompt}` : ''}`;

    const cleanKey = (apiKey || "").trim();

    const targets = [
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${cleanKey}`,
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${cleanKey}`,
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${cleanKey}`
    ];

    const payload = {
        system_instruction: { parts: [{ text: systemInstructionText }] },
        contents: [{ role: "user", parts: [{ text: userMsg }] }]
    };

    for (let url of targets) {
        try {
            const res = await axios.post(url, payload, {
                headers: { 'Content-Type': 'application/json' }
            });

            if (res.data && res.data.candidates && res.data.candidates[0].content.parts[0].text) {
                return res.data.candidates[0].content.parts[0].text;
            }
        } catch (err) {
            console.error(`Gemini Error (${err.response ? err.response.status : err.message})`);
        }
    }
    return "ধন্যবাদ মেসেজ করার জন্য! Ghost Store BD-তে আপনাকে স্বাগতম। কীভাবে সাহায্য করতে পারি বলুন?";
}

// ৬. মেসেঞ্জারে মেসেজ সেন্ড করা
async function sendMessengerMessage(sender_psid, responseText) {
    let request_body = {
        "recipient": { "id": sender_psid },
        "message": { "text": responseText }
    };

    let token = PAGE_ACCESS_TOKEN.trim();

    try {
        await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${token}`, request_body, {
            headers: { 'Content-Type': 'application/json' }
        });
        console.log("SUCCESSFULLY_SENT_TO_MESSENGER");
    } catch (err) {
        console.error("Messenger Send Error:", err.response ? JSON.stringify(err.response.data) : err.message);
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SPARK AI BD Server running on port ${PORT}`));
