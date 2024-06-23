import { database } from "../mod.ts";

interface DatabaseTicket {
  ticket_id: string;
  channel_id: string;
  creator: string;
}

export async function insert(
  ticket_id: string,
  channel_id: string,
  creator: string
): Promise<void> {
  database.execute(`
      INSERT OR IGNORE INTO tickets (ticket_id, channel_id, creator)
      VALUES ('${ticket_id}', '${channel_id}', '${creator}');
  `);
}

export async function get(channel_id: string): Promise<DatabaseTicket> {
  const ticket = database.query(
    `SELECT channel_id, ticket_id, creator FROM tickets WHERE channel_id = '${channel_id}'`,
  );

  if (ticket.length > 0) {
    return {
      ticket_id: ticket[0][1] as string,
      channel_id: ticket[0][0] as string,
      creator: ticket[0][2] as string,
    };
  }

  return { ticket_id: "", channel_id: "", creator: "" };
}

export function remove(channel_id: string): void {
  database.execute(
    `DELETE FROM tickets WHERE channel_id = '${channel_id}'`,
  );
}

export async function insertMessage(message_id: string, pulsar_id: string): Promise<void> {
  database.execute(`
      INSERT INTO messages (message_id, pulsar_id)
      VALUES ('${message_id}', '${pulsar_id}');
  `);
}

export async function getMessagePulsarId(message_id: string): Promise<string> {
  const message = database.query(
    `SELECT pulsar_id FROM messages WHERE message_id = '${message_id}'`,
  );

  if (message.length > 0) {
    return message[0][0] as string;
  }

  return "";
}

export async function setUserCache(discord_id: string, pulsar_id: string): Promise<void> {
  database.execute(`
      INSERT OR REPLACE INTO user_cache (discord_id, pulsar_id)
      VALUES ('${discord_id}', '${pulsar_id}');
  `);
}

export async function getUserPulsarId(discord_id: string): Promise<string> {
  const user = database.query(
    `SELECT pulsar_id FROM user_cache WHERE discord_id = '${discord_id}'`,
  );

  if (user.length > 0) {
    return user[0][0] as string;
  }

  return "";
}