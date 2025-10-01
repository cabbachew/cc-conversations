import { PrismaClient } from "../../../../generated/prisma/";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Get all conversations
    const conversations = await prisma.conversations.findMany({
      select: {
        uuid: true,
      },
    });

    // Batch fetch all latest messages in a single query using a subquery approach
    // Get all messages grouped by conversation
    const allMessages = await prisma.messages.findMany({
      where: {
        conversationUuid: {
          in: conversations.map(c => c.uuid),
        },
        deletedAt: null,
      },
      select: {
        uuid: true,
        conversationUuid: true,
        senderUuid: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Group messages by conversation and get the latest one
    const latestByConversation = new Map<string, typeof allMessages[0]>();
    for (const message of allMessages) {
      if (!latestByConversation.has(message.conversationUuid)) {
        latestByConversation.set(message.conversationUuid, message);
      }
    }

    // Get all unique sender UUIDs
    const senderUuids = Array.from(new Set(
      Array.from(latestByConversation.values()).map(m => m.senderUuid)
    ));

    // Batch fetch all senders
    const senders = await prisma.users.findMany({
      where: {
        uuid: {
          in: senderUuids,
        },
      },
      select: {
        uuid: true,
        roles: true,
      },
    });

    // Create sender lookup map
    const senderMap = new Map(senders.map(s => [s.uuid, s]));

    // Build response
    const conversationLatestMessages = [];
    for (const [conversationUuid, latestMessage] of latestByConversation.entries()) {
      conversationLatestMessages.push({
        conversationUuid,
        latestMessage: {
          uuid: latestMessage.uuid,
          senderUuid: latestMessage.senderUuid,
          createdAt: latestMessage.createdAt,
          sender: senderMap.get(latestMessage.senderUuid) || null,
        },
      });
    }

    return NextResponse.json(conversationLatestMessages);
  } catch (error) {
    console.error('Error fetching latest messages:', error);
    return NextResponse.json({ error: 'Failed to fetch latest messages' }, { status: 500 });
  }
}
