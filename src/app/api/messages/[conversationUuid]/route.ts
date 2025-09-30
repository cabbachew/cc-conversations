import { PrismaClient } from "../../../../generated/prisma/";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationUuid: string }> }
) {
  try {
    const { conversationUuid } = await params;

    if (!conversationUuid) {
      return NextResponse.json({ error: 'Conversation UUID is required' }, { status: 400 });
    }

    // Fetch messages with sender details
    const messages = await prisma.messages.findMany({
      where: {
        conversationUuid: conversationUuid,
        deletedAt: null
      },
      select: {
        uuid: true,
        senderUuid: true,
        text: true,
        createdAt: true,
        updatedAt: true,
        cometMessageType: true,
        mediaMimeType: true,
        mediaName: true,
        mediaUrl: true,
        reactions: true,
        reactedBy: true,
        readBy: true,\n        readByAll: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Get unique sender UUIDs
    const senderUuids = Array.from(new Set(messages.map(msg => msg.senderUuid)));

    // Fetch sender details
    const senders = await prisma.users.findMany({
      where: {
        uuid: {
          in: senderUuids
        }
      },
      select: {
        uuid: true,
        firstName: true,
        lastName: true,
        fullName: true,
        roles: true,
        email: true,
        profilePictureUrl: true
      }
    });

    // Create sender lookup map
    const senderMap = new Map(senders.map(sender => [sender.uuid, sender]));

    // Combine messages with sender details
    const messagesWithSenders = messages.map(message => ({
      ...message,
      sender: senderMap.get(message.senderUuid) || null
    }));

    return NextResponse.json({
      messages: messagesWithSenders,
      totalCount: messages.length
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}