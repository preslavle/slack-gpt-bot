import { httpRouter } from "convex/server";
import { eventCallback } from "./slack";

const http = httpRouter();

http.route({
  path: "/slack/action-endpoint",
  method: "POST",
  handler: eventCallback,
});

// Convex expects the router to be the default export of `convex/http.js`.
export default http;