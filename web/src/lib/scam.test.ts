import { describe, expect, it } from "vitest";
import { analyzeLink, analyzeScam, looksForwarded, scamChatText } from "./scam";

describe("Scam Shield", () => {
  const cases: [string, string, "scam" | "suspicious" | "clear"][] = [
    ["fake KYC SMS with look-alike link", "Dear customer your Airtel SIM will be blocked today. Update KYC immediately at http://airtel-kyc-update.xyz/verify or call 9876543210", "scam"],
    ["OTP request", "Sir I am calling from SBI. Please share the OTP you just received to stop the charge of Rs 4999", "scam"],
    ["'sent by mistake' refund trick", "Sorry bhai I sent Rs 5000 to your number by mistake, please send it back urgently", "scam"],
    ["APK + bill threat", "Your electricity will be cut tonight. Download app http://bijli-bill.top/pay.apk and pay Rs 10 now", "scam"],
    ["digital arrest + remote app", "This is CBI officer. You are under digital arrest. Install AnyDesk now", "scam"],
    ["Hindi KYC + OTP", "आपका खाता बंद हो जाएगा। तुरंत केवाईसी अपडेट करें और ओटीपी बताओ", "scam"],
    ["payment screenshot is never proof", "Payment successful Rs 2,400 paid to Raju Kirana UPI Ref 4421 will reflect shortly", "suspicious"],
    ["a legitimate bill reminder that warns against sharing OTP", "Your Airtel bill of Rs 499 is due on 20 Jul. Pay via Airtel Thanks app. Never share OTP with anyone.", "clear"],
    ["an ordinary message", "Hi, are we meeting at 5 pm for the supplier visit tomorrow?", "clear"],
  ];
  it.each(cases)("%s", (_name, text, verdict) => {
    expect(analyzeScam(text, text.match(/[ऀ-ॿ]/) ? "hi" : "en").verdict).toBe(verdict);
  });

  it("never claims a message is safe, and says a screenshot is not proof of payment", () => {
    const r = analyzeScam("Hi, are we meeting at 5 pm?");
    expect(r.label).toBe("No red flags found");
    expect(r.advice).toMatch(/no tool can prove/i);
    const shot = analyzeScam("Payment successful Rs 2,400 paid to Raju UPI Ref 4421");
    expect(shot.paymentScreenshot).toBe(true);
    expect(shot.label).toBe("Not proof of payment");
    expect(shot.actions.join(" ")).toMatch(/UPI app/i);
  });

  it("explains look-alike links and recognises official domains", () => {
    expect(analyzeLink("http://airtel-kyc-update.xyz").flags.map((f) => f[0])).toEqual(expect.arrayContaining(["lookalike", "risky_tld"]));
    expect(analyzeLink("https://www.airtel.in/business").flags.map((f) => f[0])).not.toContain("lookalike");
    expect(analyzeLink("https://bit.ly/3abc").flags.map((f) => f[0])).toContain("shortener");
    expect(analyzeLink("http://192.168.4.5/pay").flags.map((f) => f[0])).toContain("ip_host");
  });

  it("answers in Hindi and points to Chakshu and 1930 for a scam", () => {
    const r = analyzeScam("आपका खाता बंद हो जाएगा। तुरंत केवाईसी अपडेट करें और ओटीपी बताओ", "hi");
    expect(r.label).toBe("ठगी की आशंका");
    expect(r.actions.join(" ")).toMatch(/1930/);
    const en = analyzeScam("Your SIM will be blocked, update KYC at http://jio-kyc.xyz");
    expect(en.actions.join(" ")).toMatch(/Chakshu/);
  });

  it("scores stay within 0-100 and chat text is compact", () => {
    const r = analyzeScam("urgent lottery prize share otp anydesk digital arrest http://x.xyz/a.apk collect request");
    expect(r.score).toBeLessThanOrEqual(100);
    expect(scamChatText(r).length).toBeLessThan(1500);
  });

  it("detects forwarded content in chat but ignores ordinary talk", () => {
    expect(looksForwarded("check this http://bit.ly/abc")).toBe(true);
    expect(looksForwarded("Dear customer your SIM will be blocked share otp")).toBe(true);
    expect(looksForwarded("I run a kirana store in Pune")).toBe(false);
  });
});
