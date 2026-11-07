// Light UI translations (English + Hindi). Other languages fall back to English for the chrome;
// the advisor itself speaks all 10 languages (see backend/app/i18n.py).
const D: Record<string, Record<string, string>> = {
  en: {
    home: 'Home', buy: 'Buy', shield: 'Scam Shield', track: 'My service', whatsapp: 'WhatsApp', partner: 'Partner console', help: 'Help',
    need_title: 'What do you need today?',
    n_buy: 'Get internet, SIMs & more', n_buy_d: 'Tell Sync about your business. Get one clear monthly price.',
    n_shield: 'Check a suspicious message', n_shield_d: 'Paste or upload a message, link or payment screenshot.',
    n_net: 'Is my area covered?', n_net_d: 'Check what can be installed at your pincode before you pay.',
    n_track: 'Track or fix my service', n_track_d: 'Order status, install slot, outages and support.',
    n_branch: 'Open a new branch', n_branch_d: 'Copy your setup to a new location in one tap.',
    n_wa: 'Do it all on WhatsApp', n_wa_d: 'Buy, verify KYC, schedule and get help in one chat.',
    s1: 'Advisor', s2: 'Quote', s3: 'KYC', s4: 'Track',
    help_title: 'Need a hand?', help_person: 'Talk to a person', help_wa: 'Chat on WhatsApp', help_shield: 'Check a suspicious message',
  },
  hi: {
    home: 'होम', buy: 'खरीदें', shield: 'स्कैम शील्ड', track: 'मेरी सेवा', whatsapp: 'WhatsApp', partner: 'पार्टनर कंसोल', help: 'मदद',
    need_title: 'आज आपको क्या चाहिए?',
    n_buy: 'इंटरनेट, सिम और बहुत कुछ', n_buy_d: 'सिंक को अपने व्यवसाय के बारे में बताएँ। एक साफ़ मासिक कीमत पाएँ।',
    n_shield: 'संदिग्ध संदेश जाँचें', n_shield_d: 'संदेश, लिंक या पेमेंट स्क्रीनशॉट चिपकाएँ या अपलोड करें।',
    n_net: 'क्या मेरे इलाके में सेवा है?', n_net_d: 'पैसे देने से पहले अपने पिनकोड पर देखें कि क्या लग सकता है।',
    n_track: 'अपनी सेवा ट्रैक करें / ठीक करें', n_track_d: 'ऑर्डर स्थिति, इंस्टॉल स्लॉट, आउटेज और सपोर्ट।',
    n_branch: 'नई ब्रांच खोलें', n_branch_d: 'अपना सेटअप एक टैप में नई जगह कॉपी करें।',
    n_wa: 'सब कुछ WhatsApp पर करें', n_wa_d: 'खरीदें, KYC करें, समय तय करें और मदद पाएँ, एक ही चैट में।',
    s1: 'सलाहकार', s2: 'कोट', s3: 'KYC', s4: 'ट्रैक',
    help_title: 'मदद चाहिए?', help_person: 'किसी इंसान से बात करें', help_wa: 'WhatsApp पर चैट करें', help_shield: 'संदिग्ध संदेश जाँचें',
  },
}
export const tr = (lang: string, k: string) => D[lang]?.[k] ?? D.en[k] ?? k
