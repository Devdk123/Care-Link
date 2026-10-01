/**
 * CareLink LiveKit Telephony Client Adapter
 * 
 * Manages LiveKit Room dispatch, SIP participant outbound dialing,
 * and deterministic mock fallbacks for hackathons, testing, and offline modes.
 */

import {
  AgentDispatchClient,
  SipClient,
  RoomServiceClient,
  AccessToken,
  WebhookReceiver,
} from 'livekit-server-sdk';
import dotenv from 'dotenv';
import {
  CallStatus,
  VoiceEscalationMetadata,
  CriticalAlertPayload,
  sanitizeAlertForVoice,
} from './types';

// Ensure environment variables are loaded
dotenv.config();

export interface LiveKitClientConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
  sipTrunkId: string;
  sipUri: string;
  agentName: string;
  telephonyMode: 'live' | 'mock';
  primaryContact: string;
  secondaryContact: string;
  maxAttempts: number;
  cooldownSec: number;
  ringTimeoutSec: number;
}

export interface DispatchResult {
  dispatchId: string;
  roomName: string;
  agentName: string;
  isMock: boolean;
  metadata: VoiceEscalationMetadata;
  createdAt: string;
}

export interface SipCallResult {
  participantId: string;
  destination: string;
  roomName: string;
  status: CallStatus;
  isMock: boolean;
  dialedAt: string;
}

export class LiveKitTelephonyClient {
  private config: LiveKitClientConfig;
  private roomClient: RoomServiceClient | null = null;
  private sipClient: SipClient | null = null;
  private agentDispatchClient: AgentDispatchClient | null = null;
  private webhookReceiver: WebhookReceiver | null = null;

  constructor(customConfig?: Partial<LiveKitClientConfig>) {
    const rawMode = process.env.TELEPHONY_MODE || 'mock';
    const isLiveRequested = rawMode.toLowerCase() === 'live';

    this.config = {
      url: customConfig?.url || process.env.LIVEKIT_URL || '',
      apiKey: customConfig?.apiKey || process.env.LIVEKIT_API_KEY || '',
      apiSecret: customConfig?.apiSecret || process.env.LIVEKIT_API_SECRET || '',
      sipTrunkId: customConfig?.sipTrunkId || process.env.LIVEKIT_SIP_TRUNK_ID || '',
      sipUri: customConfig?.sipUri || process.env.LIVEKIT_SIP_URI || 'sip:1izi1wnvi5b.sip.livekit.cloud',
      agentName: customConfig?.agentName || process.env.LIVEKIT_VOICE_AGENT_NAME || 'carelink-escalation-agent',
      telephonyMode: isLiveRequested ? 'live' : 'mock',
      primaryContact: customConfig?.primaryContact || process.env.TELEPHONY_PRIMARY_CONTACT || '+919876543210',
      secondaryContact: customConfig?.secondaryContact || process.env.TELEPHONY_SECONDARY_CONTACT || '+919876543211',
      maxAttempts: Number(process.env.TELEPHONY_MAX_ATTEMPTS) || 2,
      cooldownSec: Number(process.env.TELEPHONY_COOLDOWN_SEC) || 300,
      ringTimeoutSec: Number(process.env.TELEPHONY_RING_TIMEOUT_SEC) || 30,
    };

    // If live mode is configured and valid credentials exist, initialize official LiveKit SDK clients
    if (this.config.telephonyMode === 'live' && this.config.url && this.config.apiKey && this.config.apiSecret) {
      try {
        this.roomClient = new RoomServiceClient(this.config.url, this.config.apiKey, this.config.apiSecret);
        this.sipClient = new SipClient(this.config.url, this.config.apiKey, this.config.apiSecret);
        this.agentDispatchClient = new AgentDispatchClient(this.config.url, this.config.apiKey, this.config.apiSecret);
        this.webhookReceiver = new WebhookReceiver(this.config.apiKey, this.config.apiSecret);
      } catch (err) {
        console.warn('[LiveKitTelephonyClient] Failed to initialize live SDK clients, falling back to mock mode:', err);
        this.config.telephonyMode = 'mock';
      }
    } else {
      this.config.telephonyMode = 'mock';
    }
  }

  /**
   * Returns whether client is running in mock mode
   */
  public isMock(): boolean {
    return this.config.telephonyMode === 'mock';
  }

  /**
   * Get active client configuration summary (without exposing secrets)
   */
  public getConfigSummary() {
    return {
      telephonyMode: this.config.telephonyMode,
      hasLiveKitUrl: Boolean(this.config.url),
      hasApiKey: Boolean(this.config.apiKey),
      hasApiSecret: Boolean(this.config.apiSecret),
      hasSipTrunkId: Boolean(this.config.sipTrunkId),
      sipUri: this.config.sipUri,
      agentName: this.config.agentName,
      primaryContactMasked: this.config.primaryContact.slice(0, 3) + '****' + this.config.primaryContact.slice(-3),
      maxAttempts: this.config.maxAttempts,
      cooldownSec: this.config.cooldownSec,
      ringTimeoutSec: this.config.ringTimeoutSec,
    };
  }

  /**
   * Deterministic room naming according to CareLink Architecture: carelink-alert-{alertId}
   */
  public getDeterministicRoomName(alertId: string): string {
    const cleanId = alertId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `carelink-alert-${cleanId}`;
  }

  /**
   * Dispatch LiveKit Voice Agent into the target alert room
   */
  public async createOutboundEscalationDispatch(
    roomName: string,
    metadata: VoiceEscalationMetadata
  ): Promise<DispatchResult> {
    const createdAt = new Date().toISOString();

    if (this.isMock() || !this.agentDispatchClient) {
      // Deterministic mock dispatch
      const mockDispatchId = `disp_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return {
        dispatchId: mockDispatchId,
        roomName,
        agentName: this.config.agentName,
        isMock: true,
        metadata,
        createdAt,
      };
    }

    try {
      const dispatch = await this.agentDispatchClient.createDispatch(
        roomName,
        this.config.agentName,
        { metadata: JSON.stringify(metadata) }
      );

      return {
        dispatchId: dispatch.id,
        roomName,
        agentName: this.config.agentName,
        isMock: false,
        metadata,
        createdAt,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[LiveKitTelephonyClient] Failed to dispatch agent to ${roomName}:`, errorMessage);
      // Graceful fallback to mock dispatch if LiveKit Cloud is temporarily unreachable
      return {
        dispatchId: `disp_fallback_${Date.now()}`,
        roomName,
        agentName: this.config.agentName,
        isMock: true,
        metadata,
        createdAt,
      };
    }
  }

  /**
   * Dial Outbound SIP Participant to connect the Duty Clinician
   */
  public async createSipParticipantCall(
    destination: string,
    roomName: string,
    customTrunkId?: string,
    options?: { participantIdentity?: string; participantName?: string }
  ): Promise<SipCallResult> {
    const dialedAt = new Date().toISOString();
    const trunkId = customTrunkId || this.config.sipTrunkId;
    const participantIdentity = options?.participantIdentity || `sip-${Date.now()}`;
    const participantName = options?.participantName || 'Duty Clinician';

    if (this.isMock() || !this.sipClient || !trunkId) {
      // Deterministic mock SIP participant
      const mockParticipantId = `sip_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return {
        participantId: mockParticipantId,
        destination,
        roomName,
        status: 'RINGING',
        isMock: true,
        dialedAt,
      };
    }

    try {
      const participant = await this.sipClient.createSipParticipant(
        trunkId,
        destination,
        roomName,
        {
          participantIdentity,
          participantName,
        }
      );

      return {
        participantId: participant.participantId || participant.participantIdentity || participantIdentity,
        destination,
        roomName,
        status: 'RINGING',
        isMock: false,
        dialedAt,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[LiveKitTelephonyClient] SIP outbound dialing failed for ${destination}:`, errorMessage);
      return {
        participantId: `sip_fallback_${Date.now()}`,
        destination,
        roomName,
        status: 'FAILED',
        isMock: true,
        dialedAt,
      };
    }
  }

  /**
   * Generate an AccessToken for web-based clinician listening / Cockpit audio monitor
   */
  public async generateRoomToken(
    roomName: string,
    participantIdentity: string,
    participantName: string = 'CareLink Dashboard Monitor'
  ): Promise<string> {
    if (!this.config.apiKey || !this.config.apiSecret) {
      // Mock JWT token structure for dev / tests
      const mockHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const mockPayload = Buffer.from(
        JSON.stringify({
          sub: participantIdentity,
          name: participantName,
          video: { room: roomName, roomJoin: true },
          exp: Math.floor(Date.now() / 1000) + 3600,
          mock: true,
        })
      ).toString('base64url');
      return `${mockHeader}.${mockPayload}.mock_signature`;
    }

    const token = new AccessToken(this.config.apiKey, this.config.apiSecret, {
      identity: participantIdentity,
      name: participantName,
    });

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: false,
      canSubscribe: true,
    });

    return await token.toJwt();
  }

  /**
   * Validate incoming LiveKit webhook event
   */
  public async validateWebhook(body: string, authHeader: string) {
    if (this.isMock() || !this.webhookReceiver) {
      try {
        return JSON.parse(body);
      } catch {
        return { event: 'mock_webhook_received' };
      }
    }

    return await this.webhookReceiver.receive(body, authHeader);
  }

  /**
   * Delete room once call is completed or cancelled
   */
  public async deleteRoom(roomName: string): Promise<void> {
    if (this.isMock() || !this.roomClient) {
      return;
    }
    try {
      await this.roomClient.deleteRoom(roomName);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.warn(`[LiveKitTelephonyClient] Failed to delete room ${roomName}:`, errorMessage);
    }
  }

  /**
   * Simulates full call lifecycle progression with state transition callbacks
   * Used for automated test suites, hackathon demos, and mock escalation verification.
   */
  public async simulateMockCallLifecycle(
    alertPayload: CriticalAlertPayload,
    options?: {
      autoAck?: boolean;
      transitionDelayMs?: number;
      onStatusChange?: (status: CallStatus, message: string) => void;
    }
  ): Promise<{
    finalStatus: CallStatus;
    totalDurationMs: number;
    verbalAck: string;
    roomName: string;
    dispatchResult: DispatchResult;
    sipResult: SipCallResult;
  }> {
    const startTime = Date.now();
    const delay = options?.transitionDelayMs ?? 40;
    const autoAck = options?.autoAck ?? true;
    const roomName = this.getDeterministicRoomName(alertPayload.alertId);
    const metadata = sanitizeAlertForVoice(alertPayload);

    // 1. QUEUED
    options?.onStatusChange?.('QUEUED', `Call queued for ${alertPayload.primaryContact} (Ward ${metadata.ward}, Bed ${metadata.bed})`);
    await new Promise((r) => setTimeout(r, delay));

    // 2. INITIATED - Dispatch agent first
    const dispatchResult = await this.createOutboundEscalationDispatch(roomName, metadata);
    options?.onStatusChange?.('INITIATED', `Agent ${dispatchResult.agentName} dispatched to room ${roomName}`);
    await new Promise((r) => setTimeout(r, delay));

    // 3. RINGING - Dial SIP trunk
    const sipResult = await this.createSipParticipantCall(alertPayload.primaryContact, roomName);
    options?.onStatusChange?.('RINGING', `Outbound SIP ringing destination ${alertPayload.primaryContact}`);
    await new Promise((r) => setTimeout(r, delay));

    // 4. IN_PROGRESS - Clinician answers
    options?.onStatusChange?.('IN_PROGRESS', `Clinician answered call. Agent delivering concise clinical briefing.`);
    await new Promise((r) => setTimeout(r, delay));

    let finalStatus: CallStatus = 'ACKNOWLEDGED';
    let verbalAck = '';

    if (autoAck) {
      finalStatus = 'ACKNOWLEDGED';
      verbalAck = `Dr. Sharma acknowledged: "Understood, SpO2 ${metadata.spo2}% critical hypoxia at ${metadata.ward} ${metadata.bed}. Starting 100% non-rebreather mask and order STAT arterial blood gas."`;
      options?.onStatusChange?.('ACKNOWLEDGED', verbalAck);
    } else {
      finalStatus = 'NO_ANSWER';
      options?.onStatusChange?.('NO_ANSWER', `Call timed out after ${this.config.ringTimeoutSec}s without clinician pickup.`);
    }

    const totalDurationMs = Date.now() - startTime;

    return {
      finalStatus,
      totalDurationMs,
      verbalAck,
      roomName,
      dispatchResult,
      sipResult,
    };
  }
}

// Singleton export
export const livekitTelephonyClient = new LiveKitTelephonyClient();
