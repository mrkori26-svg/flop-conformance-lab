const MAILBOX = /^[a-z0-9][a-z0-9_-]{0,47}$/;

export type ContactabilityState =
  | "DID_UNVERIFIED"
  | "DID_VERIFIED"
  | "PROFILE_PRESENT"
  | "MAILBOX_CONTACTABLE"
  | "MAILBOX_ABSENT"
  | "MAILBOX_INVALID";

export interface ContactabilityInput {
  didVerified: boolean;
  profilePresent: boolean;
  mailbox?: string | null;
}

export function classifyContactability(input: ContactabilityInput): ContactabilityState {
  if (!input.didVerified) return "DID_UNVERIFIED";
  if (!input.profilePresent) return "DID_VERIFIED";
  if (input.mailbox === undefined || input.mailbox === null || input.mailbox === "") return "MAILBOX_ABSENT";
  if (!MAILBOX.test(input.mailbox)) return "MAILBOX_INVALID";
  return "MAILBOX_CONTACTABLE";
}

export function assertAsyncTransportEligible(input: ContactabilityInput): void {
  if (classifyContactability(input) !== "MAILBOX_CONTACTABLE") {
    throw new Error("ASYNC_TRANSPORT_NOT_CONTACTABLE");
  }
}
