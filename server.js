// 🚀 Ghost Store BD - Detailed & Smart Customer Support AI Bot (server.js)
const express = require('express');
const axios = require('axios');
const http = require('http');
const https = require('https');
const firebase = require('firebase/compat/app');
require('firebase/compat/firestore');

const app = express();
app.use(express.json());

// ⚡ HTTP Keep-Alive Agent (সার্ভার কানেকশন ফাস্ট রাখার জন্য)
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });
const axiosClient = axios.create({ httpAgent, httpsAgent, timeout: 12000 });

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

                    // ⚡ ফেসবুকে সাথে সাথে "Typing On" স্ট্যাটাস চালু করা
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

                    // 🤖 বিস্তারিত উত্তর তৈরির জন্য জেমিনি ফাংশন কল
                    let aiReply = await getGeminiDetailedReply(userMsg, apiKeyFromDb, botName, customAdminPrompt, customModel);
                    
                    // 📤 মেসেঞ্জারে উত্তর পাঠানো
                    await sendMessengerMessage(sender_psid, aiReply);
                    sendSenderAction(sender_psid, "typing_off");
                }
            }
        }
    } else {
        res.sendStatus(404);
    }
});

// 🤖 ৫. বিস্তারিত তথ্য প্রদানকারী জেমিনি ফাংশন
async function getGeminiDetailedReply(userMsg, apiKeyFromDb, botName, customAdminPrompt, customModel) {
    // 🎯 এআই-কে বিস্তারিত উত্তর দেওয়ার নির্দেশাবলী
    let systemInstructionText = `তুমি "Ghost Store BD" এর অফিশিয়াল কাস্টমার সাপোর্ট বট ${botName}। 
ক্লায়েন্ট বা ইউজার যা-ই জিজ্ঞেস করুক না কেন, তাকে প্রয়োজনীয় সব বিষয় অত্যন্ত বিস্তারিত, তথ্যবহুল, সহজ, পরিষ্কার ও সুন্দর প্রমিত বাংলা/ইংরেজি/বাংলিশে বুঝিয়ে উত্তর দেবে। 
ক্লায়েন্টের সমস্যার সঠিক ও পূর্ণাঙ্গ সমাধান না হওয়া পর্যন্ত প্রতিটি প্রশ্নের বিস্তারিত তথ্য প্রদান করবে।

${customAdminPrompt ? `[এডমিন বিশেষ নির্দেশিকা/তথ্যাবলী]:\n${customAdminPrompt}` : ''}`;

    const primaryWorkingKey = "AQ.Ab8RN6IBL5igmsyBBojL5Y6UeGJL84qOBaSKOZR908Ua__tRqQ";

    let keysToTry = [primaryWorkingKey];
    if (apiKeyFromDb && apiKeyFromDb.length > 15 && apiKeyFromDb !== primaryWorkingKey) {
        keysToTry.unshift(apiKeyFromDb); // এডমিন প্যানেলের কি প্রথমে ট্রাই করবে
    }

    const models = [
        customModel || 'gemini-3.6-flash',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3.5-flash-lite',
        'gemini-2.5-flash',
        'gemini-1.5-flash'
    ];

    const payload = {
        system_instruction: { parts: [{ text: systemInstructionText }] },
        contents: [{ role: "user", parts: [{ text: userMsg }] }],
        generationConfig: {
            temperature: 0.7
            // টোকেন লিমিট তুলে দেওয়া হয়েছে যেন বড় ও বিস্তারিত উত্তর দিতে পারে
        }
    };

    for (let key of keysToTry) {
        if (!key || key.length < 15) continue;
        const cleanKey = key.replace(/['"\s]/g, '').trim();

        for (let model of models) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;
                
                const res = await axiosClient.post(url, payload);

                if (res.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                    return res.data.candidates[0].content.parts[0].text;
                }
            } catch (err) {
                // Fail to next model if error
            }
        }
    }

    return "ধন্যবাদ মেসেজ করার জন্য! Ghost Store BD-তে আপনাকে স্বাগতম। আপনার যেকোনো প্রশ্ন বা টপআপ সংক্রান্ত বিষয়ে আমি বিস্তারিত সাহায্য করতে প্রস্তুত। কীভাবে সাহায্য করতে পারি বলুন?";
}

// ⚡ টাইপিং ইন্ডিকেটর ফাংশন
async function sendSenderAction(sender_psid, action) {
    let request_body = {
        "recipient": { "id": sender_psid },
        "sender_action": action
    };
    try {
        axiosClient.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${encodeURIComponent(PAGE_ACCESS_TOKEN.trim())}`, request_body).catch(() => {});
    } catch (err) {}
}

// 📤 মেসেঞ্জার সেন্ড ফাংশন
async function sendMessengerMessage(sender_psid, responseText) {
    let request_body = {
        "recipient": { "id": sender_psid },
        "message": { "text": responseText }
    };

    try {
        await axiosClient.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${encodeURIComponent(PAGE_ACCESS_TOKEN.trim())}`, request_body, {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {}
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SPARK Detailed Support AI Server running on port ${PORT}`));
