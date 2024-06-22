import { Interaction } from "https://deno.land/x/harmony@v2.9.1/src/structures/interactions.ts";
import {
  ApplicationCommandPartial,
  ApplicationCommandsModule,
  slash,
} from "../deps.ts";

export class GeneralCommandsModule extends ApplicationCommandsModule {
  name = "General"

  commandData: ApplicationCommandPartial[] = [
    {
      name: "ping",
      description: "Ping the bot.",
      options: [],
    },
    {
      name: "ping2",
      description: "Ping the bot.",
      options: [],
    },
  ];

  @slash("ping")
  ping(interaction: Interaction): void {
    interaction.reply("Pong!");
  }

  @slash("ping2")
  ping2(interaction: Interaction): void {
    interaction.reply("Pong2!");
  }
}
