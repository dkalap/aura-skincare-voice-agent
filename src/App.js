import React, { useState, useEffect } from 'react';
import Vapi from '@vapi-ai/web';


const VAPI_PUBLIC_KEY = '23b51064-4037-48ff-8f83-7ed5f460d595';
const ASSISTANT_ID = 'c93f7d14-0183-4e7a-b278-5956dbba4076';

const vapi = new Vapi(VAPI_PUBLIC_KEY);

// Expanded Mock Database
const INITIAL_ORDERS = {
  'ORD-101': {
    customer: 'Priya Sharma',
    product: 'Vitamin C Serum (30ml)',
    value: '₹699',
    status: 'Out for Delivery',
    notes: 'BlueDart — BD-982103. Expected by 6 PM today.'
  },
  'ORD-102': {
    customer: 'Rahul Verma',
    product: 'Hydrating Sunscreen SPF 50',
    value: '₹499',
    status: 'Delivered',
    notes: 'Delivered 14 days ago. Return window closed.'
  },
  'ORD-103': {
    customer: 'Ananya Patel',
    product: 'Green Tea Face Wash + Toner',
    value: '₹850',
    status: 'Processing',
    notes: 'Ordered 3 hours ago. Eligible for instant cancellation.'
  }
};

export default function App() {
  const [orders, setOrders] = useState(INITIAL_ORDERS);
  const [callStatus, setCallStatus] = useState('Idle'); // Idle, Active, Speaking, Thinking
  const [transcripts, setTranscripts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    vapi.on('call-start', () => setCallStatus('Active'));
    vapi.on('call-end', () => {
      setCallStatus('Idle');
      generateCallSummary();
    });

    vapi.on('speech-start', () => setCallStatus('Speaking'));
    vapi.on('speech-end', () => setCallStatus('Active'));

    vapi.on('message', (message) => {
      if (message.type === 'transcript') {
        setTranscripts((prev) => [
          ...prev,
          { role: message.role, text: message.transcript }
        ]);
      }

      // Handle Multiple Function Calls
      if (message.type === 'tool-calls') {
        setCallStatus('Thinking');
        for (const call of message.toolWithToolCallList) {
          const fnName = call.toolCall.function.name;
          const args = JSON.parse(call.toolCall.function.arguments || '{}');

          let resultText = '';

          if (fnName === 'get_order_details') {
            const order = orders[args.order_id];
            resultText = order ? JSON.stringify(order) : `Order ${args.order_id} not found.`;
          } else if (fnName === 'cancel_order') {
            const order = orders[args.order_id];
            if (!order) {
              resultText = `Order ${args.order_id} not found.`;
            } else if (order.status === 'Processing') {
              setOrders((prev) => ({
                ...prev,
                [args.order_id]: { ...prev[args.order_id], status: 'Cancelled' }
              }));
              resultText = `Order ${args.order_id} successfully cancelled. Refund initiated to original payment method.`;
            } else {
              resultText = `Cannot cancel order ${args.order_id}. Current status is '${order.status}'. Cancellations are only allowed when status is 'Processing'.`;
            }
          }

          vapi.send({
            type: 'tool-call-result',
            toolCallId: call.toolCall.id,
            result: resultText
          });
        }
      }
    });

    return () => vapi.removeAllListeners();
  }, [orders, transcripts]);

  const generateCallSummary = () => {
    const fullText = transcripts.map((t) => t.text).join(' ');
    const foundOrder = fullText.match(/ORD-\d+/i)?.[0]?.toUpperCase() || 'N/A';
    
    setSummary({
      customer_intent: fullText.toLowerCase().includes('cancel') ? 'ORDER_CANCELLATION' : 'ORDER_STATUS_ENQUIRY',
      order_id: foundOrder,
      resolution_status: transcripts.length > 2 ? 'RESOLVED' : 'INCOMPLETE',
      call_summary: transcripts.length > 0
        ? `Interaction complete regarding ${foundOrder}. Voice agent processed user queries in real-time.`
        : 'Call disconnected before interaction.'
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
        {/* Left Column: Voice Controls & Transcripts */}
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
              <p style={styles.placeholderText}>Click 'Start Support Call' and ask about your order or brand policies...</p>
            )}
            {transcripts.map((t, index) => (
              <div key={index} style={t.role === 'user' ? styles.userBubble : styles.agentBubble}>
                <strong>{t.role === 'user' ? 'Customer' : 'Aria'}:</strong> {t.text}
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Database Helper & Summary */}
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>📦 Customer Orders Database</h3>
          <div style={styles.ordersList}>
            {Object.entries(orders).map(([id, details]) => (
              <div key={id} style={styles.orderCard}>
                <div style={styles.orderHeader}>
                  <strong>{id}</strong> — {details.customer}
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

// Helpers
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

// Styles object for quick, clean inline styling
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