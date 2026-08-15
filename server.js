// 🚀 Ghost Store BD & SPARK AI BD - Ultra Fast Messenger Bot (server.js)
const express = require('express');
const axios = require('axios');
const http = require('http');
const https = require('https');
const firebase = require('firebase/compat/app');
require('firebase/compat/firestore');

const app = express();
app.use(express.json());

// ⚡ HTTP Keep-Alive Agent (সার্ভার কানেকশন রেডি রাখবে, স্পিড দ্বিগুণ করবে)
const axiosFast = axios.create({
    httpAgent: new http.Agent({ keepAlive: true }),
    httpsAgent: new https.Agent({ keepAlive: true }),
    timeout: 4000 // ৪ সেকেন্ডের বেশি দেরি হলে অন্য মডেলে ট্রাই করবে
});

// 🔑 ১. পেজ এক্সেস টোকেন ও ভেরিফাই টোকেন
let PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || "EAAMR7ZCs6lokBSC5FeT8ZCjwyHRziVNRptNxZClsNQrWJyKtj6LFZCzVlqMkpDaDJiTQNZCETXDciEbyWWhsGYnHkEXvJhExHAji0xNC95IV7eWPFBiY9NQVaqDmZBEgcLYy9tr2QOWiDEvPh8qu7xnwaawZBpu4HBYsRLyMlOo9IkjhYuEOt0wKXEu3gtQbVdQxxpq";
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "ghost_store_secret_token";

// 🔑 ২. ফায়ারবেস ডাটাবেজ (Panda-47867)
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
    console.log("🔥 Firebase Connected!");
}
const db = firebase.firestore();

// ⚡ ইন-মেমোরি ক্যাশিং (ডাটাবেজ রিড লেট বন্ধ করার জন্য)
let cachedSettings = null;
let lastCacheTime = 0;

async function getBotSettingsCached() {
    const now = Date.now();
    if (cachedSettings && (now - lastCacheTime < 60000)) { // ১ মিনিটের ক্যাশ
        return cachedSettings;
    }
    try {
        const doc = await db.collection("settings").doc("general").get();
        if (doc.exists) {
            cachedSettings = doc.data();
            lastCacheTime = now;
            return cachedSettings;
        }
    } catch (e) {}
    return {};
}

// 👤 ফেসবুক থেকে কাস্টমারের নাম আনার ফাংশন
async function getFacebookUserProfile(psid, accessToken) {
    if (!psid || psid.startsWith('usr_')) return `Web User (${psid.slice(-4)})`;
    try {
        const res = await axiosFast.get(`https://graph.facebook.com/v19.0/${psid}?fields=first_name,last_name,name&access_token=${encodeURIComponent(accessToken)}`);
        return res.data.name || `${res.data.first_name || ''} ${res.data.last_name || ''}`.trim() || `FB User (${psid.slice(-4)})`;
    } catch (e) {
        return `FB User (${psid.slice(-4)})`;
    }
}

// 🌐 ৩. মেটা ওয়েবহুক ভেরিফিকেশন (GET Request)
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

// 📩 ৪. ইনকামিং মেসেঞ্জার প্রসেসিং (POST Request)
app.post('/webhook', async (req, res) => {
    let body = req.body;

    if (body.object === 'page') {
        res.status(200).send('EVENT_RECEIVED'); // ফেসবুকে সাথে সাথে 200 OK রেসপন্স পাঠানো

        for (let entry of body.entry) {
            if (entry.messaging && entry.messaging[0]) {
                let webhook_event = entry.messaging[0];
                let sender_psid = webhook_event.sender ? webhook_event.sender.id : null;

                if (sender_psid && webhook_event.message && webhook_event.message.text) {
                    let userMsg = webhook_event.message.text.trim();

                    // ⚡ ফেসবুকে সাথে সাথে "Typing On" স্ট্যাটাস পাঠানো (Non-blocking)
                    sendTypingIndicator(sender_psid, "typing_on");

                    // প্যারালালে মেসেজ প্রসেস করা
                    processUserMessageFast(sender_psid, userMsg);
                }
            }
        }
    } else {
        res.sendStatus(404);
    }
});

async function processUserMessageFast(sender_psid, userMsg) {
    let lowerMsg = userMsg.toLowerCase();
    let settings = await getBotSettingsCached();

    if (settings.aiEnabled === false) {
        sendTypingIndicator(sender_psid, "typing_off");
        return;
    }

    let aiCmd = (settings.aiTriggerCmd || "#ai").toLowerCase().trim();
    let adminCmd = (settings.adminTriggerCmd || "#admin").toLowerCase().trim();
    let welcomeMsg = settings.welcomeMsg || "Ghost Store BD-তে আপনাকে স্বাগতম! AI বটের সাহায্য নিতে #ai লিখুন এবং সরাসরি এডমিনের সাথে কথা বলতে #admin লিখুন।";

    // ১. কমান্ড চেকিং (#ai / #admin)
    if (lowerMsg === aiCmd) {
        db.collection("user_modes").doc(sender_psid).set({ mode: "ai" }, { merge: true });
        await sendMessengerMessage(sender_psid, "🤖 AI চ্যাটবট চালু করা হয়েছে! কীভাবে সাহায্য করতে পারি বলুন?");
        return;
    }

    if (lowerMsg === adminCmd) {
        db.collection("user_modes").doc(sender_psid).set({ mode: "admin" }, { merge: true });
        await sendMessengerMessage(sender_psid, "👤 এডমিন মোড চালু করা হয়েছে। AI সাময়িকভাবে বন্ধ থাকবে। আমাদের এডমিন টিম শীঘ্রই রিপ্লাই দেবে।");
        return;
    }

    // ২. ক্লায়েন্টের মোড চেক
    let userMode = "ai";
    try {
        let modeDoc = await db.collection("user_modes").doc(sender_psid).get();
        if (modeDoc.exists) {
            userMode = modeDoc.data().mode || "ai";
        } else {
            // প্রথমবার মেসেজ দেওয়া ইউজার
            let fbProfileName = await getFacebookUserProfile(sender_psid, PAGE_ACCESS_TOKEN.trim());
            db.collection("user_modes").doc(sender_psid).set({ mode: "ai", fbName: fbProfileName, firstSeen: new Date() });
            await sendMessengerMessage(sender_psid, welcomeMsg);
        }
    } catch (e) {}

    // ইউজার এডমিন মোডে থাকলে AI এড়িয়ে যাবে
    if (userMode === "admin") {
        sendTypingIndicator(sender_psid, "typing_off");
        return;
    }

    // ৩. ব্যাকগ্রাউন্ডে ফায়ারবেস লগ সেভ (Non-blocking: জেমিনির স্পিড কমাবে না)
    db.collection("live_chats").doc(sender_psid).set({
        lastMsg: userMsg,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(() => {});

    // ৪. আল্ট্রা-ফাস্ট জেমিনি রিকোয়েস্ট
    let apiKey = settings.aiApiKey || process.env.GEMINI_API_KEY || "AQ.Ab8RN6IBL5igmsyBBojL5Y6UeGJL84qOBaSKOZR908Ua__tRqQ";
    let botName = settings.aiBotName || "S.P.A.R.K. (Ghost AI)";
    let prompt = settings.aiSystemPrompt || "";
    let customModel = settings.aiModel || "gemini-2.5-flash";

    let aiReply = await getGeminiReplyUltraFast(userMsg, apiKey, botName, prompt, customModel);

    // 📤 উত্তর পাঠানো
    await sendMessengerMessage(sender_psid, aiReply);
    sendTypingIndicator(sender_psid, "typing_off");
}

// 🤖 আল্ট্রা-ফাস্ট জেমিনি ফাংশন
async function getGeminiReplyUltraFast(userMsg, apiKeyRaw, botName, customAdminPrompt, customModel) {
    let systemInstructionText = `তুমি "Ghost Store BD" এর কাস্টমার সাপোর্ট বট ${botName}। 
মেসেঞ্জারে ইউজারকে অত্যন্ত বিনয়ী ও মার্জিত প্রমিত বাংলা/ইংরেজি/বাংলিশে সমাধান দেবে।
${customAdminPrompt ? `[এডমিন বিশেষ নির্দেশিকা]:\n${customAdminPrompt}` : ''}`;

    let keys = apiKeyRaw.split(',').map(k => k.replace(/['"\s]/g, '').trim()).filter(k => k.length > 15);
    if (keys.length === 0) keys = ["AQ.Ab8RN6IBL5igmsyBBojL5Y6UeGJL84qOBaSKOZR908Ua__tRqQ"];

    // অতি-দ্রুতগতির মডেল তালিকা
    const models = [
        customModel || 'gemini-2.5-flash',
        'gemini-2.5-flash',
        'gemini-1.5-flash',
        'gemini-2.0-flash',
        'gemini-3.6-flash'
    ];
    const uniqueModels = [...new Set(models)];

    const payload = {
        system_instruction: { parts: [{ text: systemInstructionText }] },
        contents: [{ role: "user", parts: [{ text: userMsg }] }],
        generationConfig: {
            maxOutputTokens: 500, // দ্রুত উত্তরের জন্য
            temperature: 0.7
        }
    };

    for (let key of keys) {
        for (let model of uniqueModels) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
                const res = await axiosFast.post(url, payload);

                if (res.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                    return res.data.candidates[0].content.parts[0].text;
                }
            } catch (err) {}
        }
    }

    return "ধন্যবাদ মেসেজ করার জন্য! Ghost Store BD-তে আপনাকে স্বাগতম। কীভাবে সাহায্য করতে পারি বলুন?";
}

// ⚡ টাইপিং ইন্ডিকেটর পাঠানো
function sendTypingIndicator(sender_psid, action) {
    let request_body = { "recipient": { "id": sender_psid }, "sender_action": action };
    axiosFast.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${encodeURIComponent(PAGE_ACCESS_TOKEN.trim())}`, request_body).catch(() => {});
}

// 📤 মেসেঞ্জারে মেসেজ সেন্ড করা
async function sendMessengerMessage(sender_psid, responseText) {
    let request_body = { "recipient": { "id": sender_psid }, "message": { "text": responseText } };
    try {
        await axiosFast.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${encodeURIComponent(PAGE_ACCESS_TOKEN.trim())}`, request_body);
    } catch (err) {}
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SPARK Ultra Fast Messenger Bot running on port ${PORT}`));
