const tags = [
  { name: "Health", description: "Service health endpoints" },
  { name: "GraphQL", description: "GraphQL endpoint" },
  { name: "Auth", description: "Authentication and session management" },
  { name: "Users", description: "User management endpoints" },
  { name: "Mess", description: "Mess, menu, and feedback endpoints" },
  { name: "Problems", description: "Complaint/problem lifecycle endpoints" },
  { name: "Announcements", description: "Announcement endpoints" },
  { name: "Fees", description: "Fee submission and reminder endpoints" },
  { name: "Transit", description: "Transit entry endpoints" },
  { name: "Wardens", description: "Warden administration endpoints" },
  { name: "Notifications", description: "Notification and SSE endpoints" },
  { name: "Contact", description: "Public contact endpoint" },
  { name: "Colleges", description: "College registration and lookup" },
  { name: "Hostels", description: "Hostel management endpoints" },
  { name: "Manager", description: "Platform manager endpoints" },
];

const cookieAuth = [ { cookieAuth: [] } ];

export function buildOpenApiSpec(serverUrl) {
  return {
    openapi: "3.0.3",
    info: {
      title: "Hostelia Backend API",
      version: "1.0.0",
      description:
        "API documentation for Hostelia (Express + MongoDB). All protected endpoints use JWT stored in the `jwt` HTTP-only cookie.",
      contact: {
        name: "Hostelia Team",
      },
    },
    servers: [
      {
        url: serverUrl,
        description: "Active server",
      },
    ],
    tags,
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "jwt",
          description: "JWT session token cookie issued on login",
        },
      },
      schemas: {
        ApiSuccess: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Operation completed" },
          },
        },
        GraphQLRequest: {
          type: "object",
          required: ["query"],
          properties: {
            query: {
              type: "string",
              example: "query { health me { _id name email role } }",
            },
            variables: {
              type: "object",
              nullable: true,
              additionalProperties: true,
              example: {},
            },
            operationName: {
              type: "string",
              nullable: true,
              example: null,
            },
          },
        },
        GraphQLError: {
          type: "object",
          properties: {
            message: { type: "string" },
            path: {
              type: "array",
              items: {
                oneOf: [{ type: "string" }, { type: "number" }],
              },
            },
            extensions: {
              type: "object",
              additionalProperties: true,
            },
          },
        },
        GraphQLResponse: {
          type: "object",
          properties: {
            data: {
              type: "object",
              nullable: true,
              additionalProperties: true,
              example: { health: "ok" },
            },
            errors: {
              type: "array",
              items: { $ref: "#/components/schemas/GraphQLError" },
              nullable: true,
            },
          },
        },
        ApiError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Validation failed" },
            error: { type: "string", nullable: true },
            errors: { type: "object", nullable: true },
          },
        },
        ObjectIdParam: {
          type: "string",
          pattern: "^[0-9a-fA-F]{24}$",
          example: "65f1d8a90f9b7d6f6af08f98",
        },
      },
      responses: {
        Unauthorized: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        },
        Forbidden: {
          description: "Forbidden",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        },
        NotFound: {
          description: "Not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        },
        ServerError: {
          description: "Server error",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        },
      },
    },
    paths: {
      "/": {
        get: {
          tags: ["Health"],
          summary: "Health check",
          description: "Returns backend welcome message.",
          security: [],
          responses: {
            200: {
              description: "Service is up",
              content: {
                "text/plain": {
                  schema: { type: "string", example: "Welcome to backend server of Hostelia" },
                },
              },
            },
          },
        },
      },
      "/api/graphql": {
        post: {
          tags: ["GraphQL"],
          summary: "GraphQL endpoint",
          description:
            "GraphQL endpoint. Requires the `jwt` HTTP-only cookie (login first, or paste cookie value via Authorize).",
          security: cookieAuth,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GraphQLRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "GraphQL response",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/GraphQLResponse" },
                },
              },
            },
            401: { $ref: "#/components/responses/Unauthorized" },
            500: { $ref: "#/components/responses/ServerError" },
          },
        },
      },
      "/api/auth/generate-otp": {
        post: {
          tags: ["Auth"],
          summary: "Generate OTP",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "collegeId", "name", "rollNo"],
                  properties: {
                    email: { type: "string", format: "email" },
                    collegeId: { $ref: "#/components/schemas/ObjectIdParam" },
                    name: { type: "string" },
                    rollNo: { type: "string", example: "101" },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "OTP sent" },
            400: { description: "Validation failed" },
            500: { $ref: "#/components/responses/ServerError" },
          },
        },
      },
      "/api/auth/verify-otp": {
        post: {
          tags: ["Auth"],
          summary: "Verify OTP",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "collegeId", "otp"],
                  properties: {
                    email: { type: "string", format: "email" },
                    collegeId: { $ref: "#/components/schemas/ObjectIdParam" },
                    otp: { type: "string", example: "123456" },
                    userData: {
                      type: "object",
                      nullable: true,
                      properties: {
                        name: { type: "string" },
                        rollNo: { type: "string" },
                        hostelId: { $ref: "#/components/schemas/ObjectIdParam" },
                        roomNo: { type: "string" },
                        password: { type: "string", minLength: 6 },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "OTP verified" },
            400: { description: "Invalid OTP or validation failed" },
            500: { $ref: "#/components/responses/ServerError" },
          },
        },
      },
      "/api/auth/signup": {
        post: {
          tags: ["Auth"],
          summary: "Signup student",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "rollNo", "email", "collegeId", "hostelId", "roomNo", "password"],
                  properties: {
                    name: { type: "string" },
                    rollNo: { type: "string" },
                    email: { type: "string", format: "email" },
                    collegeId: { $ref: "#/components/schemas/ObjectIdParam" },
                    hostelId: { $ref: "#/components/schemas/ObjectIdParam" },
                    roomNo: { type: "string" },
                    password: { type: "string", minLength: 6 },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "User registered" },
            400: { description: "Validation or duplicate error" },
            500: { $ref: "#/components/responses/ServerError" },
          },
        },
      },
      "/api/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Login",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password", "collegeId"],
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string" },
                    collegeId: { $ref: "#/components/schemas/ObjectIdParam" },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Login successful, jwt cookie set" },
            400: { description: "Bad credentials or validation error" },
            403: { description: "College pending or rejected" },
            500: { $ref: "#/components/responses/ServerError" },
          },
        },
      },
      "/api/auth/manager-login": {
        post: {
          tags: ["Auth"],
          summary: "Manager login",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Manager authenticated" },
            400: { description: "Invalid credentials or validation error" },
            500: { $ref: "#/components/responses/ServerError" },
          },
        },
      },
      "/api/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Logout",
          security: cookieAuth,
          responses: {
            200: { description: "Logged out" },
            401: { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/api/user/bulk-upload": {
        post: {
          tags: ["Users"],
          summary: "Bulk create or upsert students",
          security: cookieAuth,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["students"],
                  properties: {
                    mode: { type: "string", enum: ["create", "upsert"], default: "create" },
                    students: {
                      type: "array",
                      minItems: 1,
                      maxItems: 200,
                      items: {
                        type: "object",
                        required: ["name", "rollNo", "email", "hostel", "roomNo", "mess", "password"],
                        properties: {
                          name: { type: "string" },
                          rollNo: { type: "string", pattern: "^[0-9]{3}$" },
                          email: { type: "string", format: "email" },
                          hostel: { type: "string" },
                          roomNo: { type: "string" },
                          mess: { type: "string" },
                          password: { type: "string", minLength: 6 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Bulk upload processed" },
            400: { description: "Validation failed" },
            403: { $ref: "#/components/responses/Forbidden" },
          },
        },
      },
      "/api/user/students/all": {
        get: {
          tags: ["Users"],
          summary: "Get all students",
          security: cookieAuth,
          responses: { 200: { description: "Students fetched" } },
        },
      },
      "/api/user/wardens/all": {
        get: {
          tags: ["Users"],
          summary: "Get all wardens",
          security: cookieAuth,
          responses: { 200: { description: "Wardens fetched" } },
        },
      },
      "/api/user/getName/{userId}": {
        get: {
          tags: ["Users"],
          summary: "Get user name + role",
          security: cookieAuth,
          parameters: [
            {
              name: "userId",
              in: "path",
              required: true,
              schema: { $ref: "#/components/schemas/ObjectIdParam" },
            },
          ],
          responses: { 200: { description: "User found" }, 404: { $ref: "#/components/responses/NotFound" } },
        },
      },
      "/api/user/update/{userId}": {
        put: {
          tags: ["Users"],
          summary: "Update user details",
          security: cookieAuth,
          parameters: [
            {
              name: "userId",
              in: "path",
              required: true,
              schema: { $ref: "#/components/schemas/ObjectIdParam" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string", minLength: 1 },
                    rollNo: { type: "string", minLength: 1 },
                    email: { type: "string", format: "email" },
                    hostelId: { $ref: "#/components/schemas/ObjectIdParam" },
                    messId: {
                      type: "string",
                      pattern: "^[0-9a-fA-F]{24}$",
                      nullable: true,
                    },
                    roomNo: { type: "string", minLength: 1 },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "User updated" } },
        },
      },
      "/api/user/{userId}": {
        get: {
          tags: ["Users"],
          summary: "Get user by id",
          security: cookieAuth,
          parameters: [
            {
              name: "userId",
              in: "path",
              required: true,
              schema: { $ref: "#/components/schemas/ObjectIdParam" },
            },
          ],
          responses: { 200: { description: "User found" }, 404: { $ref: "#/components/responses/NotFound" } },
        },
        delete: {
          tags: ["Users"],
          summary: "Delete user",
          security: cookieAuth,
          parameters: [
            {
              name: "userId",
              in: "path",
              required: true,
              schema: { $ref: "#/components/schemas/ObjectIdParam" },
            },
          ],
          responses: { 200: { description: "User deleted" }, 403: { $ref: "#/components/responses/Forbidden" } },
        },
      },
      "/api/mess/create": {
        post: {
          tags: ["Mess"],
          summary: "Create mess",
          security: cookieAuth,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name"],
                  properties: {
                    name: { type: "string" },
                    capacity: { type: "number" },
                  },
                },
              },
            },
          },
          responses: { 201: { description: "Mess created" } },
        },
      },
      "/api/mess/list": {
        get: {
          tags: ["Mess"],
          summary: "List messes",
          security: cookieAuth,
          responses: { 200: { description: "Messes list" } },
        },
      },
      "/api/mess/menu": {
        get: {
          tags: ["Mess"],
          summary: "Get menu",
          security: cookieAuth,
          parameters: [
            {
              name: "messId",
              in: "query",
              required: true,
              description: "Mess ID to fetch menu for (required).",
              schema: { $ref: "#/components/schemas/ObjectIdParam" },
            },
          ],
          responses: { 200: { description: "Menu fetched" } },
        },
        put: {
          tags: ["Mess"],
          summary: "Update menu",
          security: cookieAuth,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["messId", "updates"],
                  properties: {
                    messId: { $ref: "#/components/schemas/ObjectIdParam" },
                    updates: {
                      type: "object",
                      description: "Day-based menu updates. Keys should be day names (e.g., Monday).",
                      additionalProperties: {
                        type: "object",
                        description: "Per-day meal updates where keys are Breakfast/Lunch/Snacks/Dinner.",
                        additionalProperties: {
                          type: "array",
                          items: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "Menu updated" } },
        },
      },
      "/api/mess/feedback": {
        post: {
          tags: ["Mess"],
          summary: "Submit feedback",
          security: cookieAuth,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["date", "mealType", "rating"],
                  properties: {
                    date: { type: "string", format: "date" },
                    mealType: { type: "string", enum: ["Breakfast", "Lunch", "Snacks", "Dinner"] },
                    rating: { type: "number", minimum: 1, maximum: 5 },
                    comment: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { 201: { description: "Feedback submitted" } },
        },
        get: {
          tags: ["Mess"],
          summary: "Get all feedbacks",
          security: cookieAuth,
          responses: { 200: { description: "Feedbacks fetched" } },
        },
      },
      "/api/problem": {
        post: {
          tags: ["Problems"],
          summary: "Create problem",
          security: cookieAuth,
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["problemTitle", "problemDescription", "hostelId", "roomNo", "category", "problemImage"],
                  properties: {
                    problemTitle: { type: "string" },
                    problemDescription: { type: "string" },
                    hostelId: { $ref: "#/components/schemas/ObjectIdParam" },
                    roomNo: { type: "string" },
                    category: { type: "string" },
                    problemImage: { type: "string", format: "binary" },
                  },
                },
              },
            },
          },
          responses: { 201: { description: "Problem created" } },
        },
        get: {
          tags: ["Problems"],
          summary: "List problems",
          security: cookieAuth,
          parameters: [
            {
              name: "query",
              in: "query",
              required: false,
              description: "Free-text search across title, description, room, category, roll number, or student name.",
              schema: { type: "string" },
            },
            {
              name: "status",
              in: "query",
              required: false,
              schema: {
                type: "string",
                enum: ["Pending", "Resolved", "Rejected", "ToBeConfirmed"],
              },
            },
            {
              name: "category",
              in: "query",
              required: false,
              schema: {
                type: "string",
                enum: [
                  "Electrical",
                  "Plumbing",
                  "Painting",
                  "Carpentry",
                  "Cleaning",
                  "Internet",
                  "Furniture",
                  "Pest Control",
                  "Student Misconduct",
                  "Other",
                ],
              },
            },
            {
              name: "hostelId",
              in: "query",
              required: false,
              description: "Optional hostel filter (applies for collegeAdmin).",
              schema: { $ref: "#/components/schemas/ObjectIdParam" },
            },
          ],
          responses: { 200: { description: "Problems fetched" } },
        },
      },
      "/api/problem/{id}/comments": {
        post: {
          tags: ["Problems"],
          summary: "Add problem comment",
          security: cookieAuth,
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { $ref: "#/components/schemas/ObjectIdParam" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["message"],
                  properties: { message: { type: "string" } },
                },
              },
            },
          },
          responses: { 201: { description: "Comment added" } },
        },
      },
      "/api/problem/{id}/status": {
        patch: {
          tags: ["Problems"],
          summary: "Update problem status",
          security: cookieAuth,
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { $ref: "#/components/schemas/ObjectIdParam" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["status"],
                  properties: {
                    status: {
                      type: "string",
                      enum: ["Pending", "Resolved", "Rejected", "ToBeConfirmed"],
                    },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "Status updated" } },
        },
      },
      "/api/problem/{id}/verify": {
        patch: {
          tags: ["Problems"],
          summary: "Verify problem resolution",
          security: cookieAuth,
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { $ref: "#/components/schemas/ObjectIdParam" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["studentStatus"],
                  properties: {
                    studentStatus: { type: "string", enum: ["NotResolved", "Resolved", "Rejected"] },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "Verification updated" } },
        },
      },
      "/api/announcement": {
        get: {
          tags: ["Announcements"],
          summary: "Get announcements",
          security: cookieAuth,
          responses: { 200: { description: "Announcements fetched" } },
        },
        post: {
          tags: ["Announcements"],
          summary: "Create announcement",
          security: cookieAuth,
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["title", "message"],
                  properties: {
                    title: { type: "string" },
                    message: { type: "string" },
                    announcementFile: { type: "string", format: "binary" },
                  },
                },
              },
            },
          },
          responses: { 201: { description: "Announcement created" } },
        },
      },
      "/api/announcement/{id}": {
        delete: {
          tags: ["Announcements"],
          summary: "Delete announcement",
          security: cookieAuth,
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { $ref: "#/components/schemas/ObjectIdParam" },
            },
          ],
          responses: { 200: { description: "Announcement deleted" } },
        },
      },
      "/api/announcement/{id}/comments": {
        post: {
          tags: ["Announcements"],
          summary: "Add announcement comment",
          security: cookieAuth,
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { $ref: "#/components/schemas/ObjectIdParam" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["message"],
                  properties: { message: { type: "string" } },
                },
              },
            },
          },
          responses: { 201: { description: "Comment added" } },
        },
      },
      "/api/fee": {
        get: {
          tags: ["Fees"],
          summary: "Get fee status",
          security: cookieAuth,
          responses: { 200: { description: "Fee status fetched" } },
        },
      },
      "/api/fee/hostel": {
        post: {
          tags: ["Fees"],
          summary: "Submit hostel fee document",
          security: cookieAuth,
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: {
                    documentImage: { type: "string", format: "binary" },
                  },
                  required: ["documentImage"],
                },
              },
            },
          },
          responses: { 201: { description: "Hostel fee submitted" } },
        },
      },
      "/api/fee/mess": {
        post: {
          tags: ["Fees"],
          summary: "Submit mess fee document",
          security: cookieAuth,
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: {
                    documentImage: { type: "string", format: "binary" },
                  },
                  required: ["documentImage"],
                },
              },
            },
          },
          responses: { 201: { description: "Mess fee submitted" } },
        },
      },
      "/api/fee/{studentId}/status": {
        patch: {
          tags: ["Fees"],
          summary: "Update fee status",
          security: cookieAuth,
          parameters: [
            {
              name: "studentId",
              in: "path",
              required: true,
              schema: { $ref: "#/components/schemas/ObjectIdParam" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    hostelFeeStatus: {
                      type: "string",
                      enum: ["documentNotSubmitted", "pending", "approved", "rejected"],
                    },
                    messFeeStatus: {
                      type: "string",
                      enum: ["documentNotSubmitted", "pending", "approved", "rejected"],
                    },
                  },
                  anyOf: [
                    { required: ["hostelFeeStatus"] },
                    { required: ["messFeeStatus"] },
                  ],
                },
              },
            },
          },
          responses: { 200: { description: "Fee status updated" } },
        },
      },
      "/api/fee/email/reminder": {
        post: {
          tags: ["Fees"],
          summary: "Send single fee reminder",
          security: cookieAuth,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["studentId", "emailType"],
                  properties: {
                    studentId: { $ref: "#/components/schemas/ObjectIdParam" },
                    emailType: { type: "string", enum: ["hostelFee", "messFee", "both"] },
                    notes: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "Reminder sent" } },
        },
      },
      "/api/fee/email/bulk-reminder": {
        post: {
          tags: ["Fees"],
          summary: "Send bulk fee reminders",
          security: cookieAuth,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["studentIds", "emailType"],
                  properties: {
                    studentIds: {
                      type: "array",
                      minItems: 1,
                      items: { $ref: "#/components/schemas/ObjectIdParam" },
                    },
                    emailType: { type: "string", enum: ["hostelFee", "messFee", "both"] },
                    notes: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "Bulk reminders sent" } },
        },
      },
      "/api/transit": {
        post: {
          tags: ["Transit"],
          summary: "Create transit entry",
          security: cookieAuth,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["purpose", "transitStatus", "date"],
                  properties: {
                    purpose: { type: "string" },
                    transitStatus: { type: "string", enum: ["ENTRY", "EXIT"] },
                    date: { type: "string", format: "date" },
                    time: { type: "string", example: "14:30:00" },
                  },
                },
              },
            },
          },
          responses: { 201: { description: "Transit entry created" } },
        },
        get: {
          tags: ["Transit"],
          summary: "List transit entries",
          security: cookieAuth,
          responses: { 200: { description: "Transit entries fetched" } },
        },
      },
      "/api/warden": {
        get: {
          tags: ["Wardens"],
          summary: "List wardens",
          security: cookieAuth,
          responses: { 200: { description: "Wardens fetched" } },
        },
      },
      "/api/warden/create": {
        post: {
          tags: ["Wardens"],
          summary: "Appoint warden",
          security: cookieAuth,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "email", "hostelId", "password"],
                  properties: {
                    name: { type: "string" },
                    email: { type: "string", format: "email" },
                    hostelId: { $ref: "#/components/schemas/ObjectIdParam" },
                    password: { type: "string", minLength: 6 },
                  },
                },
              },
            },
          },
          responses: { 201: { description: "Warden appointed" } },
        },
      },
      "/api/notifications/stream": {
        get: {
          tags: ["Notifications"],
          summary: "SSE notifications stream",
          security: cookieAuth,
          responses: {
            200: {
              description: "text/event-stream",
              content: {
                "text/event-stream": {
                  schema: { type: "string" },
                },
              },
            },
          },
        },
      },
      "/api/notifications": {
        get: {
          tags: ["Notifications"],
          summary: "Get notifications",
          security: cookieAuth,
          parameters: [
            {
              name: "limit",
              in: "query",
              required: false,
              description: "Number of records to return (default 50).",
              schema: { type: "integer", minimum: 1, example: 50 },
            },
            {
              name: "skip",
              in: "query",
              required: false,
              description: "Number of records to skip for pagination (default 0).",
              schema: { type: "integer", minimum: 0, example: 0 },
            },
            {
              name: "unreadOnly",
              in: "query",
              required: false,
              description: "Set to true to fetch only unread notifications.",
              schema: { type: "boolean", example: false },
            },
          ],
          responses: { 200: { description: "Notifications fetched" } },
        },
      },
      "/api/notifications/unread-count": {
        get: {
          tags: ["Notifications"],
          summary: "Get unread notification count",
          security: cookieAuth,
          responses: { 200: { description: "Unread count fetched" } },
        },
      },
      "/api/notifications/{id}/read": {
        patch: {
          tags: ["Notifications"],
          summary: "Mark one notification as read",
          security: cookieAuth,
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { $ref: "#/components/schemas/ObjectIdParam" },
            },
          ],
          responses: { 200: { description: "Notification marked as read" } },
        },
      },
      "/api/notifications/read-all": {
        patch: {
          tags: ["Notifications"],
          summary: "Mark all notifications as read",
          security: cookieAuth,
          responses: { 200: { description: "All notifications marked as read" } },
        },
      },
      "/api/contact": {
        post: {
          tags: ["Contact"],
          summary: "Submit contact form",
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "email", "message"],
                  properties: {
                    name: { type: "string", minLength: 2, maxLength: 100 },
                    email: { type: "string", format: "email" },
                    subject: { type: "string", minLength: 3, maxLength: 200 },
                    message: { type: "string", minLength: 1, maxLength: 200 },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "Message sent" } },
        },
      },
      "/api/college/register": {
        post: {
          tags: ["Colleges"],
          summary: "Register new college",
          security: [],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["collegeName", "emailDomain", "adminEmail", "hostels[]", "messes[]"],
                  properties: {
                    collegeName: { type: "string" },
                    emailDomain: { type: "string", example: "@mycollege.edu" },
                    adminEmail: { type: "string", format: "email" },
                    address: { type: "string" },
                    "hostels[]": {
                      type: "array",
                      items: { type: "string" },
                    },
                    "messes[]": {
                      type: "array",
                      items: { type: "string" },
                    },
                    logo: { type: "string", format: "binary" },
                  },
                },
              },
            },
          },
          responses: { 201: { description: "College registration submitted" } },
        },
      },
      "/api/college/list": {
        get: {
          tags: ["Colleges"],
          summary: "Get approved colleges list",
          security: [],
          responses: { 200: { description: "Colleges fetched" } },
        },
      },
      "/api/college/{collegeId}/hostels": {
        get: {
          tags: ["Colleges"],
          summary: "Get hostels by college",
          security: [],
          parameters: [
            {
              name: "collegeId",
              in: "path",
              required: true,
              schema: { $ref: "#/components/schemas/ObjectIdParam" },
            },
          ],
          responses: { 200: { description: "Hostels fetched" } },
        },
      },
      "/api/hostel/list": {
        get: {
          tags: ["Hostels"],
          summary: "List hostels",
          security: cookieAuth,
          responses: { 200: { description: "Hostels fetched" } },
        },
      },
      "/api/hostel/create": {
        post: {
          tags: ["Hostels"],
          summary: "Create hostel",
          security: cookieAuth,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name"],
                  properties: {
                    name: { type: "string" },
                    capacity: { type: "number" },
                  },
                },
              },
            },
          },
          responses: { 201: { description: "Hostel created" } },
        },
      },
      "/api/manager/stats": {
        get: {
          tags: ["Manager"],
          summary: "Get manager dashboard stats",
          security: cookieAuth,
          responses: { 200: { description: "Stats fetched" } },
        },
      },
      "/api/manager/colleges": {
        get: {
          tags: ["Manager"],
          summary: "List all colleges with counts",
          security: cookieAuth,
          responses: { 200: { description: "Colleges fetched" } },
        },
      },
      "/api/manager/colleges/pending": {
        get: {
          tags: ["Manager"],
          summary: "List pending colleges",
          security: cookieAuth,
          responses: { 200: { description: "Pending colleges fetched" } },
        },
      },
      "/api/manager/colleges/{id}/approve": {
        post: {
          tags: ["Manager"],
          summary: "Approve college",
          security: cookieAuth,
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { $ref: "#/components/schemas/ObjectIdParam" },
            },
          ],
          responses: { 200: { description: "College approved" } },
        },
      },
      "/api/manager/colleges/{id}/reject": {
        post: {
          tags: ["Manager"],
          summary: "Reject college",
          security: cookieAuth,
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { $ref: "#/components/schemas/ObjectIdParam" },
            },
          ],
          responses: { 200: { description: "College rejected" } },
        },
      },
    },
  };
}
