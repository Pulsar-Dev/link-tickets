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

interface PulsarTicketsModule extends ApplicationCommandsModule {
  commandData: ApplicationCommandPartial[];
}

const token: string = Deno.env.get("DISCORD_TOKEN")!;
const server: string = Deno.env.get("DISCORD_SERVER")!;

class PulsarTickets extends Client {
  commands: Collection<string, ApplicationCommand> = new Collection<
    string,
    ApplicationCommand
  >();

  constructor() {
    super();

    const generalCommandsModule = new GeneralCommandsModule();

    this.interactions.loadModule(generalCommandsModule);
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
