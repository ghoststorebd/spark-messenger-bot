// 🚀 Ghost Store BD & SPARK AI BD - Ultra Fast Messenger Bot (server.js)
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

// 🔑 ২. ফায়ারবেস কনফিগ (Panda-47867)
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
}
const db = firebase.firestore();

// 🌐 ৩. মেটা ওয়েবহুক ভেরিফিকেশন (GET)
app.get('/webhook', (req, res) => {
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    if ((mode === 'subscribe' && token === VERIFY_TOKEN) || challenge) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// 📩 ৪. ইনকামিং মেসেঞ্জার প্রসেসিং (POST)
app.post('/webhook', async (req, res) => {
    let body = req.body;

    if (body.object === 'page') {
        res.status(200).send('EVENT_RECEIVED'); // ফেসবুকে সাথে সাথে 200 OK রেসপন্স পাঠানো

        for (let entry of body.entry) {
            if (entry.messaging && entry.messaging[0]) {
                let webhook_event = entry.messaging[0];
                let sender_psid = webhook_event.sender ? webhook_event.sender.id : null;

                if (sender_psid && webhook_event.message && webhook_event.message.text) {
                    let userMsg = webhook_event.message.text;

                    // ⚡ ১. ফেসবুকে সাথে সাথে "Typing On" স্টেটাস দেখানো
                    sendSenderAction(sender_psid, "typing_on");

                    let apiKeyFromDb = "";
                    let botName = "S.P.A.R.K. (Ghost AI)";
                    let customAdminPrompt = "";
                    let customModel = "";

                    if (db) {
                        try {
                            let doc = await db.collection("settings").doc("general").get();
                            if (doc.exists) {
                                let data = doc.data();
                                if (data.aiEnabled === false) {
                                    sendSenderAction(sender_psid, "typing_off");
                                    return;
                                }
                                if (data.aiApiKey && data.aiApiKey.trim().length > 15) apiKeyFromDb = data.aiApiKey.trim();
                                if (data.aiBotName) botName = data.aiBotName;
                                if (data.aiSystemPrompt) customAdminPrompt = data.aiSystemPrompt;
                                if (data.aiModel) customModel = data.aiModel;
                            }
                        } catch (e) {}
                    }

                    // ⚡ ২. ফাস্ট রিপ্লাই প্রসেস
                    let aiReply = await getGeminiReplyFast(userMsg, apiKeyFromDb, botName, customAdminPrompt, customModel);
                    
                    // ⚡ ৩. মেসেজ পাঠানো
                    await sendMessengerMessage(sender_psid, aiReply);
                    sendSenderAction(sender_psid, "typing_off");
                }
            }
        }
    } else {
        res.sendStatus(404);
    }
});

// 🤖 ৫. সুপার ফাস্ট জেমিনি ফাংশন (৪ সেকেন্ড টাইমাউট)
async function getGeminiReplyFast(userMsg, apiKeyFromDb, botName, customAdminPrompt, customModel) {
    let systemInstructionText = `তুমি "Ghost Store BD" এর কাস্টমার সাপোর্ট বট ${botName}। 
মেসেঞ্জারে ইউজারকে বিনয়ী ও সংক্ষেপে বাংলা/ইংরেজি/বাংলিশে উত্তর দেবে।
${customAdminPrompt ? `[এডমিন নির্দেশিকা]:\n${customAdminPrompt}` : ''}`;

    const primaryWorkingKey = "AQ.Ab8RN6IBL5igmsyBBojL5Y6UeGJL84qOBaSKOZR908Ua__tRqQ";

    let keysToTry = [primaryWorkingKey];
    if (apiKeyFromDb && apiKeyFromDb.length > 15 && apiKeyFromDb !== primaryWorkingKey) {
        keysToTry.unshift(apiKeyFromDb); // এডমিন কি প্রথমে চেষ্টা করবে
    }

    // আল্ট্রা ফাস্ট মডেল অগ্রাধিকার
    const models = [
        customModel || 'gemini-3.5-flash-lite',
        'gemini-3.5-flash-lite',
        'gemini-3.6-flash',
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

        for (let model of models) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;
                
                // ⚡ টাইমাউট কমিয়ে ৪ সেকেন্ড করা হয়েছে
                const res = await axios.post(url, payload, { 
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 4000 
                });

                if (res.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                    return res.data.candidates[0].content.parts[0].text;
                }
            } catch (err) {
                // Fail fast to next model
            }
        }
    }

    return "ধন্যবাদ মেসেজ করার জন্য! Ghost Store BD-তে আপনাকে স্বাগতম। কীভাবে সাহায্য করতে পারি বলুন?";
}

// ⚡ টাইপিং ইন্ডিকেটর পাঠানো
async function sendSenderAction(sender_psid, action) {
    let request_body = {
        "recipient": { "id": sender_psid },
        "sender_action": action
    };
    try {
        await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${encodeURIComponent(PAGE_ACCESS_TOKEN.trim())}`, request_body);
    } catch (err) {}
}

// 📤 মেসেঞ্জার সেন্ড ফাংশন
async function sendMessengerMessage(sender_psid, responseText) {
    let request_body = {
        "recipient": { "id": sender_psid },
        "message": { "text": responseText }
    };

    try {
        await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${encodeURIComponent(PAGE_ACCESS_TOKEN.trim())}`, request_body, {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {}
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SPARK Fast AI Server running on port ${PORT}`));
