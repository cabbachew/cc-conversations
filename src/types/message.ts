export type Message = {
  uuid: string;
  senderUuid: string;
  text: string | null;
  createdAt: string;
  updatedAt: string;
  cometMessageType: string;
  mediaMimeType: string | null;
  mediaName: string | null;
  mediaUrl: string | null;
  reactions: string[];
  reactedBy: string[];
  readBy: string[];
  readByAll: boolean;
  sender: {
    uuid: string;
    firstName: string;
    lastName: string;
    fullName: string;
    roles: string[];
    email: string;
    profilePictureUrl: string | null;
  } | null;
};