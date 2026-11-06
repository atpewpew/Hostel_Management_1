/**
 * Shared mock helpers for email-client.js.
 *
 * Usage inside a test file (ESM):
 *
 *   import { mockEmailModule, getEmailCalls } from "./mocks/emailMock.js";
 *   await mockEmailModule();          // call BEFORE importing the controller
 *
 * After the mock is installed every call to sendEmail() resolves with a fake
 * messageId and the call details are recorded so tests can assert on them.
 */

let _calls = [];

/**
 * Install the mock for `../utils/email-client.js`.
 * Must be called before the module under test is imported.
 */
export async function mockEmailModule() {
  const { jest } = await import("@jest/globals");

  await jest.unstable_mockModule("../../utils/email-client.js", () => ({
    sendEmail: jest.fn(async (mailOptions) => {
      _calls.push(mailOptions);
      return { messageId: `mock-msg-${Date.now()}` };
    }),
    getEmailUser: jest.fn(() => "test@hostelia.local"),
  }));
}

/**
 * Return all captured sendEmail calls since the last reset.
 */
export function getEmailCalls() {
  return _calls;
}

/**
 * Clear captured calls (call in afterEach).
 */
export function resetEmailCalls() {
  _calls = [];
}
