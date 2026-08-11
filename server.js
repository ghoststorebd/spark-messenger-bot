// 🚀 Ghost Store BD & SPARK AI BD - Centralized 24/7 Messenger Bot (server.js)
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const firebase = require('firebase/compat/app');
require('firebase/compat/firestore');

const app = express();
app.use(express.json());
app.use(cors());

// 🔑 ১. পেজ এক্সেস টোকেন ও ভেরিফাই টোকেন
let PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || "EAAMR7ZCs6lokBSC5FeT8ZCjwyHRziVNRptNxZClsNQrWJyKtj6LFZCzVlqMkpDaDJiTQNZCETXDciEbyWWhsGYnHkEXvJhExHAji0xNC95IV7eWPFBiY9NQVaqDmZBEgcLYy9tr2QOWiDEvPh8qu7xnwaawZBpu4HBYsRLyMlOo9IkjhYuEOt0wKXEu3gtQbVdQxxpq";
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "ghost_store_secret_token";

// 🔑 ২. নতুন ফায়ারবেস ডাটাবেজ ইন্টিগ্রেশন (Panda-47867)
const firebaseConfig = {
  apiKey: "AIzaSyC6Ww5ePRGYdh55-qr-fOkS4VcuXoBM7oQ",
  authDomain: "panda-47867.firebaseapp.com",
  databaseURL: "https://panda-47867-default-rtdb.firebaseio.com",
  projectId: "panda-47867",
  storageBucket: "panda-47867.firebasestorage.app",
  messagingSenderId: "1037356089212",
  appId: "1:1037356089212:web:7b9dfcf3c7ed8eaaa06ef9"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log("🔥 Firebase Panda-47867 Successfully Connected!");
}

const db = firebase.firestore();

// 🌐 ৩. মেটা ওয়েবহুক ভেরিফিকেশন (GET Request)
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

// 📩 ৪. ইনকামিং মেসেঞ্জার মেসেজ প্রসেসিং (POST Request)
app.post('/webhook', async (req, res) => {
    let body = req.body;

    if (body.object === 'page') {
        res.status(200).send('EVENT_RECEIVED');

        for (let entry of body.entry) {
            if (entry.messaging && entry.messaging[0]) {
                let webhook_event = entry.messaging[0];
                let sender_psid = webhook_event.sender ? webhook_event.sender.id : null;

                if (sender_psid && webhook_event.message && webhook_event.message.text) {
                    let userMsg = webhook_event.message.text;

                    let apiKeyFromDb = "";
                    let botName = "S.P.A.R.K. (Ghost AI)";
                    let customAdminPrompt = "";
                    let customModel = "";

                    // ফায়ারবেস থেকে লাইভ সেটিংস চেক করা
                    if (db) {
                        try {
                            let doc = await db.collection("settings").doc("general").get();
                            if (doc.exists) {
                                let data = doc.data();
                                // এডমিন প্যানেল থেকে বট বন্ধ করা থাকলে উত্তর দেবে না
                                if (data.aiEnabled === false) return;

                                if (data.aiApiKey && data.aiApiKey.trim().length > 15) {
                                    apiKeyFromDb = data.aiApiKey.trim();
                                }
                                if (data.aiBotName) botName = data.aiBotName;
                                if (data.aiSystemPrompt) customAdminPrompt = data.aiSystemPrompt;
                                if (data.aiModel) customModel = data.aiModel;
                            }
                        } catch (e) {
                            console.error("Firestore Read Error:", e.message);
                        }
                    }

                    let aiReply = await getGeminiReply(userMsg, apiKeyFromDb, botName, customAdminPrompt, customModel);
                    await sendMessengerMessage(sender_psid, aiReply);
                }
            }
        }
    } else {
        res.sendStatus(404);
    }
});

// 🤖 ৫. জেমিনি এআই প্রসেসিং ফাংশন
async function getGeminiReply(userMsg, apiKeyFromDb, botName, customAdminPrompt, customModel) {
    let systemInstructionText = `তুমি "Ghost Store BD" এর কাস্টমার সাপোর্ট বট ${botName}। 
মেসেঞ্জারে ইউজারকে অত্যন্ত বিনয়ী ও মার্জিত প্রমিত বাংলা/ইংরেজি/বাংলিশে সমাধান দেবে।

${customAdminPrompt ? `[এডমিন বিশেষ নির্দেশিকা]:\n${customAdminPrompt}` : ''}`;

    // primary key
    const primaryWorkingKey = "AQ.Ab8RN6IBL5igmsyBBojL5Y6UeGJL84qOBaSKOZR908Ua__tRqQ";

    let keysToTry = [primaryWorkingKey];
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 15) {
        keysToTry.push(process.env.GEMINI_API_KEY);
    }
    if (apiKeyFromDb && apiKeyFromDb.length > 15 && apiKeyFromDb !== primaryWorkingKey) {
        keysToTry.push(apiKeyFromDb);
    }

    // Gemini 3.x, 2.5 & Backup Models
    const models = [
        customModel || 'gemini-3.6-flash',
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

        console.log(`[Gemini] Requesting with Key Prefix: ${cleanKey.substring(0, 10)}...`);

        for (let model of models) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;
                
                const headers = { 'Content-Type': 'application/json' };
                const res = await axios.post(url, payload, { headers, timeout: 12000 });

                if (res.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                    console.log(`[Gemini SUCCESS] via Model: ${model}`);
                    return res.data.candidates[0].content.parts[0].text;
                }
            } catch (err) {
                const status = err.response ? err.response.status : err.message;
                console.error(`[Gemini Fail] Model (${model}): Status ${status}`);
            }
        }
    }

    return "ধন্যবাদ মেসেজ করার জন্য! Ghost Store BD-তে আপনাকে স্বাগতম। কীভাবে সাহায্য করতে পারি বলুন?";
}

// 📤 ৬. মেসেঞ্জারে উত্তর পাঠানোর ফাংশন
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
