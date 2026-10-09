import { describe, expect, it } from "vitest";
import {
  publicBaseUrl,
  INVITE_TTL_MS, afterAuthPath, buildInviteLink, clearPendingInvite, inviteMessage, normalizeUsPhone, parseInviteCode,
  readPendingContact, readPendingInvite, savePendingContact, savePendingInvite, smsHref, type KV,
} from "../invites";

const memory = (): KV & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } };
};
const HOST = "11111111-1111-1111-1111-111111111111";

describe("invite codes and links", () => {
  it("accepts 6-character codes in any case or with dashes", () => {
    expect(parseInviteCode("abc123")).toBe("ABC123");
    expect(parseInviteCode("AB-C1 23")).toBe("ABC123");
  });
  it("rejects anything else", () => {
    for (const bad of ["", "ABC12", "ABC1234", null, undefined, "!!!!!!"]) expect(parseInviteCode(bad as string)).toBeNull();
  });
  it("builds a link carrying the code and the host", () => {
    expect(buildInviteLink("https://lucky-golf-app.vercel.app/", "abc123", HOST)).toBe(`https://lucky-golf-app.vercel.app/join/ABC123?from=${HOST}`);
    expect(buildInviteLink("https://x.test", "ABC123", "not-a-uuid")).toBe("https://x.test/join/ABC123");
    expect(() => buildInviteLink("https://x.test", "nope", HOST)).toThrow();
  });
  it("writes a text that includes the stake and the link, and a texting link that is safely encoded", () => {
    const msg = inviteMessage("https://x.test/join/ABC123", 10);
    expect(msg).toContain("$10 buy-in");
    expect(msg).toContain("https://x.test/join/ABC123");
    expect(inviteMessage("https://x.test/join/ABC123", null)).not.toContain("buy-in");
    const href = smsHref("a b&c=d");
    expect(href.startsWith("sms:?&body=")).toBe(true);
    expect(href).not.toContain(" ");
    expect(decodeURIComponent(href.slice("sms:?&body=".length))).toBe("a b&c=d");
  });
});

describe("phone numbers", () => {
  it("normalises common US formats", () => {
    for (const ok of ["(415) 555-0132", "415-555-0132", "415.555.0132", "4155550132", "1 415 555 0132", "+1 (415) 555-0132"]) {
      expect(normalizeUsPhone(ok)).toBe("+14155550132");
    }
  });
  it("rejects numbers that cannot be real US mobiles", () => {
    for (const bad of ["", "555-0132", "04155550132", "0155550132", "1155550132", "41555501321", "abcdefghij"]) expect(normalizeUsPhone(bad)).toBeNull();
  });
});

describe("pending invite", () => {
  it("is kept until used, with the host", () => {
    const s = memory();
    expect(savePendingInvite(s, "abc123", HOST, 1000)).toBe(true);
    expect(readPendingInvite(s, 2000)).toEqual({ code: "ABC123", from: HOST, at: 1000 });
    expect(afterAuthPath(s, 2000)).toBe("/play/wagers");
    clearPendingInvite(s);
    expect(readPendingInvite(s)).toBeNull();
    expect(afterAuthPath(s)).toBe("/");
  });
  it("expires after a day", () => {
    const s = memory();
    savePendingInvite(s, "ABC123", null, 0);
    expect(readPendingInvite(s, INVITE_TTL_MS - 1)).not.toBeNull();
    expect(readPendingInvite(s, INVITE_TTL_MS + 1)).toBeNull();
    expect(s.data["lg_pending_invite"]).toBeUndefined();
  });
  it("ignores a bad code, a bad host id and junk in storage", () => {
    const s = memory();
    expect(savePendingInvite(s, "xx", HOST)).toBe(false);
    savePendingInvite(s, "ABC123", "<script>", 5);
    expect(readPendingInvite(s, 6)?.from).toBeNull();
    s.data["lg_pending_invite"] = "{not json";
    expect(readPendingInvite(s)).toBeNull();
  });
});

describe("pending contact", () => {
  it("round-trips and ignores junk", () => {
    const s = memory();
    savePendingContact(s, { phone: "+14155550132", consent: true });
    expect(readPendingContact(s)).toEqual({ phone: "+14155550132", consent: true });
    s.data["lg_pending_contact"] = '{"phone":5}';
    expect(readPendingContact(s)).toBeNull();
  });
});

describe("publicBaseUrl", () => {
  it("uses the permanent address when configured, trimming trailing slashes", () => {
    expect(publicBaseUrl("https://luckygolf.app/", "https://x.vercel.app")).toBe("https://luckygolf.app");
  });
  it("falls back to where the app is open when unset or not a web address", () => {
    expect(publicBaseUrl(undefined, "https://x.vercel.app")).toBe("https://x.vercel.app");
    expect(publicBaseUrl("luckygolf.app", "https://x.vercel.app/")).toBe("https://x.vercel.app");
  });
});
