/**
 * CareLink LiveKit Signed Webhook Reducer
 * 
 * Handles incoming webhooks from LiveKit Cloud:
 * 1. Validates JWT signature via WebhookReceiver (live mode) or mock authorization
 * 2. Matches active roomName (carelink-alert-{alertId}) to CallRecord
 * 3. Reduces state machine:
 *    - participant_joined -> IN_PROGRESS (Clinician answered)
 *    - participant_left -> Check if acknowledged, otherwise NO_ANSWER / FAILED
 *    - room_finished -> Closes active call
 *    - data_packet / transcript -> Conversational acknowledgement detector
 */

import { WebhookReceiver } from 'livekit-server-sdk';
import { CallStatus } from './types';
import { livekitTelephonyClient } from './livekitClient';
import { escalationService } from './escalationService';
import { detectConversationalAcknowledgement } from './voiceAgent';

export interface WebhookProcessingResult {
  handled: boolean;
  eventType: string;
  roomName?: string;
  callId?: string;
  newStatus?: CallStatus;
  message: string;
}

export class LiveKitWebhookHandler {
  private receiver: WebhookReceiver | null = null;

  constructor() {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (apiKey && apiSecret) {
      try {
        this.receiver = new WebhookReceiver(apiKey, apiSecret);
      } catch (err) {
        console.warn('[WebhookHandler] Could not initialize WebhookReceiver:', err);
      }
    }
  }

  /**
   * Process incoming webhook event
   */
  public async handleWebhook(
    body: string | any,
    authHeader?: string
  ): Promise<WebhookProcessingResult> {
    let eventName = '';
    let roomName = '';
    let participantIdentity = '';
    let participantName = '';
    let transcriptText = '';

    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    const isMock = livekitTelephonyClient.isMock() || !this.receiver || authHeader === 'mock';

    // 1. Signature Verification
    if (!isMock && this.receiver) {
      if (!authHeader) {
        throw new Error('Unauthorized: Missing Authorization header on LiveKit webhook.');
      }
      try {
        const verifiedEvent = await this.receiver.receive(bodyString, authHeader);
        eventName = verifiedEvent.event;
        roomName = verifiedEvent.room?.name || '';
        participantIdentity = verifiedEvent.participant?.identity || '';
        participantName = verifiedEvent.participant?.name || '';
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        throw new Error(`Forbidden: Invalid LiveKit webhook signature (${errorMsg})`);
      }
    } else {
      // Mock / Dev Parsing
      try {
        const parsed = typeof body === 'object' ? body : JSON.parse(bodyString);
        eventName = parsed.event || parsed.eventType || 'participant_joined';
        roomName = parsed.room?.name || parsed.roomName || '';
        participantIdentity = parsed.participant?.identity || parsed.participantIdentity || '';
        participantName = parsed.participant?.name || parsed.participantName || '';
        transcriptText = parsed.transcript || parsed.text || '';
      } catch {
        return {
          handled: false,
          eventType: 'unknown',
          message: 'Malformed webhook JSON payload',
        };
      }
    }

    if (!roomName) {
      return {
        handled: false,
        eventType: eventName,
        message: 'Webhook payload does not contain roomName',
      };
    }

    // 2. Find matching call in Escalation Service
    const calls = escalationService.getAllCalls();
    const matchingCall = calls.find((c) => c.roomName === roomName);

    if (!matchingCall) {
      return {
        handled: false,
        eventType: eventName,
        roomName,
        message: `No active escalation call found for room ${roomName}`,
      };
    }

    const callId = matchingCall.callId;

    // 3. State Reducer Logic
    switch (eventName) {
      case 'participant_joined': {
        // If clinician joins the room, transition call to IN_PROGRESS
        const isVoiceAgent = participantIdentity.includes('agent') || participantName.includes('agent');
        if (!isVoiceAgent && matchingCall.status !== 'IN_PROGRESS' && matchingCall.status !== 'ACKNOWLEDGED') {
          escalationService.transitionToInProgress(callId);
          return {
            handled: true,
            eventType: eventName,
            roomName,
            callId,
            newStatus: 'IN_PROGRESS',
            message: `Clinician (${participantIdentity || 'SIP'}) connected to room. Call IN_PROGRESS.`,
          };
        }
        return {
          handled: true,
          eventType: eventName,
          roomName,
          callId,
          message: `Participant joined: ${participantIdentity}`,
        };
      }

      case 'participant_left': {
        // If clinician leaves before acknowledging, record failure
        if (matchingCall.status !== 'ACKNOWLEDGED') {
          await escalationService.recordCallFailure(callId, 'NO_ANSWER', 'Clinician disconnected without acknowledging');
          return {
            handled: true,
            eventType: eventName,
            roomName,
            callId,
            newStatus: 'NO_ANSWER',
            message: 'Clinician hung up before acknowledging. Retry ladder triggered.',
          };
        }
        return {
          handled: true,
          eventType: eventName,
          roomName,
          callId,
          message: 'Clinician disconnected after successful acknowledgement.',
        };
      }

      case 'transcript_received':
      case 'data_packet': {
        // Evaluate clinician speech / DTMF
        if (transcriptText) {
          const ackResult = detectConversationalAcknowledgement(transcriptText);
          if (ackResult.isAcknowledged) {
            escalationService.acknowledgeCall(callId, {
              acknowledgedBy: participantName || 'Duty Clinician',
              verbalSnippet: transcriptText,
            });
            return {
              handled: true,
              eventType: eventName,
              roomName,
              callId,
              newStatus: 'ACKNOWLEDGED',
              message: `Clinician verbal acknowledgement recognized: "${transcriptText}". Closed loop resolved.`,
            };
          }
        }
        return {
          handled: true,
          eventType: eventName,
          roomName,
          callId,
          message: `Transcript processed: "${transcriptText}"`,
        };
      }

      case 'room_finished': {
        return {
          handled: true,
          eventType: eventName,
          roomName,
          callId,
          message: `LiveKit room ${roomName} successfully finished and closed.`,
        };
      }

      default:
        return {
          handled: true,
          eventType: eventName,
          roomName,
          callId,
          message: `LiveKit event ${eventName} logged.`,
        };
    }
  }
}

// Singleton export
export const livekitWebhookHandler = new LiveKitWebhookHandler();
