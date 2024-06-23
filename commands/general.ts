import {
  ApplicationCommandPartial,
  ApplicationCommandsModule,
  Interaction,
  slash,
} from "../deps.ts";

export class GeneralCommandsModule extends ApplicationCommandsModule {
  name = "General";

  commandData: ApplicationCommandPartial[] = [
    {
      name: "ping",
      description: "Ping the bot.",
      options: [],
    },
  ];

  @slash("ping")
  ping(interaction: Interaction): void {
    interaction.reply("Pong!");
  }
}
