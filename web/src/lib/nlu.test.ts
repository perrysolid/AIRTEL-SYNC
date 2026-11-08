import { describe, expect, it } from "vitest";
import { parseUtterance } from "./nlu";

describe("bilingual slot extraction", () => {
  it("English sentence", () => {
    const p = parseUtterance("I run a dental clinic in Pune with 8 staff, need wifi for patients and CCTV");
    expect(p.businessType).toBe("Dental clinic");
    expect(p.city).toBe("Pune");
    expect(p.employees).toBe(8);
    expect(p.needs).toEqual(expect.arrayContaining(["internet", "cctv", "guest_wifi"]));
  });

  it("Hinglish sentence", () => {
    const p = parseUtterance("meri kirana dukaan hai Jaipur mein, do log kaam karte hain, UPI billing aur whatsapp chahiye, gst nahi hai");
    expect(p.businessType).toBe("Kirana store");
    expect(p.city).toBe("Jaipur");
    expect(p.needs).toEqual(expect.arrayContaining(["pos_billing", "whatsapp"]));
    expect(p.hasGstin).toBe(false);
  });

  it("Devanagari sentence", () => {
    const p = parseUtterance("मेरी किराना दुकान है, ५ लोग काम करते हैं, कैमरा और इंटरनेट चाहिए");
    expect(p.businessType).toBe("Kirana store");
    expect(p.employees).toBe(5);
    expect(p.needs).toEqual(expect.arrayContaining(["cctv", "internet"]));
  });

  it("finds a GSTIN inside text", () => {
    expect(parseUtterance("my gst is 32ttnxb7384t1zw").gstin).toBe("32TTNXB7384T1ZW");
  });

  it("chains and sites", () => {
    const p = parseUtterance("We are a restaurant chain with 6 outlets in Bangalore");
    expect(p.businessType).toBe("Restaurant chain");
    expect(p.sites).toBe(6);
    expect(p.city).toBe("Bengaluru");
  });

  it("bare numbers and yes/no", () => {
    expect(parseUtterance("12").number).toBe(12);
    expect(parseUtterance("haan").yes).toBe(true);
    expect(parseUtterance("नहीं").no).toBe(true);
  });
});

describe("money", () => {
  it("reads a budget and today's spend", () => {
    expect(parseUtterance("keep it under ₹3,000 a month").budget).toBe(3000);
    expect(parseUtterance("budget is 5k").budget).toBe(5000);
    expect(parseUtterance("Comes with data plan of jio 399 pm").monthlySpend).toBe(399);
    expect(parseUtterance("we pay around 2,500 per month for broadband").monthlySpend).toBe(2500);
    expect(parseUtterance("I have 5 staff").budget).toBeUndefined();
  });
});
