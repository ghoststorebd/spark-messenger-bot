// 🚀 Ghost Store BD & SPARK AI BD - Centralized 24/7 Messenger Bot (server.js)
const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');
const app = express();
app.use(express.json());

// 🔑 ১. পেজ এক্সেস টোকেন
let PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || "EAAMR7ZCs6lokBSC5FeT8ZCjwyHRziVNRptNxZClsNQrWJyKtj6LFZCzVlqMkpDaDJiTQNZCETXDciEbyWWhsGYnHkEXvJhExHAji0xNC95IV7eWPFBiY9NQVaqDmZBEgcLYy9tr2QOWiDEvPh8qu7xnwaawZBpu4HBYsRLyMlOo9IkjhYuEOt0wKXEu3gtQbVdQxxpq";
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

                    let apiKeyFromDb = "";
                    let botName = "S.P.A.R.K. (Ghost AI)";
                    let customAdminPrompt = "";

                    if (db) {
                        try {
                            let doc = await db.collection("settings").doc("general").get();
                            if (doc.exists) {
                                let data = doc.data();
                                if (data.aiEnabled === false) return;
                                if (data.aiApiKey && data.aiApiKey.trim().length > 15) {
                                    apiKeyFromDb = data.aiApiKey.trim();
                                }
                                if (data.aiBotName) botName = data.aiBotName;
                                if (data.aiSystemPrompt) customAdminPrompt = data.aiSystemPrompt;
                            }
                        } catch (e) {
                            console.error("Firestore read error:", e);
                        }
                    }

                    let aiReply = await getGeminiReply(userMsg, apiKeyFromDb, botName, customAdminPrompt);
                    await sendMessengerMessage(sender_psid, aiReply);
                }
            }
        }
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

// ৫. ফাইনাল সেফগার্ড জেমিনি এআই ফাংশন (Priority 1: Confirmed Working Key)
async function getGeminiReply(userMsg, apiKeyFromDb, botName, customAdminPrompt) {
    let systemInstructionText = `তুমি "Ghost Store BD" এর কাস্টমার সাপোর্ট বট ${botName}। 
মেসেঞ্জারে ইউজারকে অত্যন্ত বিনয়ী ও মার্জিত প্রমিত বাংলা/ইংরেজি/বাংলিশে সমাধান দেবে।

${customAdminPrompt ? `[এডমিন বিশেষ নির্দেশিকা]:\n${customAdminPrompt}` : ''}`;

    // 🎯 আপনার কনফার্ম হওয়া ওয়ার্কিং কি
    const primaryWorkingKey = "AQ.Ab8RN6IBL5igmsyBBojL5Y6UeGJL84qOBaSKOZR908Ua__tRqQ";

    // সবার আগে আপনার নতুন সঠিক কী-টি ট্রাই করবে
    let keysToTry = [primaryWorkingKey];
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 15) keysToTry.push(process.env.GEMINI_API_KEY);
    if (apiKeyFromDb && apiKeyFromDb.length > 15 && apiKeyFromDb !== primaryWorkingKey) keysToTry.push(apiKeyFromDb);

    // 🎯 Gemini 3.6, 3.5 Lite, 3.5 Flash এবং ব্যাকআপ মডেলসমূহ
    const models = [
        'gemini-3.6-flash',
        'gemini-3.5-flash-lite',
        'gemini-3.5-flash',
        'gemini-2.5-flash',
        'gemini-1.5-flash'
    ];

    const payload = {
        system_instruction: { parts: [{ text: systemInstructionText }] },
        contents: [{ role: "user", parts: [{ text: userMsg }] }]
    };

    for (let key of keysToTry) {
        if (!key || key.length < 15) continue;
        const cleanKey = key.replace(/['"\s]/g, '').trim();

        console.log(`[Gemini] Requesting with Key Prefix: ${cleanKey.substring(0, 12)}...`);

        for (let model of models) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;
                
                const headers = { 
                    'Content-Type': 'application/json'
                };

                const res = await axios.post(url, payload, { headers, timeout: 12000 });

                if (res.data && res.data.candidates && res.data.candidates[0] && res.data.candidates[0].content && res.data.candidates[0].content.parts[0] && res.data.candidates[0].content.parts[0].text) {
                    console.log(`[Gemini] SUCCESS via Model: ${model}`);
                    return res.data.candidates[0].content.parts[0].text;
                }
            } catch (err) {
                const status = err.response ? err.response.status : err.message;
                console.error(`Gemini Fail (${model}) Key [${cleanKey.substring(0, 10)}...]: Status ${status}`);
            }
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
        await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${encodeURIComponent(token)}`, request_body, {
            headers: { 'Content-Type': 'application/json' }
        });
        console.log("SUCCESSFULLY_SENT_TO_MESSENGER");
    } catch (err) {
        console.error("Messenger Send Error:", err.response ? JSON.stringify(err.response.data) : err.message);
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SPARK AI BD Server running on port ${PORT}`));
