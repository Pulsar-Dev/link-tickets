import {Client, Intents, Interaction, logger} from "./deps.ts";
import {get_commands} from "./commands.ts";
import {PulsarTicketsCommand} from "./command.types.ts";

const token: string = Deno.env.get("DISCORD_TOKEN")!;
const server: string = Deno.env.get("DISCORD_SERVER")!;

class PulsarTickets extends Client {
  commands: PulsarTicketsCommand[] = [];

  constructor(update_commands: boolean = false, commands: PulsarTicketsCommand[]) {
    super();

    this.commands = commands;


    this.on("ready", () => {
      logger.info("Ready!");

      if (update_commands) {
        this.update_commands()
      }
    });

    this.on("interactionCreate", async (interaction: Interaction) => {
      if (!interaction.isApplicationCommand()) return;

      const { data } = interaction;

      const command = this.commands.find(cmd => cmd.name === data.name);
      if (!command) return;
      command.execute(interaction);
    });
  }

  @event()
  ready() {
    console.log("Ready!")
  }

  async update_commands() {
    const created_commands: string[] = [];
    try {
      for (const command of commands) {
        await this.interactions.commands.create(command, server);
        created_commands.push(command.name);
      }
    } catch (err) {
      logger.error("Command creation failed:", err);
    }

    logger.info(`Created commands: ${created_commands.join(", ")}`);
  }
}

const commands = await get_commands();

export const mod = new PulsarTickets(true, commands);

mod.connect(token, Intents.None);
