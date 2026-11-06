import { afterEach, describe, expect, it, jest } from "@jest/globals";

const addConnection = jest.fn();
const removeConnection = jest.fn();
const getNotificationsForUser = jest.fn();
const markAsRead = jest.fn();
const markAllAsRead = jest.fn();
const getUnreadCount = jest.fn();
const logger = { info: jest.fn(), error: jest.fn() };

await jest.unstable_mockModule("../utils/notificationService.js", () => ({
  addConnection,
  removeConnection,
  getNotificationsForUser,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
}));

await jest.unstable_mockModule("../middleware/logger.js", () => ({
  logger,
}));

const {
  streamNotificationsHandler,
  getNotificationsHandler,
  markNotificationAsReadHandler,
  markAllAsReadHandler,
  getUnreadCountHandler,
} = await import("../controllers/notification.controller.js");

function createRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    written: [],
    setHeader: jest.fn(function setHeader(name, value) {
      this.headers[name] = value;
    }),
    write: jest.fn(function write(chunk) {
      this.written.push(chunk);
    }),
    status: jest.fn(function status(code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function json(payload) {
      this.body = payload;
      return this;
    }),
  };
}

describe("notification.controller unit", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it("streamNotificationsHandler sets SSE headers and handles close cleanup", async () => {
    jest.useFakeTimers();
    const closeHandlers = {};
    const req = {
      user: { _id: { toString: () => "u1" } },
      on: jest.fn((event, cb) => {
        closeHandlers[event] = cb;
      }),
    };
    const res = createRes();

    await streamNotificationsHandler(req, res);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");
    expect(addConnection).toHaveBeenCalledWith("u1", res);
    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining("SSE connection established")
    );

    jest.advanceTimersByTime(30000);
    expect(res.write).toHaveBeenCalledWith(": ping\n\n");

    closeHandlers.close();
    expect(removeConnection).toHaveBeenCalledWith("u1", res);
    expect(logger.info).toHaveBeenCalled();
  });

  it("streamNotificationsHandler removes connection when ping write throws", async () => {
    jest.useFakeTimers();
    const req = {
      user: { _id: { toString: () => "u2" } },
      on: jest.fn(),
    };
    const res = createRes();
    let writes = 0;
    res.write = jest.fn(() => {
      writes += 1;
      if (writes > 1) {
        throw new Error("socket closed");
      }
    });

    await streamNotificationsHandler(req, res);
    jest.advanceTimersByTime(30000);

    expect(removeConnection).toHaveBeenCalledWith("u2", res);
  });

  it("getNotificationsHandler returns 200 payload", async () => {
    getNotificationsForUser.mockResolvedValue({
      notifications: [{ _id: "n1" }],
      totalCount: 1,
      hasMore: false,
    });
    const req = {
      user: { _id: { toString: () => "u1" } },
      query: { limit: "10", skip: "2", unreadOnly: "true" },
    };
    const res = createRes();

    await getNotificationsHandler(req, res);

    expect(getNotificationsForUser).toHaveBeenCalledWith("u1", {
      limit: 10,
      skip: 2,
      unreadOnly: true,
    });
    expect(res.statusCode).toBe(200);
  });

  it("getNotificationsHandler returns 500 on service error", async () => {
    getNotificationsForUser.mockRejectedValue(new Error("boom"));
    const req = { user: { _id: { toString: () => "u1" } }, query: {} };
    const res = createRes();

    await getNotificationsHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(logger.error).toHaveBeenCalled();
  });

  it("markNotificationAsReadHandler handles found, missing and error", async () => {
    const req = { user: { _id: { toString: () => "u1" } }, params: { id: "n1" } };
    const res = createRes();
    markAsRead.mockResolvedValueOnce({ _id: "n1", read: true });
    await markNotificationAsReadHandler(req, res);
    expect(res.statusCode).toBe(200);

    markAsRead.mockResolvedValueOnce(null);
    await markNotificationAsReadHandler(req, res);
    expect(res.statusCode).toBe(404);

    markAsRead.mockRejectedValueOnce(new Error("oops"));
    await markNotificationAsReadHandler(req, res);
    expect(res.statusCode).toBe(500);
  });

  it("markAllAsReadHandler and getUnreadCountHandler cover success and errors", async () => {
    const req = { user: { _id: { toString: () => "u1" } } };
    const res = createRes();

    markAllAsRead.mockResolvedValueOnce(3);
    await markAllAsReadHandler(req, res);
    expect(res.statusCode).toBe(200);

    markAllAsRead.mockRejectedValueOnce(new Error("x"));
    await markAllAsReadHandler(req, res);
    expect(res.statusCode).toBe(500);

    getUnreadCount.mockResolvedValueOnce(5);
    await getUnreadCountHandler(req, res);
    expect(res.statusCode).toBe(200);

    getUnreadCount.mockRejectedValueOnce(new Error("y"));
    await getUnreadCountHandler(req, res);
    expect(res.statusCode).toBe(500);
  });
});
