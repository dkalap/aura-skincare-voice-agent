import React, { useState, useEffect } from 'react';
import Vapi from '@vapi-ai/web';

const VAPI_PUBLIC_KEY = process.env.REACT_APP_VAPI_PUBLIC_KEY;
const ASSISTANT_ID = process.env.REACT_APP_VAPI_ASSISTANT_ID;

const vapi = new Vapi(VAPI_PUBLIC_KEY);

const INITIAL_ORDERS = {
  '101': {
    display_id: 'Order 101',
    customer: 'Priya Sharma',
    product: 'Vitamin C Serum (30ml)',
    value: '₹699',
    status: 'Out for Delivery',
    notes: 'BlueDart — BD-982103. Expected by 6 PM today.'
  },
  '102': {
    display_id: 'Order 102',
    customer: 'Rahul Verma',
    product: 'Hydrating Sunscreen SPF 50',
    value: '₹499',
    status: 'Delivered',
    notes: 'Delivered 14 days ago. Return window closed.'
  },
  '103': {
    display_id: 'Order 103',
    customer: 'Ananya Patel',
    product: 'Green Tea Face Wash + Toner',
    value: '₹850',
    status: 'Processing',
    notes: 'Ordered 3 hours ago. Eligible for instant cancellation.'
  }
};

export default function App() {
  const [orders, setOrders] = useState(INITIAL_ORDERS);
  const [callStatus, setCallStatus] = useState('Idle');
  const [transcripts, setTranscripts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    vapi.removeAllListeners();

    vapi.on('call-start', () => setCallStatus('Active'));
    vapi.on('call-end', () => {
      setCallStatus('Idle');
      generateCallSummary();
    });

    vapi.on('speech-start', () => setCallStatus('Speaking'));
    vapi.on('speech-end', () => setCallStatus('Active'));

    vapi.on('message', (message) => {
      // 1. Handle Transcripts
      if (message.type === 'transcript') {
        const role = message.role;
        const text = message.transcript || '';

        setTranscripts((prev) => [
          ...prev,
          { role: role, text: text }
        ].slice(-20));

        // Direct transcript interception when user speaks
        if (role === 'user' && message.transcriptType === 'final') {
          handleDirectTranscriptLookup(text.toLowerCase());
        }
      }

      // 2. Handle Standard Vapi Tool Calls (If Vapi sends them)
      if (message.type === 'tool-calls' || message.type === 'function-call') {
        setCallStatus('Thinking');
        const toolCalls = message.toolWithToolCallList || [message];

        for (const call of toolCalls) {
          const fnName = call.toolCall?.function?.name || call.functionCall?.name;
          const rawArgs = call.toolCall?.function?.arguments || call.functionCall?.parameters || {};
          const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;

          const rawInput = String(args.order_id || args.orderId || '');
          const responseText = processOrderLogic(fnName, rawInput);

          const callId = call.toolCall?.id || call.callId;
          if (callId) {
            vapi.send({
              type: 'tool-call-result',
              toolCallId: callId,
              result: responseText
            });
          }
        }
      }
    });

    return () => vapi.removeAllListeners();
  }, [orders]);

  // Core Order Logic Handler
  const processOrderLogic = (action, input) => {
    const extractedDigits = String(input).replace(/\D/g, '');
    const targetKey = Object.keys(orders).find(
      (k) => k === String(input).trim() || k === extractedDigits
    ) || extractedDigits;

    const order = orders[targetKey];

    if (action === 'get_order_details' || action === 'lookup') {
      if (order) {
        return `Order ${order.display_id} belongs to ${order.customer}. Status is ${order.status}. Product is ${order.product}. Details: ${order.notes}`;
      }
      return `Order ${input} was not found in our database. Valid order IDs are 101, 102, and 103.`;
    }

    if (action === 'cancel_order' || action === 'cancel') {
      if (!order) {
        return `Order ${input} was not found.`;
      }
      if (order.status === 'Processing') {
        setOrders((prev) => ({
          ...prev,
          [targetKey]: { ...prev[targetKey], status: 'Cancelled' }
        }));
        return `Order ${order.display_id} has been successfully cancelled. Refund initiated to original payment method.`;
      }
      return `Cannot cancel ${order.display_id} because its current status is ${order.status}.`;
    }

    return `Order ${input} processed.`;
  };

  // Direct Speech Backup Interceptor
  const handleDirectTranscriptLookup = (userText) => {
    const digitMatch = userText.match(/\b(101|102|103)\b/);
    if (!digitMatch) return;

    const orderId = digitMatch[0];

    if (userText.includes('cancel')) {
      const response = processOrderLogic('cancel', orderId);
      vapi.send({
        type: 'add-message',
        message: { role: 'system', content: response }
      });
    } else if (userText.includes('order') || userText.includes('status') || userText.includes('details') || userText.includes('check') || userText.includes('101') || userText.includes('102') || userText.includes('103')) {
      const response = processOrderLogic('lookup', orderId);
      vapi.send({
        type: 'add-message',
        message: { role: 'system', content: response }
      });
    }
  };

  const generateCallSummary = () => {
    setTranscripts((currentTranscripts) => {
      const fullText = currentTranscripts.map((t) => t.text).join(' ').toLowerCase();

      const numMatch = fullText.match(/\b(101|102|103|1|2|3)\b/i);
      const matchedNum = numMatch ? numMatch[0] : null;
      let extractedOrder = 'N/A';
      if (matchedNum === '101' || matchedNum === '1') extractedOrder = 'Order 101';
      if (matchedNum === '102' || matchedNum === '2') extractedOrder = 'Order 102';
      if (matchedNum === '103' || matchedNum === '3') extractedOrder = 'Order 103';

      let intent = 'GENERAL_BRAND_INQUIRY';
      if (fullText.includes('cancel')) {
        intent = 'ORDER_CANCELLATION';
      } else if (fullText.includes('return') || fullText.includes('refund') || fullText.includes('unopened') || fullText.includes('policy')) {
        intent = 'POLICY_AND_RETURNS_INQUIRY';
      } else if (extractedOrder !== 'N/A' || fullText.includes('order') || fullText.includes('status')) {
        intent = 'ORDER_STATUS_ENQUIRY';
      }

      const topicsDiscussed = [];
      if (fullText.includes('return') || fullText.includes('policy')) topicsDiscussed.push('return policies');
      if (fullText.includes('cod') || fullText.includes('delivery') || fullText.includes('shipping')) topicsDiscussed.push('shipping/COD options');
      if (extractedOrder !== 'N/A') topicsDiscussed.push(`${extractedOrder}`);

      const summaryText = topicsDiscussed.length > 0
        ? `Customer inquired about ${topicsDiscussed.join(', ')}. Assistant provided answers according to brand guidelines.`
        : 'Customer engaged in general conversation with support agent.';

      setSummary({
        customer_intent: intent,
        order_id: extractedOrder,
        resolution_status: currentTranscripts.length > 2 ? 'RESOLVED' : 'INCOMPLETE',
        call_summary: summaryText
      });

      return currentTranscripts;
    });
  };

  const startCall = () => {
    setTranscripts([]);
    setSummary(null);
    vapi.start(ASSISTANT_ID);
  };

  const endCall = () => {
    vapi.stop();
  };

  const toggleMute = () => {
    const nextMuteState = !isMuted;
    vapi.setMuted(nextMuteState);
    setIsMuted(nextMuteState);
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🌿 Aura Skincare — Voice Support</h1>
        <p style={styles.subtitle}>AI Customer Agent Powered by Vapi & WebRTC</p>
      </header>

      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.statusHeader}>
            <span style={styles.statusLabel}>Agent Status:</span>
            <span style={{ ...styles.badge, backgroundColor: getStatusColor(callStatus) }}>
              {callStatus.toUpperCase()}
            </span>
          </div>

          <div style={styles.buttonRow}>
            {callStatus === 'Idle' ? (
              <button onClick={startCall} style={styles.primaryButton}>
                🎙️ Start Support Call
              </button>
            ) : (
              <>
                <button onClick={endCall} style={styles.dangerButton}>
                  ⏹️ End Call
                </button>
                <button onClick={toggleMute} style={styles.secondaryButton}>
                  {isMuted ? '🔊 Unmute' : '🔇 Mute'}
                </button>
              </>
            )}
          </div>

          <div style={styles.transcriptBox}>
            <h3 style={styles.sectionTitle}>Live Call Transcript</h3>
            {transcripts.length === 0 && (
              <p style={styles.placeholderText}>Click 'Start Support Call' and ask about order 101, 102, or 103...</p>
            )}
            {transcripts.map((t, index) => (
              <div key={index} style={t.role === 'user' ? styles.userBubble : styles.agentBubble}>
                <strong>{t.role === 'user' ? 'Customer' : 'Aria'}:</strong> {t.text}
              </div>
            ))}
          </div>
        </div>

        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>📦 Customer Orders Database</h3>
          <div style={styles.ordersList}>
            {Object.entries(orders).map(([id, details]) => (
              <div key={id} style={styles.orderCard}>
                <div style={styles.orderHeader}>
                  <strong>{details.display_id}</strong> — {details.customer}
                  <span style={{ ...styles.statusBadge, backgroundColor: getOrderStatusColor(details.status) }}>
                    {details.status}
                  </span>
                </div>
                <div style={styles.orderDetails}>{details.product} ({details.value})</div>
                <div style={styles.orderNotes}>{details.notes}</div>
              </div>
            ))}
          </div>

          {summary && (
            <div style={styles.summaryBox}>
              <h3 style={styles.sectionTitle}>📋 Structured Post-Call Analytics</h3>
              <pre style={styles.jsonText}>{JSON.stringify(summary, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const getStatusColor = (status) => {
  switch (status) {
    case 'Speaking': return '#10B981';
    case 'Thinking': return '#F59E0B';
    case 'Active': return '#3B82F6';
    default: return '#6B7280';
  }
};

const getOrderStatusColor = (status) => {
  switch (status) {
    case 'Out for Delivery': return '#3B82F6';
    case 'Delivered': return '#10B981';
    case 'Processing': return '#F59E0B';
    case 'Cancelled': return '#EF4444';
    default: return '#6B7280';
  }
};

const styles = {
  container: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', maxWidth: '1100px', margin: '0 auto', padding: '24px', backgroundColor: '#F8FAFC', minHeight: '100vh' },
  header: { marginBottom: '24px', textAlign: 'center' },
  title: { fontSize: '28px', color: '#0F172A', margin: '0 0 6px 0' },
  subtitle: { color: '#64748B', margin: 0, fontSize: '15px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' },
  card: { backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '20px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  statusHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  statusLabel: { fontWeight: '600', color: '#334155' },
  badge: { color: '#FFF', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' },
  buttonRow: { display: 'flex', gap: '10px', marginBottom: '20px' },
  primaryButton: { width: '100%', padding: '12px', backgroundColor: '#059669', color: '#FFF', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' },
  dangerButton: { flex: 1, padding: '12px', backgroundColor: '#DC2626', color: '#FFF', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' },
  secondaryButton: { padding: '12px 18px', backgroundColor: '#E2E8F0', color: '#334155', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' },
  transcriptBox: { border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px', height: '280px', overflowY: 'auto', backgroundColor: '#F8FAFC' },
  sectionTitle: { fontSize: '16px', margin: '0 0 12px 0', color: '#1E293B' },
  placeholderText: { color: '#94A3B8', fontSize: '14px', fontStyle: 'italic' },
  userBubble: { backgroundColor: '#E0F2FE', padding: '8px 12px', borderRadius: '8px', marginBottom: '8px', fontSize: '14px', color: '#0369A1' },
  agentBubble: { backgroundColor: '#ECFDF5', padding: '8px 12px', borderRadius: '8px', marginBottom: '8px', fontSize: '14px', color: '#047857' },
  ordersList: { display: 'flex', flexDirection: 'column', gap: '10px' },
  orderCard: { border: '1px solid #E2E8F0', padding: '10px 12px', borderRadius: '8px', backgroundColor: '#FAFAFA' },
  orderHeader: { display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#1E293B', marginBottom: '4px' },
  statusBadge: { color: '#FFF', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600' },
  orderDetails: { fontSize: '13px', color: '#475569' },
  orderNotes: { fontSize: '12px', color: '#64748B', fontStyle: 'italic', marginTop: '2px' },
  summaryBox: { marginTop: '20px', padding: '12px', backgroundColor: '#F1F5F9', borderRadius: '8px', border: '1px solid #CBD5E1' },
  jsonText: { fontSize: '12px', color: '#0F172A', margin: 0, overflowX: 'auto' }
};