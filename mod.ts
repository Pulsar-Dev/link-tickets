import {
  ApplicationCommand,
  ApplicationCommandPartial,
  ApplicationCommandsModule,
  Client,
  Collection,
  event,
  Intents,
  logger,
  Message
} from "./deps.ts";
import {GeneralCommandsModule} from "./commands/general.ts";
import {TicketCommandsModule} from "./commands/tickets.ts";
import {DB} from "https://deno.land/x/sqlite@v3.8/mod.ts";
import {get, getMessagePulsarId, getUserPulsarId, insertMessage} from "./helpers/db.ts";
import {APIMessage, createMessage, editMessage} from "./helpers/api.ts";

interface PulsarTicketsModule extends ApplicationCommandsModule {
  commandData: ApplicationCommandPartial[];
}

const token: string = Deno.env.get("DISCORD_TOKEN")!;
const server: string = Deno.env.get("DISCORD_SERVER")!;

export const database = new DB("pulsar_tickets.db");
database.execute(`
    CREATE TABLE IF NOT EXISTS tickets
    (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id  TEXT,
        channel_id TEXT,
        creator    TEXT
    );
    CREATE TABLE IF NOT EXISTS messages
    (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT,
        pulsar_id  TEXT
    );
    CREATE TABLE IF NOT EXISTS user_cache
    (
        discord_id TEXT PRIMARY KEY,
        pulsar_id  TEXT
    );
`);

class PulsarTickets extends Client {
  commands: Collection<string, ApplicationCommand> = new Collection<
    string,
    ApplicationCommand
  >();

  constructor() {
    super();

    this.interactions.loadModule(new GeneralCommandsModule());
    this.interactions.loadModule(new TicketCommandsModule());
  }

  @event()
  async ready() {
    logger.info("Bot is ready!");
    const modules = this.interactions.modules;

    const createdCommands: string[] = [];

    modules.forEach((module) => {
      const commandData = (module as PulsarTicketsModule).commandData;

      commandData.forEach((command) => {
        this.interactions.commands.create(command, server);
        createdCommands.push(command.name);
      });
    });

    logger.info(`Created commands: ${createdCommands.join(", ")}`);
  }

  @event("messageCreate")
  async messageCreate(message: Message) {
    const ticket = await get(message.channelID);
    if (ticket.channel_id === "") return;
    if (!message.member) return;

    const userPulsarId = await getUserPulsarId(message.member.id);
    if (userPulsarId === "") return;

    const apiReturn = await createMessage(ticket.ticket_id, userPulsarId, message.content)

    if (apiReturn.error) {
      logger.error("Error uploading message: API fetch failed: ", apiReturn.error);
      return;
    }

    const data = apiReturn.data;

    if (!data || !data.ok) {
      logger.error(`Error uploading message: API request failed: ${data}`);
      return;
    }

    const response: APIMessage = await data.json()

    if (response.error) {
      logger.error(`Error uploading message: API returned error: ${response.error}`);
      return;
    }

    insertMessage(message.id, response.id!)
  }

  @event("messageUpdate")
  async messageUpdate(beforeMessage: Message, afterMessage: Message) {
    const ticket = await get(afterMessage.channelID);
    if (ticket.channel_id === "") return;
    if (!afterMessage.member) return;

    const userPulsarId = await getUserPulsarId(afterMessage.member.id);
    if (userPulsarId === "") return;

    const pulsarMessageId = await getMessagePulsarId(beforeMessage.id);
    if (pulsarMessageId === "") return;

    const apiReturn = await editMessage(ticket.ticket_id, userPulsarId, pulsarMessageId, afterMessage.content)

    if (apiReturn.error) {
      logger.error("Error editing message: API fetch failed: ", apiReturn.error);
      return;
    }

    const data = apiReturn.data;

    if (!data || !data.ok) {
      logger.error(`Error editing message: API request failed: ${data}`);
      return;
    }

    const response: APIMessage = await data.json()

    if (response.error) {
      logger.error(`Error editing message: API returned error: ${response.error}`);
      return;
    }
  }
}

export const mod = new PulsarTickets();
mod.connect(token, Intents.All);
