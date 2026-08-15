// 🚀 Ghost Store BD & SPARK AI BD - Real FB Profile Sync & Chat Bot (server.js)
const express = require('express');
const axios = require('axios');
const firebase = require('firebase/compat/app');
require('firebase/compat/firestore');

const app = express();
app.use(express.json());

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

// 👤 ফেসবুক থেকে কাস্টমারের আসল নাম আনার ফাংশন
async function getFacebookUserProfile(psid, accessToken) {
    if (!psid || psid.startsWith('usr_')) {
        return `Web User (${psid.slice(-4)})`;
    }
    try {
        const res = await axios.get(`https://graph.facebook.com/v19.0/${psid}?fields=first_name,last_name,name&access_token=${encodeURIComponent(accessToken)}`);
        const fullName = res.data.name || `${res.data.first_name || ''} ${res.data.last_name || ''}`.trim();
        console.log(`[FB Profile] Fetched Name: ${fullName} for PSID: ${psid}`);
        return fullName || `FB User (${psid.slice(-4)})`;
    } catch (e) {
        console.error(`[FB Profile Error] PSID ${psid}:`, e.response?.data || e.message);
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
        res.status(200).send('EVENT_RECEIVED');

        for (let entry of body.entry) {
            if (entry.messaging && entry.messaging[0]) {
                let webhook_event = entry.messaging[0];
                let sender_psid = webhook_event.sender ? webhook_event.sender.id : null;

                if (sender_psid && webhook_event.message && webhook_event.message.text) {
                    let userMsg = webhook_event.message.text.trim();
                    let lowerMsg = userMsg.toLowerCase();

                    let apiKeyFromDb = "";
                    let botName = "S.P.A.R.K. (Ghost AI)";
                    let customAdminPrompt = "";
                    let customModel = "";
                    let welcomeMsg = "Ghost Store BD-তে আপনাকে স্বাগতম! AI বটের সাহায্য নিতে #ai লিখুন এবং সরাসরি এডমিনের সাথে কথা বলতে #admin লিখুন।";
                    let aiCmd = "#ai";
                    let adminCmd = "#admin";

                    // ১. ফায়ারবেস থেকে কনফিগ রিড করা
                    if (db) {
                        try {
                            let doc = await db.collection("settings").doc("general").get();
                            if (doc.exists) {
                                let data = doc.data();
                                if (data.aiEnabled === false) return;
                                
                                if (data.aiApiKey && data.aiApiKey.trim().length > 15) apiKeyFromDb = data.aiApiKey.trim();
                                if (data.aiBotName) botName = data.aiBotName;
                                if (data.aiSystemPrompt) customAdminPrompt = data.aiSystemPrompt;
                                if (data.aiModel) customModel = data.aiModel;
                                if (data.welcomeMsg) welcomeMsg = data.welcomeMsg;
                                if (data.aiTriggerCmd) aiCmd = data.aiTriggerCmd.toLowerCase().trim();
                                if (data.adminTriggerCmd) adminCmd = data.adminTriggerCmd.toLowerCase().trim();
                            }
                        } catch (e) {}
                    }

                    // 👤 ফেসবুক থেকে কাস্টমারের আসল নাম সংগ্রহ
                    let fbToken = PAGE_ACCESS_TOKEN.trim();
                    let fbProfileName = await getFacebookUserProfile(sender_psid, fbToken);

                    // ২. কমান্ড চেকিং (AI On/Off Switcher)
                    if (lowerMsg === aiCmd) {
                        await db.collection("user_modes").doc(sender_psid).set({ mode: "ai", fbName: fbProfileName }, { merge: true });
                        await sendMessengerMessage(sender_psid, "🤖 AI চ্যাটবট চালু করা হয়েছে! কীভাবে সাহায্য করতে পারি বলুন?");
                        return;
                    }

                    if (lowerMsg === adminCmd) {
                        await db.collection("user_modes").doc(sender_psid).set({ mode: "admin", fbName: fbProfileName }, { merge: true });
                        await sendMessengerMessage(sender_psid, "👤 এডমিন মোড চালু করা হয়েছে। AI সাময়িকভাবে বন্ধ থাকবে। আমাদের এডমিন টিম শীঘ্রই রিপ্লাই দেবে।");
                        return;
                    }

                    // ৩. ক্লায়েন্টের মোড চেক
                    let userModeDoc = await db.collection("user_modes").doc(sender_psid).get();
                    let userMode = "ai";
                    
                    if (userModeDoc.exists) {
                        userMode = userModeDoc.data().mode || "ai";
                        await db.collection("user_modes").doc(sender_psid).set({ fbName: fbProfileName }, { merge: true });
                    } else {
                        await db.collection("user_modes").doc(sender_psid).set({ 
                            mode: "ai", 
                            fbName: fbProfileName,
                            firstSeen: new Date() 
                        });
                        await sendMessengerMessage(sender_psid, welcomeMsg);
                    }

                    // 💬 লাইভ মেসেজ চ্যাট হিস্ট্রি সেভ
                    await db.collection("live_chats").doc(sender_psid).set({
                        fbName: fbProfileName,
                        lastMsg: userMsg,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });

                    await db.collection("live_chats").doc(sender_psid).collection("messages").add({
                        sender: 'user',
                        text: userMsg,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    // ৪. ইউজার এডমিন মোডে থাকলে AI কোনো রিপ্লাই দেবে না
                    if (userMode === "admin") {
                        console.log(`User ${fbProfileName} (${sender_psid}) is in ADMIN mode. AI skipped.`);
                        return;
                    }

                    // ৫. Gemini AI থেকে রিপ্লাই এনে মেসেঞ্জারে পাঠানো
                    let aiReply = await getGeminiReply(userMsg, apiKeyFromDb, botName, customAdminPrompt, customModel);
                    await sendMessengerMessage(sender_psid, aiReply);

                    // AI রিপ্লাইও চ্যাট হিস্ট্রিতে সেভ করা
                    await db.collection("live_chats").doc(sender_psid).collection("messages").add({
                        sender: 'bot',
                        text: aiReply,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            }
        }
    } else {
        res.sendStatus(404);
    }
});

// 🤖 জেমিনি এআই ফাংশন
async function getGeminiReply(userMsg, apiKeyFromDb, botName, customAdminPrompt, customModel) {
    let systemInstructionText = `তুমি "Ghost Store BD" এর কাস্টমার সাপোর্ট বট ${botName}। 
মেসেঞ্জারে ইউজারকে অত্যন্ত বিনয়ী ও মার্জিত প্রমিত বাংলা/ইংরেজি/বাংলিশে সমাধান দেবে।
${customAdminPrompt ? `[এডমিন প্রম্পট]:\n${customAdminPrompt}` : ''}`;

    const primaryWorkingKey = "AQ.Ab8RN6IBL5igmsyBBojL5Y6UeGJL84qOBaSKOZR908Ua__tRqQ";

    let keysToTry = [primaryWorkingKey];
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 15) keysToTry.push(process.env.GEMINI_API_KEY);
    if (apiKeyFromDb && apiKeyFromDb.length > 15 && apiKeyFromDb !== primaryWorkingKey) keysToTry.push(apiKeyFromDb);

    const models = [
        customModel || 'gemini-3.6-flash',
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
                const headers = { 'Content-Type': 'application/json' };
                const res = await axios.post(url, payload, { headers, timeout: 10000 });

                if (res.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                    return res.data.candidates[0].content.parts[0].text;
                }
            } catch (err) {}
        }
    }

    return "ধন্যবাদ মেসেজ করার জন্য! Ghost Store BD-তে আপনাকে স্বাগতম। কীভাবে সাহায্য করতে পারি বলুন?";
}

// 📤 মেসেঞ্জারে মেসেজ পাঠানো
async function sendMessengerMessage(sender_psid, responseText) {
    let request_body = {
        "recipient": { "id": sender_psid },
        "message": { "text": responseText }
    };

    try {
        await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${encodeURIComponent(PAGE_ACCESS_TOKEN.trim())}`, request_body, {
            headers: { 'Content-Type': 'application/json' }
        });
        console.log("SUCCESSFULLY_SENT_TO_MESSENGER");
    } catch (err) {
        console.error("Messenger Send Error:", err.response ? JSON.stringify(err.response.data) : err.message);
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SPARK Real FB Profile Sync Bot running on port ${PORT}`));
