// Bot commands, description and the menu button shared by polling and webhook setup.
export async function setupProfile(api) {
  await api("setMyCommands", {
    commands: [
      { command: "start", description: "Find the right plan for my business" },
      { command: "status", description: "Track my order" },
      { command: "new", description: "Start over" },
      { command: "human", description: "Talk to a person" },
      { command: "help", description: "What can you do?" },
    ],
  });
  await api("setMyCommands", {
    language_code: "hi",
    commands: [
      { command: "start", description: "मेरे बिज़नेस के लिए सही प्लान" },
      { command: "status", description: "मेरा ऑर्डर ट्रैक करें" },
      { command: "new", description: "फिर से शुरू करें" },
      { command: "human", description: "किसी व्यक्ति से बात करें" },
      { command: "help", description: "आप क्या कर सकते हैं?" },
    ],
  });
  await api("setMyShortDescription", { short_description: "Internet, business numbers, WhatsApp, billing and CCTV — one plan, one bill. Ask in any language." });
  await api("setMyDescription", {
    description:
      "Namaste! I'm Udyam from Accel Business. Tell me about your shop, clinic or office — by text or voice note, in Hindi, English or your language — and I'll suggest the right bundle with one clear monthly price, then keep you updated until everything is live.",
  });
}
