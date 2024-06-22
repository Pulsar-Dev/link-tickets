import {
  ApplicationCommand,
  ApplicationCommandPartial,
  ApplicationCommandsModule,
  Client,
  Collection,
  event,
  Intents,
  logger,
} from "./deps.ts";
import { GeneralCommandsModule } from "./commands/general.ts";
import { TicketCommandsModule } from "./commands/tickets.ts";
import { DB } from "https://deno.land/x/sqlite@v3.8/mod.ts";

interface PulsarTicketsModule extends ApplicationCommandsModule {
  commandData: ApplicationCommandPartial[];
}

const token: string = Deno.env.get("DISCORD_TOKEN")!;
const server: string = Deno.env.get("DISCORD_SERVER")!;

export const database = new DB("pulsar_tickets.db");
database.execute(`
    CREATE TABLE IF NOT EXISTS tickets
    (
        id
        INTEGER
        PRIMARY
        KEY
        AUTOINCREMENT,
        ticket_id
        TEXT,
        channel_id
        TEXT
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
    const modules = await this.interactions.modules;

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
}

export const mod = new PulsarTickets();

mod.connect(token, Intents.None);
