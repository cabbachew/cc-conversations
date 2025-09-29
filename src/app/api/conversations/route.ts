import { PrismaClient } from "../../../generated/prisma/";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const conversations = await prisma.conversations.findMany({
      select: {
        uuid: true,
        userUuids: true,
        createdAt: true,
        updatedAt: true,
        cometConversationId: true,
        cometConversationType: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    // Fetch user details for all user UUIDs in conversations
    const allUserUuids = Array.from(
      new Set(conversations.flatMap(conv => conv.userUuids))
    );

    const users = await prisma.users.findMany({
      where: {
        uuid: {
          in: allUserUuids
        }
      },
      select: {
        uuid: true,
        firstName: true,
        lastName: true,
        fullName: true,
        roles: true,
        email: true
      }
    });

    // Extract engagement UUIDs from group conversations
    const groupEngagementUuids = conversations
      .filter(conv => conv.cometConversationType === 'group')
      .map(conv => {
        const match = conv.cometConversationId.match(/group_group-(.+)/);
        return match ? match[1] : null;
      })
      .filter(Boolean);

    // Extract user pairs from user conversations
    const userConversationPairs = conversations
      .filter(conv => conv.cometConversationType === 'user')
      .map(conv => {
        const match = conv.cometConversationId.match(/([0-9a-f-]{36})_user_([0-9a-f-]{36})/);
        return match ? { conversationUuid: conv.uuid, userUuid1: match[1], userUuid2: match[2] } : null;
      })
      .filter(Boolean);

    // Get all unique user UUIDs from user conversations for efficient lookup
    const userConversationUserUuids = Array.from(
      new Set(userConversationPairs.flatMap(pair => [pair.userUuid1, pair.userUuid2]))
    );

    // Fetch engagement details for group conversations
    const groupEngagements = await prisma.engagements.findMany({
      where: {
        uuid: {
          in: groupEngagementUuids
        }
      },
      select: {
        uuid: true,
        title: true
      }
    });

    // Fetch engagement relationships for user conversations
    const userEngagementsData = await prisma.engagements.findMany({
      where: {
        users_engagements: {
          some: {
            userUuid: {
              in: userConversationUserUuids
            }
          }
        }
      },
      select: {
        uuid: true,
        title: true,
        users_engagements: {
          select: {
            userUuid: true,
            users: {
              select: {
                uuid: true,
                roles: true,
                guardian_students_guardian_students_guardianUuidTousers: {
                  select: {
                    studentUuid: true
                  }
                },
                guardian_students_guardian_students_studentUuidTousers: {
                  select: {
                    guardianUuid: true
                  }
                }
              }
            }
          }
        }
      }
    });

    // Create efficient lookup structures
    const userEngagementLookup = new Map();

    userEngagementsData.forEach(engagement => {
      const mentors = [];
      const students = [];
      const guardians = new Set();

      engagement.users_engagements.forEach(ue => {
        const user = ue.users;
        if (user.roles.includes('mentor')) {
          mentors.push(user.uuid);
        }
        if (user.roles.includes('student')) {
          students.push(user.uuid);
          // Add guardians of this student
          user.guardian_students_guardian_students_studentUuidTousers.forEach(gs => {
            guardians.add(gs.guardianUuid);
          });
        }
        if (user.roles.includes('guardian')) {
          guardians.add(user.uuid);
        }
      });

      // For each combination of users in this engagement, create lookup entries
      const allParticipants = [...mentors, ...students, ...Array.from(guardians)];

      for (let i = 0; i < allParticipants.length; i++) {
        for (let j = i + 1; j < allParticipants.length; j++) {
          const key1 = `${allParticipants[i]}_${allParticipants[j]}`;
          const key2 = `${allParticipants[j]}_${allParticipants[i]}`;

          if (!userEngagementLookup.has(key1)) {
            userEngagementLookup.set(key1, []);
          }
          if (!userEngagementLookup.has(key2)) {
            userEngagementLookup.set(key2, []);
          }

          userEngagementLookup.get(key1).push({
            uuid: engagement.uuid,
            title: engagement.title
          });
          userEngagementLookup.get(key2).push({
            uuid: engagement.uuid,
            title: engagement.title
          });
        }
      }
    });

    // Create maps for quick lookups
    const userMap = new Map(users.map(user => [user.uuid, user]));
    const groupEngagementMap = new Map(groupEngagements.map(eng => [eng.uuid, eng]));

    // Add user details and engagement info to conversations
    const conversationsWithDetails = conversations.map(conversation => {
      let engagementUuid = null;
      let engagement = null;
      let engagements = null;

      if (conversation.cometConversationType === 'group') {
        const match = conversation.cometConversationId.match(/group_group-(.+)/);
        if (match) {
          engagementUuid = match[1];
          engagement = groupEngagementMap.get(engagementUuid) || null;
        }
      } else if (conversation.cometConversationType === 'user') {
        const match = conversation.cometConversationId.match(/([0-9a-f-]{36})_user_([0-9a-f-]{36})/);
        if (match) {
          const userUuid1 = match[1];
          const userUuid2 = match[2];
          const lookupKey = `${userUuid1}_${userUuid2}`;
          engagements = userEngagementLookup.get(lookupKey) || [];

          // If there's exactly one engagement, use it as the primary engagement
          if (engagements.length === 1) {
            engagement = engagements[0];
            engagementUuid = engagement.uuid;
          } else if (engagements.length > 1) {
            // If multiple engagements, we'll show all of them
            engagement = null;
            engagementUuid = null;
          }
        }
      }

      return {
        ...conversation,
        engagementUuid,
        engagement,
        engagements: engagements || [],
        users: conversation.userUuids.map(uuid => ({
          uuid,
          details: userMap.get(uuid) || null
        }))
      };
    });

    return NextResponse.json(conversationsWithDetails);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}