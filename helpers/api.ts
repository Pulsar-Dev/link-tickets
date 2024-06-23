const urlBase = Deno.env.get("API_URL");

interface APIResponse {
  data?: Response;
  error?: Error;
}

enum TicketStatus {
  OPEN = "OPEN",
  HOLD = "HOLD",
  CLOSED = "CLOSED",
}

export interface APITicket {
  id: string;
  user: string;
  addon: string;
  status: TicketStatus;
}

export interface APITicketStatus {
  status?: string;
  success?: boolean;
  error?: string;
}

export interface APIMessage {
  id?: string;
  error?: string;
}

export interface APIUser {
  id?: string;
  steamId?: bigint;
  gmodstoreId?: string;
  discordId?: string;
  error?: string;
}

export async function getUser(user_id: string): Promise<APIResponse> {
  const url = new URL(`${urlBase}/user/${user_id}/discord`);

  try {
    const data = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `${Deno.env.get("API_TOKEN")}`,
      },
    });

    return {data};
  } catch (err) {
    return {error: Error(err)};
  }
}

export async function create(user_id: string, addon_id: string): Promise<APIResponse> {
  const url = new URL(`${urlBase}/ticket/create`);
  url.searchParams.append("creator", user_id);
  url.searchParams.append("addon", addon_id);

  try {
    const data = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `${Deno.env.get("API_TOKEN")}`,
      },
    });

    return {data};
  } catch (err) {
    return {error: Error(err)};
  }
}

export async function get(ticket_id: string): Promise<APIResponse> {
  const url = new URL(`${urlBase}/ticket/${ticket_id}`);

  try {
    const data = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `${Deno.env.get("API_TOKEN")}`,
      },
    });

    return {data};
  } catch (err) {
    return {error: Error(err)};
  }
}

export async function close(ticket_id: string): Promise<APIResponse> {
  const url = new URL(`${urlBase}/ticket/${ticket_id}/status`,);
  url.searchParams.append("status", "CLOSED");

  try {
    const data = await fetch(url.toString(), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `${Deno.env.get("API_TOKEN")}`,
      },
    });

    return {data};
  } catch (err) {
    return {error: Error(err)};
  }
}

export async function hold(ticket_id: string): Promise<APIResponse> {
  const url = new URL(`${urlBase}/ticket/${ticket_id}/status`,);
  url.searchParams.append("status", "HOLD");

  try {
    const data = await fetch(url.toString(), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `${Deno.env.get("API_TOKEN")}`,
      },
    });

    return {data};
  } catch (err) {
    return {error: Error(err)};
  }
}

export async function unhold(ticket_id: string): Promise<APIResponse> {
  const url = new URL(`${urlBase}/ticket/${ticket_id}/status`,);
  url.searchParams.append("status", "OPEN");

  try {
    const data = await fetch(url.toString(), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `${Deno.env.get("API_TOKEN")}`,
      },
    });

    return {data};
  } catch (err) {
    return {error: Error(err)};
  }
}

export async function createMessage(ticket_id: string, user_id: string, message_content: string): Promise<APIResponse> {
  const url = new URL(`${urlBase}/ticket/${ticket_id}/message`);
  url.searchParams.append("user", user_id);
  url.searchParams.append("message", message_content);

  try {
    const data = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `${Deno.env.get("API_TOKEN")}`,
      },
    });

    return {data};
  } catch (err) {
    return {error: Error(err)};
  }
}

export async function editMessage(ticket_id: string, user_id: string, updated_from_id: string, message_content: string) {
  const url = new URL(`${urlBase}/ticket/${ticket_id}/message`);
  url.searchParams.append("user", user_id);
  url.searchParams.append("updated_from", updated_from_id);
  url.searchParams.append("message", message_content);

  try {
    const data = await fetch(url.toString(), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `${Deno.env.get("API_TOKEN")}`,
      },
    });

    return {data};
  } catch (err) {
    return {error: Error(err)};
  }
}