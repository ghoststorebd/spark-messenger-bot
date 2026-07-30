// 🚀 Ghost Store BD & SPARK AI BD - Centralized 24/7 Messenger Bot (server.js)
const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');
const app = express();
app.use(express.json());

// 🔑 ১. নতুন পেজ এক্সেস টোকেন এবং সিক্রেট ভেরিফাই টোকেন
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

                    // এডমিন প্যানেল থেকে সেটিংস রিড করা
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

                    // জেমিনি এআই থেকে লাইভ উত্তর আনা
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

// ৫. বুলেটপ্রুফ জেমিনি এআই কলিং (Gemini 3.6, 3.5 Lite, 3.5 Flash, 2.5, 1.5)
async function getGeminiReply(userMsg, apiKey, botName, customAdminPrompt) {
    let systemInstructionText = `তুমি "Ghost Store BD" এর কাস্টমার সাপোর্ট বট ${botName}। 
মেসেঞ্জারে ইউজারকে অত্যন্ত বিনয়ী ও মার্জিত প্রমিত বাংলা/ইংরেজি/বাংলিশে সমাধান দেবে।

${customAdminPrompt ? `[এডমিন প্যানেলের লাইভ ইনস্ট্রাকশন ও নিয়মাবলি]:\n${customAdminPrompt}` : ''}`;

    const defaultKey = "AQ.Ab8RN6KZTeYGim8_lqesCfsnjEm5j22QCxNRtkKeK1f3IC0ZVA";
    let keysToTry = [apiKey ? apiKey.trim() : "", defaultKey];

    // 🎯 ওয়েবসাইট এর সাথে সামঞ্জস্যপূর্ণ লেটেস্ট জেমিনি মডেলসমূহ
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
        if (!key || key.length < 10) continue;
        const cleanKey = key.replace(/['"]/g, '');

        for (let model of models) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;
                
                // Headers ফিক্স: x-goog-api-key এবং AQ. Auth Keys এর জন্য Authorization Bearer যুক্ত করা হয়েছে
                const headers = { 'Content-Type': 'application/json' };
                headers['x-goog-api-key'] = cleanKey;
                if (cleanKey.startsWith('AQ')) {
                    headers['Authorization'] = `Bearer ${cleanKey}`;
                }

                const res = await axios.post(url, payload, { headers });

                if (res.data && res.data.candidates && res.data.candidates[0] && res.data.candidates[0].content && res.data.candidates[0].content.parts[0] && res.data.candidates[0].content.parts[0].text) {
                    return res.data.candidates[0].content.parts[0].text;
                }
            } catch (err) {
                console.error(`Gemini Fail (${model}):`, err.response ? err.response.status : err.message);
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
