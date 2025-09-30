import { Message } from '../types/message';

export interface ResponseTime {
  responseTimeMs: number;
  mentorMessage: Message;
  precedingNonMentorMessage: Message;
}

/**
 * Calculates the average response time for mentors in a conversation.
 * Only considers mentor messages that have a preceding non-mentor message.
 *
 * @param messages - Array of messages sorted by createdAt (ascending)
 * @returns Object with average response time in HH:MM format and raw milliseconds, or null if no valid responses
 */
export function calculateMentorAverageResponseTime(messages: Message[]): {
  averageTimeFormatted: string;
  averageTimeMs: number;
  responseCount: number;
  responseTimes: ResponseTime[];
} | null {
  if (!messages || messages.length === 0) {
    return null;
  }

  const responseTimes: ResponseTime[] = [];

  for (let i = 1; i < messages.length; i++) {
    const currentMessage = messages[i];
    const isMentorMessage = currentMessage.sender?.roles.includes('mentor') || false;

    if (isMentorMessage) {
      // Look backwards for the most recent non-mentor message
      let precedingNonMentorMessage: Message | null = null;

      for (let j = i - 1; j >= 0; j--) {
        const prevMessage = messages[j];
        const isPrevMentor = prevMessage.sender?.roles.includes('mentor') || false;

        if (!isPrevMentor) {
          precedingNonMentorMessage = prevMessage;
          break;
        }
      }

      // If we found a preceding non-mentor message, calculate response time
      if (precedingNonMentorMessage) {
        const mentorTime = new Date(currentMessage.createdAt).getTime();
        const nonMentorTime = new Date(precedingNonMentorMessage.createdAt).getTime();
        const responseTimeMs = mentorTime - nonMentorTime;

        // Only include positive response times (mentor responded after non-mentor)
        if (responseTimeMs > 0) {
          responseTimes.push({
            responseTimeMs,
            mentorMessage: currentMessage,
            precedingNonMentorMessage
          });
        }
      }
    }
  }

  if (responseTimes.length === 0) {
    return null;
  }

  // Calculate average response time
  const totalResponseTime = responseTimes.reduce((sum, rt) => sum + rt.responseTimeMs, 0);
  const averageTimeMs = totalResponseTime / responseTimes.length;

  // Format as HH:MM
  const hours = Math.floor(averageTimeMs / (1000 * 60 * 60));
  const minutes = Math.floor((averageTimeMs % (1000 * 60 * 60)) / (1000 * 60));
  const averageTimeFormatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

  return {
    averageTimeFormatted,
    averageTimeMs,
    responseCount: responseTimes.length,
    responseTimes
  };
}

/**
 * Helper function to format milliseconds to HH:MM format
 */
export function formatMsToHHMM(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}