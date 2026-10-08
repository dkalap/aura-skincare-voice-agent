# 🌿 Aura Skincare — AI Voice Customer Support Agent

An interactive, production-grade AI Voice Support Specialist ("Aria") built for **Aura Skincare**, a premium organic Indian skincare brand. The agent handles real-time customer inquiries regarding order tracking, product returns, cancellations, COD rules, and general brand policies over WebRTC.

---

## 🌟 Key Features

* **Low-Latency Voice Interactions**: Real-time bidirectional streaming using Vapi and WebRTC.
* **Agentic Tool Calling**: Dynamic execution of local functions (`get_order_details` and `cancel_order`) to fetch live order statuses or initiate order cancellations.
* **Hinglish & Code-Switching Support**: Optimized for Indian e-commerce scenarios where users naturally mix Hindi and English.
* **Structured Post-Call Analytics**: Automatically processes live transcripts upon call completion to generate structured JSON summary payloads (intent, order ID, resolution status, and call summary).
* **Brand Guardrails & Policy Enforcement**: Enforces COD limits (₹2,500), return windows (7 days for unopened items), and strict out-of-scope domain boundaries.

---

## 🛠️ Tech Stack & Architecture

* **Frontend**: React.js, HTML5/CSS3
* **Voice / Orchestration**: Vapi Web SDK (`@vapi-ai/web`)
* **Transport Protocol**: WebRTC (low-latency streaming audio)
* **LLM Engine**: OpenAI GPT-4o
* * **Deployment**: Vercel

---

## 🧠 Architectural & Product Reflection

### 1. Why did you choose your particular architecture and technology stack?
I chose **React** and the **Vapi Web SDK** because voice agents demand real-time, low-latency interaction. **WebRTC** streams audio bidirectionally with sub-second latency compared to traditional HTTP polling or WebSocket wrappers. React makes state updates—like live transcript rendering and dynamic JSON summary generation—seamless and immediate.

### 2. What was the most difficult part of the assignment, and how did you solve it?
Handling asynchronous tool calls without race conditions between Vapi's event listeners and React's state. I solved this by isolating tool logic (`get_order_details` and `cancel_order`) within scoped `useEffect` handlers, ensuring deterministic responses were returned to Vapi before the LLM formed its spoken reply.

### 3. If you had one more week to work on this, what would you improve first and why?
* **Real Backend & Auth**: Replace local mock data with a Node.js/PostgreSQL backend and add phone/OTP authentication before disclosing order info.
* **Fine-Tuned Interruption (Barge-in)**: Tune background noise thresholds so Aria stops speaking instantly when interrupted.

### 4. Imagine this agent is handling 1,000 customer conversations a day. What do you think would need to change or improve?
* **Security**: Token-based authentication via a backend serverless proxy instead of client-exposed public keys.
* **CRM Webhooks**: Stream post-call JSON summaries directly to Zendesk/Gorgias for auto-ticket creation.
* **Semantic Caching**: Cache common policy queries (e.g., return rules) using Redis to reduce LLM costs and latency.
* **Human Handoff**: Auto-transfer calls to live support agents (via Twilio/SIP) upon detecting high customer frustration.
* **Deployment**: Vercel

---
