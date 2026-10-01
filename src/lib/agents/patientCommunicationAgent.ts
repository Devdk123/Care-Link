/**
 * CareLink Autonomous Patient Communication Agent (TypeScript)
 * Generates structured, bilingual WhatsApp / SMS post-discharge instructions and medication reminders.
 * Produces instant click-to-dispatch wa.me deep links for ASHA workers and hospital staff.
 */

export interface WhatsAppMessagePayload {
  recipientName: string;
  recipientPhone: string;
  language: "en" | "hi";
  messageText: string;
  whatsappDeepLink: string;
  sections: {
    greeting: string;
    medicationsSchedule: string[];
    followUpDate: string;
    lifestyleAlert: string;
    redFlagSigns: string[];
    emergencyContact: string;
  };
  generatedAt: string;
}

export interface PatientCommunicationInput {
  patientName: string;
  patientPhone?: string;
  diagnosis?: string;
  medications?: string[];
  followUpDate?: string;
  redFlags?: string[];
  isHindi?: boolean;
}

/**
 * Autonomously formats post-discharge instructions into a bilingual WhatsApp notification
 */
export function generatePatientWhatsAppMessage(
  input: PatientCommunicationInput
): WhatsAppMessagePayload {
  const isHindi = Boolean(input.isHindi);
  const name = input.patientName || "Patient";
  const phone = (input.patientPhone || "+919876543210").replace(/[^0-9]/g, "");
  const meds = input.medications && input.medications.length > 0
    ? input.medications
    : ["Furosemide 40mg (Morning, after breakfast)", "Enalapril 10mg (Night)"];
  const followUp = input.followUpDate || "7 to 10 days at Cardiology OPD";
  const redFlags = input.redFlags && input.redFlags.length > 0
    ? input.redFlags
    : isHindi
    ? ["अचानक सांस फूलना या लेटने में तकलीफ होना", "2 दिन में 2 किलो से अधिक वज़न बढ़ना", "पैरों या टखनों में नई सूजन आना"]
    : ["Sudden worsening shortness of breath or difficulty lying flat", "Weight gain of >2 kg in 48 hours", "New swelling in legs, feet, or abdomen"];

  if (isHindi) {
    const greeting = `नमस्ते ${name} जी! 🙏 यह केयरलिंक (CareLink) अस्पताल से आपकी छुट्टी के बाद का स्वास्थ्य निर्देश संदेश है।`;
    const medHeader = `💊 **आपकी दैनिक दवाइयां:**\n` + meds.map((m, idx) => `  ${idx + 1}. ${m}`).join("\n");
    const followUpText = `📅 **डॉक्टर से अगली मुलाकात:**\n  ${followUp}`;
    const redFlagHeader = `🚨 **आपातकालीन खतरे के संकेत (दिखने पर तुरंत अस्पताल आएं):**\n` + redFlags.map((r) => `  ⚠️ ${r}`).join("\n");
    const emergencyContact = `📞 **अस्पताल 24x7 इमरजेंसी नंबर:** 1800-111-565 / 108`;
    const ashaNote = `👩‍⚕️ आशा दीदी आपके घर आकर नियमित रक्तचाप और वज़न की जाँच करेंगी।`;

    const fullMessage = `${greeting}\n\n${medHeader}\n\n${followUpText}\n\n${redFlagHeader}\n\n${emergencyContact}\n${ashaNote}\n\nस्वस्थ रहें, अपना ख्याल रखें! ❤️`;

    return {
      recipientName: name,
      recipientPhone: phone,
      language: "hi",
      messageText: fullMessage,
      whatsappDeepLink: `https://wa.me/${phone}?text=${encodeURIComponent(fullMessage)}`,
      sections: {
        greeting,
        medicationsSchedule: meds,
        followUpDate: followUp,
        lifestyleAlert: "नमक कम खाएं (दिन में 1 चम्मच से कम) और रोज़ाना सुबह खाली पेट वज़न मापें।",
        redFlagSigns: redFlags,
        emergencyContact
      },
      generatedAt: new Date().toISOString()
    };
  }

  // English default
  const greeting = `Hello ${name}! 👋 This is your personalized post-discharge care update from CareLink Clinical Services.`;
  const medHeader = `💊 **Your Daily Medication Schedule:**\n` + meds.map((m, idx) => `  ${idx + 1}. ${m}`).join("\n");
  const followUpText = `📅 **Mandatory Doctor Follow-Up:**\n  ${followUp}`;
  const redFlagHeader = `🚨 **Emergency Red Flags (Return to Hospital Immediately if present):**\n` + redFlags.map((r) => `  ⚠️ ${r}`).join("\n");
  const emergencyContact = `📞 **Hospital Emergency 24x7 Helpline:** 1800-111-565 / 108`;

  const fullMessage = `${greeting}\n\n${medHeader}\n\n${followUpText}\n\n${redFlagHeader}\n\n${emergencyContact}\n\nWishing you a rapid and complete recovery! ❤️`;

  return {
    recipientName: name,
    recipientPhone: phone,
    language: "en",
    messageText: fullMessage,
    whatsappDeepLink: `https://wa.me/${phone}?text=${encodeURIComponent(fullMessage)}`,
    sections: {
      greeting,
      medicationsSchedule: meds,
      followUpDate: followUp,
      lifestyleAlert: "Restrict dietary sodium to <2.0g/day and monitor body weight daily upon waking.",
      redFlagSigns: redFlags,
      emergencyContact
    },
    generatedAt: new Date().toISOString()
  };
}

/**
 * Simulated WhatsApp Dispatch Service
 */
export async function sendWhatsAppNotification(
  payload: WhatsAppMessagePayload
): Promise<{ status: "DISPATCHED" | "QUEUED"; messageId: string; timestamp: string }> {
  // In production, connects to Twilio / WhatsApp Cloud Business API
  return {
    status: "DISPATCHED",
    messageId: `wa_msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString()
  };
}
